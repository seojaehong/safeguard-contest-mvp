from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts import build_kosha_evidence_ledger
from scripts import kosha_evidence_portability


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fixture_record(payload: bytes = b"%PDF-1.7 portable evidence") -> dict[str, object]:
    return {
        "stable_key": "A-G-11",
        "version": "A-G-11-2025",
        "source_zip": "[2025] technical-support.zip",
        "source_member": "A-G-11-2025.pdf",
        "source_zip_sha256": "a" * 64,
        "official_url": "https://portal.kosha.or.kr/openapi/v1/file/down/FILE/1",
        "expected_sha256": sha256(payload),
    }


def fixture_identities() -> dict[str, object]:
    return {
        "corpus": {
            "snapshot_id": "b" * 64,
            "manifest_sha256": "c" * 64,
            "source_identity_sha256": "d" * 64,
            "generation_policy_sha256": "e" * 64,
        },
        "promotion": {
            "snapshot_id": "f" * 64,
            "manifest_sha256": "1" * 64,
            "official_metadata_sha256": "2" * 64,
            "failures_sha256": sha256(b""),
            "verified_count": 1,
            "failure_count": 0,
            "launch_ready": True,
        },
    }


def write_ledger(path: Path, ledger: dict[str, object]) -> None:
    path.write_text(
        json.dumps(ledger, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )


class KoshaEvidencePortabilityTests(unittest.TestCase):
    def test_verifies_content_addressed_relative_bundle(self) -> None:
        payload = b"%PDF-1.7 portable evidence"
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record(payload)], fixture_identities()
        )
        record = ledger["records"][0]

        self.assertEqual(
            record["relative_locator"],
            f"blobs/sha256/{sha256(payload)}",
        )
        self.assertTrue(str(record["stable_id"]).startswith("kosha-evidence-sha256:"))
        self.assertNotIn("C:\\", json.dumps(ledger, ensure_ascii=False))

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            bundle_root = root / "bundle"
            blob_path = bundle_root / str(record["relative_locator"])
            blob_path.parent.mkdir(parents=True)
            blob_path.write_bytes(payload)
            write_ledger(ledger_path, ledger)

            summary = kosha_evidence_portability.verify_ledger_bundle(
                ledger_path, bundle_root
            )

        self.assertTrue(summary["valid"])
        self.assertEqual(summary["verified_blob_count"], 1)

    def test_fails_closed_when_bundle_is_absent(self) -> None:
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record()], fixture_identities()
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            write_ledger(ledger_path, ledger)

            with self.assertRaisesRegex(
                kosha_evidence_portability.PortabilityError,
                "bundle-root-missing",
            ):
                kosha_evidence_portability.verify_ledger_bundle(
                    ledger_path, root / "missing"
                )

    def test_rejects_tampered_blob(self) -> None:
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record()], fixture_identities()
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            bundle_root = root / "bundle"
            locator = str(ledger["records"][0]["relative_locator"])
            blob_path = bundle_root / locator
            blob_path.parent.mkdir(parents=True)
            blob_path.write_bytes(b"tampered")
            write_ledger(ledger_path, ledger)

            with self.assertRaisesRegex(
                kosha_evidence_portability.PortabilityError,
                "blob-hash-mismatch",
            ):
                kosha_evidence_portability.verify_ledger_bundle(
                    ledger_path, bundle_root
                )

    def test_rehydrates_from_verified_local_bundle(self) -> None:
        payload = b"%PDF-1.7 portable evidence"
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record(payload)], fixture_identities()
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            source_bundle = root / "source-bundle"
            output_bundle = (
                root
                / f"nested-{'x' * 45}"
                / f"deeper-{'y' * 45}"
                / "rehydrated"
            )
            locator = str(ledger["records"][0]["relative_locator"])
            source_blob = source_bundle / locator
            source_blob.parent.mkdir(parents=True)
            source_blob.write_bytes(payload)
            write_ledger(ledger_path, ledger)

            summary = kosha_evidence_portability.rehydrate_bundle(
                ledger_path,
                source_bundle,
                output_bundle,
            )

            self.assertEqual((output_bundle / locator).read_bytes(), payload)
            self.assertEqual(summary["copied_count"], 1)
            self.assertEqual(summary["refetched_count"], 0)

    def test_official_refetch_is_explicit_and_hash_checked(self) -> None:
        payload = b"%PDF-1.7 portable evidence"
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record(payload)], fixture_identities()
        )
        requested: list[str] = []

        def fetch_bytes(url: str) -> bytes:
            requested.append(url)
            return payload

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            ledger_path = root / "ledger.json"
            write_ledger(ledger_path, ledger)

            with self.assertRaisesRegex(
                kosha_evidence_portability.PortabilityError,
                "bundle-root-missing",
            ):
                kosha_evidence_portability.rehydrate_bundle(
                    ledger_path,
                    root / "missing",
                    root / "blocked",
                )

            summary = kosha_evidence_portability.rehydrate_bundle(
                ledger_path,
                root / "missing",
                root / "refetched",
                allow_official_refetch=True,
                fetch_bytes=fetch_bytes,
            )

        self.assertEqual(requested, [fixture_record(payload)["official_url"]])
        self.assertEqual(summary["copied_count"], 0)
        self.assertEqual(summary["refetched_count"], 1)

    def test_official_refetch_rejects_non_official_origins_before_fetch(self) -> None:
        payload = b"%PDF-1.7 portable evidence"
        requested: list[str] = []

        def fetch_bytes(url: str) -> bytes:
            requested.append(url)
            return payload

        for unsafe_url in (
            "file:///C:/Windows/win.ini",
            "https://example.com/kosha.pdf",
            "http://portal.kosha.or.kr/openapi/v1/file/down/FILE/1",
        ):
            record = fixture_record(payload)
            record["official_url"] = unsafe_url
            ledger = kosha_evidence_portability.create_ledger(
                [record], fixture_identities()
            )
            with (
                self.subTest(unsafe_url=unsafe_url),
                tempfile.TemporaryDirectory() as temp_dir,
            ):
                root = Path(temp_dir)
                ledger_path = root / "ledger.json"
                write_ledger(ledger_path, ledger)

                with self.assertRaisesRegex(
                    kosha_evidence_portability.PortabilityError,
                    "official-refetch-url-forbidden",
                ):
                    kosha_evidence_portability.rehydrate_bundle(
                        ledger_path,
                        root / "missing",
                        root / "refetched",
                        allow_official_refetch=True,
                        fetch_bytes=fetch_bytes,
                    )

        self.assertEqual(requested, [])

    def test_rejects_absolute_locator_and_modified_ledger_identity(self) -> None:
        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record()], fixture_identities()
        )
        ledger["records"][0]["relative_locator"] = "C:/evidence.pdf"
        with self.assertRaisesRegex(
            kosha_evidence_portability.PortabilityError,
            "relative-locator-invalid",
        ):
            kosha_evidence_portability.validate_ledger(ledger)

        ledger = kosha_evidence_portability.create_ledger(
            [fixture_record()], fixture_identities()
        )
        ledger["canonical_identity"]["promotion"]["verified_count"] = 2
        with self.assertRaisesRegex(
            kosha_evidence_portability.PortabilityError,
            "ledger-sha256-mismatch",
        ):
            kosha_evidence_portability.validate_ledger(ledger)

    def test_default_official_fetch_policy_is_bounded(self) -> None:
        fetcher = kosha_evidence_portability.OfficialFetcher()

        self.assertEqual(fetcher.timeout_seconds, 20.0)
        self.assertEqual(fetcher.retries, 1)

    def test_builds_ledger_and_external_bundle_from_recovery_artifacts(self) -> None:
        payload = b"%PDF-1.7 portable evidence"
        record = fixture_record(payload)
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            failure_map = root / "failure-map.json"
            repack_manifest = root / "repack-manifest.json"
            corpus_root = root / "corpus"
            promotion_root = root / "promotion"
            downloads_root = root / "downloads"
            bundle_root = root / "bundle"
            ledger_path = root / "verification-ledger.json"
            downloads_root.mkdir()
            (downloads_root / "A-G-11.pdf").write_bytes(payload)
            write_json(
                failure_map,
                {
                    "records": [
                        {
                            **record,
                            "actual_sha256": record["expected_sha256"],
                        }
                    ]
                },
            )
            write_json(
                repack_manifest,
                {
                    "archives": [
                        {
                            "source_zip": record["source_zip"],
                            "output_zip_sha256": record["source_zip_sha256"],
                        }
                    ]
                },
            )
            corpus_manifest = {
                "snapshot_id": "b" * 64,
                "reproducibility_hash": "b" * 64,
                "source_identity": {"identity_sha256": "d" * 64},
                "generation_policy_sha256": "e" * 64,
                "output_hashes": {"items.jsonl": "3" * 64},
            }
            corpus_manifest_text = canonical_text(corpus_manifest)
            corpus_manifest_path = corpus_root / "snapshots" / ("b" * 64) / "manifest.json"
            corpus_manifest_path.parent.mkdir(parents=True)
            corpus_manifest_path.write_text(corpus_manifest_text, encoding="utf-8", newline="\n")
            write_json(
                corpus_root / "current.json",
                {
                    "snapshot_id": "b" * 64,
                    "manifest": {
                        "path": f"snapshots/{'b' * 64}/manifest.json",
                        "sha256": sha256(corpus_manifest_text.encode("utf-8")),
                        "size_bytes": len(corpus_manifest_text.encode("utf-8")),
                    },
                },
            )
            promotion_manifest = {
                "snapshot_id": "f" * 64,
                "reproducibility_hash": "f" * 64,
                "counts": {"candidates": 1, "verified": 1, "failures": 0},
                "launch_ready": True,
                "identity": {
                    "official_collection_sha256": "4" * 64,
                    "output_hashes": {
                        "official-metadata.jsonl": "2" * 64,
                        "failures.jsonl": sha256(b""),
                    },
                },
            }
            promotion_manifest_text = canonical_text(promotion_manifest)
            promotion_manifest_path = promotion_root / "snapshots" / ("f" * 64) / "manifest.json"
            promotion_manifest_path.parent.mkdir(parents=True)
            promotion_manifest_path.write_text(
                promotion_manifest_text, encoding="utf-8", newline="\n"
            )
            write_json(
                promotion_root / "current.json",
                {
                    "snapshot_id": "f" * 64,
                    "manifest": {
                        "path": f"snapshots/{'f' * 64}/manifest.json",
                        "sha256": sha256(promotion_manifest_text.encode("utf-8")),
                        "size_bytes": len(promotion_manifest_text.encode("utf-8")),
                    },
                },
            )

            outside_download = root / "outside.pdf"
            outside_download.write_bytes(payload)
            traversal_record = {**record, "stable_key": "../outside"}
            write_json(
                failure_map,
                {
                    "records": [
                        {
                            **traversal_record,
                            "actual_sha256": traversal_record["expected_sha256"],
                        }
                    ]
                },
            )
            with self.assertRaisesRegex(
                kosha_evidence_portability.PortabilityError,
                "download-path-escape",
            ):
                build_kosha_evidence_ledger.build_ledger_artifacts(
                    failure_map_path=failure_map,
                    repack_manifest_path=repack_manifest,
                    corpus_root=corpus_root,
                    promotion_root=promotion_root,
                    downloads_root=downloads_root,
                    bundle_root=root / "traversal-bundle",
                    ledger_path=root / "traversal-ledger.json",
                )

            write_json(
                failure_map,
                {
                    "records": [
                        {
                            **record,
                            "actual_sha256": record["expected_sha256"],
                        }
                    ]
                },
            )

            summary = build_kosha_evidence_ledger.build_ledger_artifacts(
                failure_map_path=failure_map,
                repack_manifest_path=repack_manifest,
                corpus_root=corpus_root,
                promotion_root=promotion_root,
                downloads_root=downloads_root,
                bundle_root=bundle_root,
                ledger_path=ledger_path,
            )

            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            locator = str(ledger["records"][0]["relative_locator"])
            self.assertEqual((bundle_root / locator).read_bytes(), payload)
            self.assertEqual(ledger["records"][0]["source_zip_sha256"], "a" * 64)
            self.assertEqual(ledger["canonical_identity"]["corpus"]["snapshot_id"], "b" * 64)
            self.assertEqual(ledger["canonical_identity"]["promotion"]["snapshot_id"], "f" * 64)
            self.assertEqual(summary["record_count"], 1)
            self.assertEqual(summary["bundle_blob_count"], 1)

    def test_cli_scripts_bootstrap_repo_imports(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        for script_name in (
            "build_kosha_evidence_ledger.py",
            "verify_kosha_evidence_ledger.py",
            "rehydrate_kosha_evidence_bundle.py",
        ):
            completed = subprocess.run(
                [sys.executable, str(repo_root / "scripts" / script_name), "--help"],
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)


if __name__ == "__main__":
    unittest.main()
