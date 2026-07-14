from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any

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


def write_source(root: Path) -> tuple[dict[str, Any], str]:
    snapshot_id = "1" * 64
    snapshot_path = Path("snapshots") / snapshot_id
    snapshot_dir = root / snapshot_path
    snapshot_dir.mkdir(parents=True)
    body = "검증 대상\u0085기술지원규정 본문"
    item: dict[str, Any] = {
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
    chunk: dict[str, Any] = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "chunk_id": "technical-support-B-E-10-2026:p1",
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
    }
    items_text = write_jsonl(snapshot_dir / "items.jsonl", [item])
    chunks_text = write_jsonl(snapshot_dir / "chunks.jsonl", [chunk])
    failures_text = write_jsonl(snapshot_dir / "failures.jsonl", [])
    manifest: dict[str, Any] = {
        "schema_version": "safeclaw-kosha-body-corpus/v2",
        "snapshot_id": snapshot_id,
        "source_identity": {"identity_sha256": "3" * 64},
        "generation_policy_sha256": "4" * 64,
        "reproducibility_hash": "5" * 64,
        "counts": {
            "inventory": 1,
            "success": 1,
            "failure_ledger": 0,
            "chunks": 1,
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
    return item, body


class BuildKoshaVerifiedSubsetTests(unittest.TestCase):
    def test_missing_official_metadata_writes_only_reject_ledger(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            write_source(source)

            report = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
                official_metadata_path=None,
            )

            self.assertEqual(report["source_inventory_count"], 1)
            self.assertEqual(report["candidate_count"], 1)
            self.assertEqual(report["accepted_count"], 0)
            self.assertEqual(report["rejected_count"], 1)
            self.assertFalse(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            manifest = json.loads((output / current["manifest"]["path"]).read_text(encoding="utf-8"))
            self.assertFalse(manifest["launch_gate"]["launch_ready"])
            self.assertTrue(manifest["launch_gate"]["partial_coverage"])
            failures = (output / current["snapshot_path"] / "failures.jsonl").read_text(encoding="utf-8")
            self.assertIn("official-metadata-missing", failures)

    def test_complete_matching_official_metadata_creates_launch_ready_subset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source"
            output = root / "output"
            metadata_path = root / "official.jsonl"
            source.mkdir()
            item, body = write_source(source)
            write_jsonl(metadata_path, [{
                "stable_key": item["stable_key"],
                "official_version": item["version_key"],
                "official_status": "current",
                "official_url": "https://portal.kosha.or.kr/archive/resources/tech-support/search/all",
                "official_file_id": "CTC2026012914540778798257",
                "publication_date": "2026-01-30",
                "pdf_sha256": item["raw_sha256"],
                "body_sha256": normalized_body_sha256(body),
            }])

            report = build_kosha_verified_subset.build_verified_subset(
                source_root=source,
                output_root=output,
                official_metadata_path=metadata_path,
            )

            self.assertEqual(report["accepted_count"], 1)
            self.assertEqual(report["rejected_count"], 0)
            self.assertTrue(report["launch_ready"])
            current = json.loads((output / "current.json").read_text(encoding="utf-8"))
            item_row = json.loads(
                (output / current["snapshot_path"] / "items.jsonl").read_text(encoding="utf-8")
            )
            self.assertEqual(item_row["state"], "current")
            self.assertEqual(
                item_row["official_provenance"]["official_file_id"],
                "CTC2026012914540778798257",
            )
            schema_path = (
                Path(__file__).resolve().parents[2]
                / "data"
                / "safety-knowledge"
                / "kosha-body-corpus.schema.json"
            )
            validator = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))
            manifest = json.loads((output / current["manifest"]["path"]).read_text(encoding="utf-8"))
            validator.validate(manifest)
            validator.validate(item_row)


if __name__ == "__main__":
    unittest.main()
