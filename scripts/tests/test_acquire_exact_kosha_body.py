from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts import acquire_exact_kosha_body
from scripts.tests.test_snapshot_kosha_guide_corpus import build_pdf_bytes


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fixture_ledger(pdf_bytes: bytes) -> dict[str, object]:
    ledger: dict[str, object] = {
        "schema_version": "safeclaw-kosha-evidence-portability/v1",
        "records": [
            {
                "stable_key": "D-C-7",
                "version": "D-C-7-2026",
                "source_zip": "[2025] 기술지원규정(건설안전분야).zip",
                "source_member": "D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정.pdf",
                "official_url": "https://portal.kosha.or.kr/openapi/v1/file/down/FILE/2",
                "expected_sha256": sha256(pdf_bytes),
            }
        ],
    }
    ledger["ledger_sha256"] = sha256(canonical_json(ledger).encode("utf-8"))
    return ledger


class AcquireExactKoshaBodyTest(unittest.TestCase):
    def test_promotes_only_after_hash_and_document_identity_validate(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        ledger = fixture_ledger(pdf_bytes)
        ledger_sha256 = str(ledger["ledger_sha256"])
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            asset_path = root / "d-c-7-2026.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

            receipt = acquire_exact_kosha_body.acquire_exact_body(
                ledger_path,
                asset_path,
                receipt_path,
                failure_path,
                fetch_bytes=lambda url: pdf_bytes,
                expected_ledger_sha256=ledger_sha256,
            )

            asset = json.loads(asset_path.read_text(encoding="utf-8"))
            self.assertEqual(receipt["status"], "verified")
            self.assertEqual(asset["pdfSha256"], sha256(pdf_bytes))
            self.assertEqual(asset["bodySha256"], sha256(asset["body"].encode("utf-8")))
            self.assertEqual(asset["extractorDependency"], "pypdf==6.7.1")
            self.assertFalse(failure_path.exists())

    def test_hash_mismatch_writes_honest_failure_without_promotion(self) -> None:
        expected_pdf = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 expected"])
        downloaded_pdf = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 modified"])
        ledger = fixture_ledger(expected_pdf)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

            with self.assertRaisesRegex(acquire_exact_kosha_body.AcquisitionError, "pdf-sha256-mismatch"):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=lambda url: downloaded_pdf,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                )

            failure = json.loads(failure_path.read_text(encoding="utf-8"))
            self.assertEqual(failure["status"], "not-promoted")
            self.assertFalse(failure["promoted"])
            self.assertFalse(asset_path.exists())
            self.assertFalse(receipt_path.exists())

    def test_rejects_tampered_ledger_before_fetch(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 body"])
        ledger = fixture_ledger(pdf_bytes)
        pinned_sha256 = str(ledger["ledger_sha256"])
        records = ledger["records"]
        self.assertIsInstance(records, list)
        records[0]["official_url"] = "https://example.com/forged.pdf"
        requested: list[str] = []
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

            with self.assertRaisesRegex(acquire_exact_kosha_body.AcquisitionError, "ledger-self-hash-mismatch"):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    root / "asset.json",
                    root / "receipt.json",
                    root / "failure.json",
                    fetch_bytes=lambda url: requested.append(url) or pdf_bytes,
                    expected_ledger_sha256=pinned_sha256,
                )

        self.assertEqual(requested, [])

    def test_tracked_promotion_asset_and_receipt_are_self_consistent(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        asset_path = repo_root / "data" / "safety-knowledge" / "exact-kosha" / "d-c-7-2026.json"
        receipt_path = (
            repo_root
            / "evaluation"
            / "kosha-d-c-7-exact-body-recovery-2026-07-16"
            / "receipt.json"
        )
        asset = json.loads(asset_path.read_text(encoding="utf-8"))
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))

        self.assertEqual(asset["version"], "D-C-7-2026")
        self.assertEqual(asset["pdfSha256"], "5059f9faefe6f5e1a81fb750a3a96e842508b38c1b420bbda935b698aa864ff3")
        self.assertEqual(asset["bodySha256"], sha256(asset["body"].encode("utf-8")))
        self.assertEqual(asset["normalizedCharCount"], len(asset["body"]))
        self.assertEqual(receipt["status"], "verified")
        self.assertEqual(receipt["bodySha256"], asset["bodySha256"])
        self.assertEqual(receipt["pdfSha256"], asset["pdfSha256"])
        self.assertTrue(all(receipt["checks"].values()))


if __name__ == "__main__":
    unittest.main()
