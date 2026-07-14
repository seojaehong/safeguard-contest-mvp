from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any
from unittest import mock

from jsonschema import Draft202012Validator

from scripts import build_kosha_verified_subset


def sha256(value: bytes | str) -> str:
    payload = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(payload).hexdigest()


def normalized_body_sha256(value: str) -> str:
    return sha256(" ".join(value.split()))


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> str:
    text = "".join(f"{json.dumps(row, ensure_ascii=False, sort_keys=True)}\n" for row in rows)
    path.write_text(text, encoding="utf-8", newline="\n")
    return text


def write_source(root: Path, *, pinned_contract: bool = False) -> tuple[list[dict[str, Any]], str]:
    snapshot_id = (
        build_kosha_verified_subset.PINNED_SOURCE_SNAPSHOT_ID
        if pinned_contract
        else "1" * 64
    )
    snapshot_path = Path("snapshots") / snapshot_id
    snapshot_dir = root / snapshot_path
    snapshot_dir.mkdir(parents=True)
    body = "검증 대상\u0085기술지원규정 본문"
    item_template: dict[str, Any] = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "item_id": "technical-support-B-E-10-2026",
        "item_type": "technical-support-regulation",
        "title": "B-E-10-2026 정전전로 기술지원규정",
        "category": "전기안전분야",
        "body": body,
        "normalized_text_sha256": normalized_body_sha256(body),
        "raw_sha256": "2" * 64,
        "state": "current-unverified",
        "stable_key": "B-E-10",
        "version_key": "B-E-10-2026",
        "source_key": "fixed-v1",
        "source_zip": "source.zip",
        "source_member": "B-E-10-2026.pdf",
        "source_file_size": 100,
        "source_compressed_size": 90,
        "source_crc32": "1234abcd",
        "extraction_status": "success",
        "normalized_char_count": len(body),
        "page_count": 1,
        "pages": [{
            "page_number": 1,
            "char_count": len(body),
            "normalized_char_count": len(body),
            "normalized_text_sha256": sha256(body),
            "has_image": False,
            "ocr_candidate": False,
            "body_char_start": 0,
            "body_char_end": len(body),
            "extraction_status": "success",
        }],
        "ocr_candidate": False,
        "ocr_candidate_reasons": [],
        "raw_duplicate_of": None,
        "text_duplicate_of": None,
        "provenance": {
            "official_list_url": "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
            "official_api_url": "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList",
            "official_download_url": None,
            "official_download_boundary": "not retained in source artifact",
        },
    }
    candidate_count = 234 if pinned_contract else 1
    source_inventory_count = 1040 if pinned_contract else 1
    candidate_items: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    for index in range(candidate_count):
        item = dict(item_template)
        version = "B-E-10-2026" if index == 0 else f"B-E-{1000 + index}-2026"
        item.update({
            "item_id": f"technical-support-{version}",
            "title": f"{version} 기술지원규정",
            "stable_key": version.removesuffix("-2026"),
            "version_key": version,
            "source_member": f"{version}.pdf",
        })
        candidate_items.append(item)
        chunks.append({
            "schema_version": "safeclaw-kosha-body-corpus/v2",
            "chunk_id": f"technical-support-{version}:p1",
            "chunk_sha256": sha256(body),
            "item_id": item["item_id"],
            "stable_key": item["stable_key"],
            "version_key": item["version_key"],
            "source_zip": item["source_zip"],
            "source_member": item["source_member"],
            "page_start": 1,
            "page_end": 1,
            "text": body,
            "source_spans": [{"page_number": 1, "char_start": 0, "char_end": len(body)}],
        })
    out_of_scope_items = [
        {
            **item_template,
            "item_id": f"technical-guideline-{index}",
            "item_type": "technical-guideline",
            "title": f"KOSHA GUIDE TEST-{index}",
            "stable_key": f"TEST-{index}",
            "version_key": f"TEST-{index}-2026",
            "source_member": f"TEST-{index}-2026.pdf",
        }
        for index in range(source_inventory_count - candidate_count)
    ]
    all_items = [*candidate_items, *out_of_scope_items]
    items_text = write_jsonl(snapshot_dir / "items.jsonl", all_items)
    chunks_text = write_jsonl(snapshot_dir / "chunks.jsonl", chunks)
    failures_text = write_jsonl(snapshot_dir / "failures.jsonl", [])
    manifest: dict[str, Any] = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "snapshot_id": snapshot_id,
        "source_identity": {"identity_sha256": "3" * 64},
        "generation_policy_sha256": "4" * 64,
        "reproducibility_hash": "5" * 64,
        "counts": {
            "inventory": source_inventory_count,
            "success": source_inventory_count,
            "failure_ledger": 0,
            "chunks": len(chunks),
        },
        "output_hashes": {
            "items.jsonl": sha256(items_text),
            "chunks.jsonl": sha256(chunks_text),
            "failures.jsonl": sha256(failures_text),
        },
    }
    manifest_text = json.dumps(manifest, ensure_ascii=False, sort_keys=True)
    (snapshot_dir / "manifest.json").write_text(manifest_text, encoding="utf-8")
    current = {
        "schema_version": "safeclaw-kosha-body-current/v1",
        "snapshot_id": snapshot_id,
        "snapshot_path": snapshot_path.as_posix(),
        "source_identity_sha256": manifest["source_identity"]["identity_sha256"],
        "generation_policy_sha256": manifest["generation_policy_sha256"],
        "reproducibility_hash": manifest["reproducibility_hash"],
        "manifest": {
            "path": f"{snapshot_path.as_posix()}/manifest.json",
            "sha256": sha256(manifest_text),
            "size_bytes": len(manifest_text.encode("utf-8")),
        },
    }
    (root / "current.json").write_text(
        json.dumps(current, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )
    return candidate_items, body


class BuildKoshaVerifiedSubsetTests(unittest.TestCase):
    def test_rejects_one_row_source_that_bypasses_the_pinned_fixed_v1_scope(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            source.mkdir()
            write_source(source)

            with self.assertRaisesRegex(
                build_kosha_verified_subset.SubsetBuildError,
                "source-contract-mismatch",
            ):
                build_kosha_verified_subset.build_verified_subset(
                    source_root=source,
                    output_root=root / "output",
                )

    def test_missing_official_metadata_writes_only_reject_ledger(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, pinned_contract=True)

            report = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
            )

            self.assertEqual(report["source_inventory_count"], 1040)
            self.assertEqual(report["candidate_count"], 234)
            self.assertEqual(report["accepted_count"], 0)
            self.assertEqual(report["rejected_count"], 234)
            self.assertFalse(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            manifest = json.loads((output / current["manifest"]["path"]).read_text(encoding="utf-8"))
            self.assertFalse(manifest["launch_gate"]["launch_ready"])
            self.assertTrue(manifest["launch_gate"]["partial_coverage"])
            failures = (output / current["snapshot_path"] / "failures.jsonl").read_text(encoding="utf-8")
            self.assertIn("official-metadata-missing", failures)

    def test_untrusted_caller_metadata_cannot_create_launch_ready_subset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            metadata_path = root / "official.jsonl"
            source.mkdir()
            items, body = write_source(source, pinned_contract=True)
            write_jsonl(metadata_path, [{
                "stable_key": item["stable_key"],
                "official_version": item["version_key"],
                "official_status": "current",
                "official_url": "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
                "official_file_id": f"TEST-{index}",
                "publication_date": "2026-01-30",
                "pdf_sha256": item["raw_sha256"],
                "body_sha256": normalized_body_sha256(body),
            } for index, item in enumerate(items)])

            report = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
                _test_only_official_metadata_path=metadata_path,
            )

            self.assertEqual(report["accepted_count"], 0)
            self.assertEqual(report["rejected_count"], 234)
            self.assertFalse(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            items_text = (output / current["snapshot_path"] / "items.jsonl").read_text(encoding="utf-8")
            failures_text = (output / current["snapshot_path"] / "failures.jsonl").read_text(encoding="utf-8")
            self.assertEqual(items_text, "")
            self.assertIn("official-metadata-untrusted", failures_text)

    def test_explicit_test_only_trust_registry_can_exercise_ready_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            metadata_path = root / "official.jsonl"
            source.mkdir()
            items, body = write_source(source, pinned_contract=True)
            metadata_text = write_jsonl(metadata_path, [{
                "stable_key": item["stable_key"],
                "official_version": item["version_key"],
                "official_status": "current",
                "official_url": "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
                "official_file_id": f"TEST-{index}",
                "publication_date": "2026-01-30",
                "pdf_sha256": item["raw_sha256"],
                "body_sha256": normalized_body_sha256(body),
            } for index, item in enumerate(items)])
            metadata_sha256 = sha256(metadata_text)

            report = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
                _test_only_official_metadata_path=metadata_path,
                _test_only_trusted_official_metadata_sha256=frozenset({metadata_sha256}),
            )

            self.assertEqual(report["accepted_count"], 234)
            self.assertEqual(report["rejected_count"], 0)
            self.assertTrue(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            manifest = json.loads((output / current["manifest"]["path"]).read_text(encoding="utf-8"))
            item_row = json.loads(
                (output / current["snapshot_path"] / "items.jsonl").read_text(encoding="utf-8").split("\n")[0]
            )
            schema_path = (
                Path(__file__).resolve().parents[2]
                / "data"
                / "safety-knowledge"
                / "kosha-body-corpus.schema.json"
            )
            validator = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))
            validator.validate(manifest)
            validator.validate(item_row)

    def test_existing_snapshot_is_never_overwritten_when_bytes_differ(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source, pinned_contract=True)
            first = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
            )
            failures_path = (
                output
                / "snapshots"
                / str(first["subset_snapshot_id"])
                / "failures.jsonl"
            )
            failures_path.write_text("tampered\n", encoding="utf-8")

            with self.assertRaisesRegex(
                build_kosha_verified_subset.SubsetBuildError,
                "snapshot-output-mismatch:failures.jsonl",
            ):
                build_kosha_verified_subset.build_verified_subset(
                    source_root=source,
                    output_root=output,
                )
            self.assertEqual(failures_path.read_text(encoding="utf-8"), "tampered\n")

    def test_snapshot_identity_changes_with_generator_or_policy(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            source.mkdir()
            write_source(source, pinned_contract=True)
            baseline = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=root / "baseline",
            )
            with mock.patch.object(
                build_kosha_verified_subset,
                "generator_source_sha256",
                return_value="f" * 64,
                create=True,
            ):
                generator_changed = build_kosha_verified_subset.build_verified_subset(
                    source_root=source,
                    output_root=root / "generator-changed",
                )
            with mock.patch.object(
                build_kosha_verified_subset,
                "PINNED_SELECTION",
                "technical-support-regulation+current-unverified+success+native+policy-change",
            ):
                policy_changed = build_kosha_verified_subset.build_verified_subset(
                    source_root=source,
                    output_root=root / "policy-changed",
                )

            self.assertNotEqual(baseline["subset_snapshot_id"], generator_changed["subset_snapshot_id"])
            self.assertNotEqual(baseline["subset_snapshot_id"], policy_changed["subset_snapshot_id"])


if __name__ == "__main__":
    unittest.main()
