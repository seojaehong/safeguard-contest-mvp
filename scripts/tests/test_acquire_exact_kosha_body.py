from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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
    def test_production_pins_fix_official_pdf_and_normalized_body_hashes(self) -> None:
        self.assertEqual(
            acquire_exact_kosha_body.PINNED_PDF_SHA256,
            "5059f9faefe6f5e1a81fb750a3a96e842508b38c1b420bbda935b698aa864ff3",
        )
        self.assertEqual(
            acquire_exact_kosha_body.PINNED_NORMALIZED_BODY_SHA256,
            "97c58f2c39260e9e763bae54748466f0837064ddccfc8e29b77d857c9f390112",
        )

    def test_promotes_only_after_hash_and_document_identity_validate(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        normalized_body = "KOSHA GUIDE D-C-7-2026 exact native body"
        ledger = fixture_ledger(pdf_bytes)
        ledger_sha256 = str(ledger["ledger_sha256"])
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            asset_path = root / "d-c-7-2026.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                patch.object(
                    acquire_exact_kosha_body,
                    "PINNED_NORMALIZED_BODY_SHA256",
                    sha256(normalized_body.encode("utf-8")),
                ),
            ):
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

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(expected_pdf)),
                self.assertRaisesRegex(acquire_exact_kosha_body.AcquisitionError, "pdf-sha256-mismatch"),
            ):
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

    def test_second_publish_failure_rolls_back_pair_and_writes_failure_receipt(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        ledger = fixture_ledger(pdf_bytes)
        normalized_body = "KOSHA GUIDE D-C-7-2026 exact native body"
        replace_count = 0

        def fail_second_publish(source: Path, destination: Path) -> None:
            nonlocal replace_count
            replace_count += 1
            if replace_count == 2:
                raise OSError("injected-second-publish-failure")
            os.replace(source, destination)

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
            old_asset = b'{"asset":"verified-old"}\n'
            old_receipt = b'{"receipt":"verified-old"}\n'
            asset_path.write_bytes(old_asset)
            receipt_path.write_bytes(old_receipt)

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                patch.object(
                    acquire_exact_kosha_body,
                    "PINNED_NORMALIZED_BODY_SHA256",
                    sha256(normalized_body.encode("utf-8")),
                ),
                self.assertRaisesRegex(OSError, "injected-second-publish-failure"),
            ):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=lambda url: pdf_bytes,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                    publish_replace=fail_second_publish,
                )

            failure = json.loads(failure_path.read_text(encoding="utf-8"))
            self.assertEqual(failure["status"], "not-promoted")
            self.assertEqual(failure["error"], "injected-second-publish-failure")
            self.assertFalse(failure["promotionState"]["partialPromotionPresent"])
            self.assertFalse(failure["promotionState"]["transactionPresent"])
            self.assertEqual(asset_path.read_bytes(), old_asset)
            self.assertEqual(receipt_path.read_bytes(), old_receipt)
            self.assertFalse((root / ".d-c-7-promotion-transaction").exists())

    def test_prejournal_interruptions_preserve_pair_and_second_acquisition_converges(self) -> None:
        phases = (
            "after-mkdir",
            "after-staged-asset",
            "after-staged-receipt",
            "after-backup-asset",
            "after-backup-receipt",
            "after-prepared-journal",
        )
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        normalized_body = "KOSHA GUIDE D-C-7-2026 exact native body"
        ledger = fixture_ledger(pdf_bytes)
        for interrupted_phase in phases:
            with self.subTest(interrupted_phase=interrupted_phase), tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                ledger_path = root / "ledger.json"
                asset_path = root / "asset.json"
                receipt_path = root / "receipt.json"
                failure_path = root / "failure.json"
                ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
                old_asset = b'{"asset":"verified-old"}\n'
                old_receipt = b'{"receipt":"verified-old"}\n'
                asset_path.write_bytes(old_asset)
                receipt_path.write_bytes(old_receipt)

                def interrupt_prepare(phase: str) -> None:
                    if phase == interrupted_phase:
                        raise OSError(f"injected-{phase}")

                with (
                    patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                    patch.object(
                        acquire_exact_kosha_body,
                        "PINNED_NORMALIZED_BODY_SHA256",
                        sha256(normalized_body.encode("utf-8")),
                    ),
                    self.assertRaisesRegex(OSError, f"injected-{interrupted_phase}"),
                ):
                    acquire_exact_kosha_body.acquire_exact_body(
                        ledger_path,
                        asset_path,
                        receipt_path,
                        failure_path,
                        fetch_bytes=lambda url: pdf_bytes,
                        expected_ledger_sha256=str(ledger["ledger_sha256"]),
                        prepare_hook=interrupt_prepare,
                    )

                self.assertEqual(asset_path.read_bytes(), old_asset)
                self.assertEqual(receipt_path.read_bytes(), old_receipt)
                self.assertFalse((root / ".d-c-7-promotion-transaction").exists())
                self.assertTrue((root / ".d-c-7-promotion-staging").exists())

                with (
                    patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                    patch.object(
                        acquire_exact_kosha_body,
                        "PINNED_NORMALIZED_BODY_SHA256",
                        sha256(normalized_body.encode("utf-8")),
                    ),
                ):
                    result = acquire_exact_kosha_body.acquire_exact_body(
                        ledger_path,
                        asset_path,
                        receipt_path,
                        failure_path,
                        fetch_bytes=lambda url: pdf_bytes,
                        expected_ledger_sha256=str(ledger["ledger_sha256"]),
                    )

                self.assertEqual(result["status"], "verified")
                self.assertNotEqual(asset_path.read_bytes(), old_asset)
                self.assertNotEqual(receipt_path.read_bytes(), old_receipt)
                self.assertFalse((root / ".d-c-7-promotion-staging").exists())
                self.assertFalse((root / ".d-c-7-promotion-transaction").exists())
                self.assertFalse(failure_path.exists())

    def test_rejects_symlink_target_before_fetch_or_mutation(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        ledger = fixture_ledger(pdf_bytes)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            external_asset = root / "external-asset.json"
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
            external_asset.write_bytes(b'{"asset":"external-old"}\n')
            receipt_path.write_bytes(b'{"receipt":"verified-old"}\n')
            try:
                asset_path.symlink_to(external_asset)
            except OSError as exc:
                self.skipTest(f"symlink creation unavailable: {exc}")
            requested: list[str] = []

            with self.assertRaisesRegex(
                acquire_exact_kosha_body.AcquisitionError,
                "promotion-output-symlink:asset",
            ):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=lambda url: requested.append(url) or pdf_bytes,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                )

            self.assertEqual(requested, [])
            self.assertTrue(asset_path.is_symlink())
            self.assertEqual(external_asset.read_bytes(), b'{"asset":"external-old"}\n')
            self.assertEqual(receipt_path.read_bytes(), b'{"receipt":"verified-old"}\n')
            self.assertFalse(failure_path.exists())

    def test_rejects_output_aliases_and_managed_paths_before_writing(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        ledger = fixture_ledger(pdf_bytes)
        cases = (
            ("failure-alias", "asset", "receipt", "asset", "promotion-output-path-alias"),
            (
                "hierarchical-output",
                "asset",
                "receipt",
                "asset/failure.json",
                "promotion-output-path-hierarchy:asset:failure",
            ),
            (
                "managed-transaction-target",
                ".d-c-7-promotion-transaction/asset",
                "receipt",
                "failure",
                "promotion-output-inside-managed-directory:asset",
            ),
            (
                "managed-staging-target",
                "asset",
                ".d-c-7-promotion-staging/receipt",
                "failure",
                "promotion-output-inside-managed-directory:receipt",
            ),
        )
        for case_name, asset_name, receipt_name, failure_name, error_pattern in cases:
            with self.subTest(case_name=case_name), tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                ledger_path = root / "ledger.json"
                asset_path = root / asset_name
                receipt_path = root / receipt_name
                failure_path = root / failure_name
                ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
                asset_path.parent.mkdir(parents=True, exist_ok=True)
                receipt_path.parent.mkdir(parents=True, exist_ok=True)
                failure_path.parent.mkdir(parents=True, exist_ok=True)
                if asset_path == failure_path:
                    asset_path.write_bytes(b'{"asset":"verified-old"}\n')

                with self.assertRaisesRegex(
                    acquire_exact_kosha_body.AcquisitionError,
                    error_pattern,
                ):
                    acquire_exact_kosha_body.acquire_exact_body(
                        ledger_path,
                        asset_path,
                        receipt_path,
                        failure_path,
                        fetch_bytes=lambda url: pdf_bytes,
                        expected_ledger_sha256=str(ledger["ledger_sha256"]),
                    )

                if asset_path == failure_path:
                    self.assertEqual(asset_path.read_bytes(), b'{"asset":"verified-old"}\n')

    def test_revalidates_output_components_after_fetch(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        normalized_body = "KOSHA GUIDE D-C-7-2026 exact native body"
        ledger = fixture_ledger(pdf_bytes)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_root = root / "outputs"
            original_root = root / "outputs-original"
            external_root = root / "external"
            output_root.mkdir()
            external_root.mkdir()
            ledger_path = root / "ledger.json"
            asset_path = output_root / "asset.json"
            receipt_path = output_root / "receipt.json"
            failure_path = output_root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")

            def swap_parent_during_fetch(url: str) -> bytes:
                del url
                output_root.rename(original_root)
                try:
                    output_root.symlink_to(external_root, target_is_directory=True)
                except OSError as exc:
                    original_root.rename(output_root)
                    self.skipTest(f"directory symlink creation unavailable: {exc}")
                return pdf_bytes

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                patch.object(
                    acquire_exact_kosha_body,
                    "PINNED_NORMALIZED_BODY_SHA256",
                    sha256(normalized_body.encode("utf-8")),
                ),
                self.assertRaisesRegex(
                    acquire_exact_kosha_body.AcquisitionError,
                    "promotion-output-symlink:asset",
                ),
            ):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=swap_parent_during_fetch,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                )

            self.assertFalse((external_root / "asset.json").exists())
            self.assertFalse((external_root / "receipt.json").exists())
            self.assertFalse((external_root / "failure.json").exists())

    def test_activation_interrupt_recovers_before_next_acquisition(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 exact native body"])
        normalized_body = "KOSHA GUIDE D-C-7-2026 exact native body"
        ledger = fixture_ledger(pdf_bytes)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            ledger_path.write_text(json.dumps(ledger, ensure_ascii=False), encoding="utf-8")
            old_asset = b'{"asset":"verified-old"}\n'
            old_receipt = b'{"receipt":"verified-old"}\n'
            asset_path.write_bytes(old_asset)
            receipt_path.write_bytes(old_receipt)

            def interrupt_after_activation(phase: str) -> None:
                if phase == "after-activation":
                    raise OSError("injected-after-activation")

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                patch.object(
                    acquire_exact_kosha_body,
                    "PINNED_NORMALIZED_BODY_SHA256",
                    sha256(normalized_body.encode("utf-8")),
                ),
                self.assertRaisesRegex(OSError, "injected-after-activation"),
            ):
                acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=lambda url: pdf_bytes,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                    prepare_hook=interrupt_after_activation,
                )

            self.assertEqual(asset_path.read_bytes(), old_asset)
            self.assertEqual(receipt_path.read_bytes(), old_receipt)
            self.assertTrue((root / ".d-c-7-promotion-transaction").exists())

            with (
                patch.object(acquire_exact_kosha_body, "PINNED_PDF_SHA256", sha256(pdf_bytes)),
                patch.object(
                    acquire_exact_kosha_body,
                    "PINNED_NORMALIZED_BODY_SHA256",
                    sha256(normalized_body.encode("utf-8")),
                ),
            ):
                result = acquire_exact_kosha_body.acquire_exact_body(
                    ledger_path,
                    asset_path,
                    receipt_path,
                    failure_path,
                    fetch_bytes=lambda url: pdf_bytes,
                    expected_ledger_sha256=str(ledger["ledger_sha256"]),
                )

            self.assertEqual(result["status"], "verified")
            self.assertFalse((root / ".d-c-7-promotion-transaction").exists())
            self.assertFalse((root / ".d-c-7-promotion-staging").exists())
            self.assertFalse(failure_path.exists())

    def test_recovers_interrupted_partial_publish_from_journal(self) -> None:
        for fail_after_restore in (1, 2):
            with self.subTest(fail_after_restore=fail_after_restore), tempfile.TemporaryDirectory() as temp_dir:
                root = Path(temp_dir)
                asset_path = root / "asset.json"
                receipt_path = root / "receipt.json"
                failure_path = root / "failure.json"
                old_asset = b'{"asset":"old"}\n'
                old_receipt = b'{"receipt":"old"}\n'
                asset_path.write_bytes(old_asset)
                receipt_path.write_bytes(old_receipt)
                transaction_dir = acquire_exact_kosha_body._prepare_promotion_transaction(
                    asset_path,
                    receipt_path,
                    failure_path,
                    {"asset": "new"},
                    {"receipt": "new"},
                )
                journal = json.loads((transaction_dir / "journal.json").read_text(encoding="utf-8"))
                self.assertEqual(journal["state"], "prepared")
                self.assertTrue(all(not value.startswith(("/", "\\")) for value in journal["targets"]["paths"].values()))
                self.assertEqual(
                    journal["backups"]["asset"]["sha256"],
                    sha256(old_asset),
                )
                self.assertEqual(
                    journal["backups"]["receipt"]["sha256"],
                    sha256(old_receipt),
                )
                asset_path.write_bytes(b'{"asset":"partial-new"}\n')
                receipt_path.write_bytes(b'{"receipt":"partial-new"}\n')
                restore_count = 0

                def interrupt_restore(destination: Path, value: bytes) -> None:
                    nonlocal restore_count
                    restore_count += 1
                    acquire_exact_kosha_body._write_bytes(destination, value)
                    if restore_count == fail_after_restore:
                        raise OSError(f"restore-interrupted-{fail_after_restore}")

                with self.assertRaisesRegex(OSError, f"restore-interrupted-{fail_after_restore}"):
                    acquire_exact_kosha_body._rollback_transaction(
                        transaction_dir,
                        asset_path,
                        receipt_path,
                        failure_path,
                        restore_write=interrupt_restore,
                    )

                self.assertTrue((transaction_dir / "asset.backup").is_file())
                self.assertTrue((transaction_dir / "receipt.backup").is_file())
                acquire_exact_kosha_body._recover_incomplete_promotion(
                    transaction_dir,
                    asset_path,
                    receipt_path,
                    failure_path,
                )
                self.assertEqual(asset_path.read_bytes(), old_asset)
                self.assertEqual(receipt_path.read_bytes(), old_receipt)
                self.assertFalse(transaction_dir.exists())

    def test_committed_recovery_requires_durable_completion_before_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            asset_path.write_bytes(b"old-asset")
            receipt_path.write_bytes(b"old-receipt")
            transaction_dir = acquire_exact_kosha_body._prepare_promotion_transaction(
                asset_path,
                receipt_path,
                failure_path,
                {"asset": "new"},
                {"receipt": "new"},
            )
            os.replace(transaction_dir / "asset.staged.json", asset_path)
            os.replace(transaction_dir / "receipt.staged.json", receipt_path)
            journal_path = transaction_dir / "journal.json"
            journal = json.loads(journal_path.read_text(encoding="utf-8"))
            journal["state"] = "committed"
            acquire_exact_kosha_body._write_json(journal_path, journal)

            with self.assertRaisesRegex(
                acquire_exact_kosha_body.AcquisitionError,
                "promotion-completion-invalid",
            ):
                acquire_exact_kosha_body._recover_incomplete_promotion(
                    transaction_dir,
                    asset_path,
                    receipt_path,
                    failure_path,
                )

            self.assertTrue(transaction_dir.exists())
            journal["completion"] = {
                "state": "committed",
                "targetsSha256": sha256(
                    canonical_json(journal["published"]).encode("utf-8")
                ),
            }
            acquire_exact_kosha_body._write_json(journal_path, journal)
            new_asset = asset_path.read_bytes()
            new_receipt = receipt_path.read_bytes()
            acquire_exact_kosha_body._recover_incomplete_promotion(
                transaction_dir,
                asset_path,
                receipt_path,
                failure_path,
            )

            self.assertEqual(asset_path.read_bytes(), new_asset)
            self.assertEqual(receipt_path.read_bytes(), new_receipt)
            self.assertFalse(transaction_dir.exists())

    def test_recovery_rejects_changed_target_paths_without_touching_either_pair(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            asset_path.write_bytes(b"old-asset")
            receipt_path.write_bytes(b"old-receipt")
            transaction_dir = acquire_exact_kosha_body._prepare_promotion_transaction(
                asset_path,
                receipt_path,
                failure_path,
                {"asset": "new"},
                {"receipt": "new"},
            )
            asset_path.write_bytes(b"partial-asset")
            changed_asset = root / "changed" / "asset.json"
            changed_asset.parent.mkdir()
            changed_asset.write_bytes(b"changed-sentinel")

            with self.assertRaisesRegex(
                acquire_exact_kosha_body.AcquisitionError,
                "promotion-target-identity-mismatch",
            ):
                acquire_exact_kosha_body._recover_incomplete_promotion(
                    transaction_dir,
                    changed_asset,
                    receipt_path,
                    failure_path,
                )

            self.assertEqual(asset_path.read_bytes(), b"partial-asset")
            self.assertEqual(receipt_path.read_bytes(), b"old-receipt")
            self.assertEqual(changed_asset.read_bytes(), b"changed-sentinel")
            self.assertTrue(transaction_dir.exists())

    def test_recovery_validates_all_backup_hashes_before_modifying_targets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            asset_path = root / "asset.json"
            receipt_path = root / "receipt.json"
            failure_path = root / "failure.json"
            asset_path.write_bytes(b"old-asset")
            receipt_path.write_bytes(b"old-receipt")
            transaction_dir = acquire_exact_kosha_body._prepare_promotion_transaction(
                asset_path,
                receipt_path,
                failure_path,
                {"asset": "new"},
                {"receipt": "new"},
            )
            asset_path.write_bytes(b"partial-asset")
            receipt_path.write_bytes(b"partial-receipt")
            (transaction_dir / "receipt.backup").write_bytes(b"tampered")

            with self.assertRaisesRegex(
                acquire_exact_kosha_body.AcquisitionError,
                "promotion-backup-sha256-mismatch:receipt",
            ):
                acquire_exact_kosha_body._recover_incomplete_promotion(
                    transaction_dir,
                    asset_path,
                    receipt_path,
                    failure_path,
                )

            self.assertEqual(asset_path.read_bytes(), b"partial-asset")
            self.assertEqual(receipt_path.read_bytes(), b"partial-receipt")

    def test_pinned_extractor_rejects_body_not_matching_known_official_hash(self) -> None:
        pdf_bytes = build_pdf_bytes(["KOSHA GUIDE D-C-7-2026 incomplete body"])
        record = fixture_ledger(pdf_bytes)["records"][0]
        self.assertIsInstance(record, dict)

        with self.assertRaisesRegex(
            acquire_exact_kosha_body.AcquisitionError,
            "normalized-body-sha256-mismatch",
        ):
            acquire_exact_kosha_body._extract_asset(record, pdf_bytes, "a" * 64)

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
        fixture = json.loads(
            (repo_root / "scripts" / "tests" / "fixtures" / "kosha-d-c-7-2026-pinned-extraction.json")
            .read_text(encoding="utf-8")
        )

        self.assertEqual(asset["version"], "D-C-7-2026")
        self.assertEqual(asset["pdfSha256"], fixture["pdfSha256"])
        self.assertEqual(asset["bodySha256"], sha256(asset["body"].encode("utf-8")))
        self.assertEqual(asset["bodySha256"], fixture["normalizedBodySha256"])
        self.assertEqual(asset["normalizedCharCount"], fixture["normalizedCharCount"])
        self.assertEqual(asset["extractorVersion"], fixture["extractorVersion"])
        self.assertEqual(asset["extractorDependency"], fixture["extractorDependency"])
        self.assertEqual(asset["normalizedCharCount"], len(asset["body"]))
        self.assertEqual(receipt["status"], "verified")
        self.assertEqual(receipt["officialUrl"], fixture["officialUrl"])
        self.assertEqual(receipt["pageCount"], fixture["pageCount"])
        self.assertEqual(receipt["bodySha256"], asset["bodySha256"])
        self.assertEqual(receipt["pdfSha256"], asset["pdfSha256"])
        self.assertEqual(receipt["promotionProtocol"], "recoverable-staged-pair/v3")
        self.assertTrue(receipt["checks"]["prepublishStagingIsolated"])
        self.assertTrue(receipt["checks"]["preparedJournalAtomicActivation"])
        self.assertTrue(receipt["checks"]["prejournalOrphanConvergence"])
        self.assertTrue(receipt["checks"]["activeJournalRevalidatedBeforePublish"])
        self.assertTrue(all(receipt["checks"].values()))


if __name__ == "__main__":
    unittest.main()
