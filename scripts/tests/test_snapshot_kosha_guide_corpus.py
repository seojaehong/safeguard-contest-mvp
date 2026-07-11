from __future__ import annotations

import unittest
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Callable

from scripts.ingest_safety_reference_catalog import ReferenceItem, ReferenceSource
from scripts import snapshot_kosha_guide_corpus
from scripts.snapshot_kosha_guide_corpus import build_snapshot


class SnapshotKoshaGuideCorpusTest(unittest.TestCase):
    def test_supports_direct_script_execution_from_repo_root(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        result = subprocess.run(
            [sys.executable, "scripts/snapshot_kosha_guide_corpus.py", "--help"],
            cwd=repo_root,
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("read-only local KOSHA GUIDE corpus snapshot", result.stdout)

    def test_emits_utf8_json_when_windows_pipe_encoding_is_cp949(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as temp_dir:
            technical_folder = Path(temp_dir)
            zip_path = technical_folder / "[2025] technical-guides.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("G-1-2025 ◦ 일반 기술지침.pdf", b"%PDF-1.4")

            result = subprocess.run(
                [
                    sys.executable,
                    "scripts/snapshot_kosha_guide_corpus.py",
                    "--technical-folder",
                    str(technical_folder),
                ],
                cwd=repo_root,
                capture_output=True,
                check=False,
                env={**os.environ, "PYTHONIOENCODING": "cp949"},
            )

        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
        payload = json.loads(result.stdout.decode("utf-8"))
        self.assertIn("◦", payload["items"][0]["title"])

    def test_builds_read_only_snapshot_without_upload_state(self) -> None:
        source = ReferenceSource(
            id="kosha-technical-support-regulations-2025",
            source_group="kosha-reference",
            source_type="zip-folder",
            agency="한국산업안전보건공단",
            title="기술지원규정 및 안전보건 기술지침 묶음",
            source_path="C:/fixture",
            origin_url=None,
            file_format="zip/pdf",
            published_at="2025-01-01",
            metadata={"priorityOnly": False},
        )
        item = ReferenceItem(
            id="guide-1",
            source_id=source.id,
            item_type="technical-support-regulation",
            category="전기안전분야",
            subcategory="기술지원규정",
            title="B-E-17-2026 도장 공정 화재·폭발 예방",
            summary="도장 공정 환기와 점화원 통제",
            body="원문",
            keywords=["도장"],
            risk_tags=["화재", "폭발"],
            primary_documents=["위험성평가표"],
            controls=["환기", "점화원 통제"],
            payload={"zipFile": "fixture.zip"},
        )

        def parser(folder: Path, max_pdf_pages: int, priority_only: bool) -> tuple[ReferenceSource, list[ReferenceItem]]:
            self.assertEqual(folder, Path("C:/fixture"))
            self.assertEqual(max_pdf_pages, 3)
            self.assertFalse(priority_only)
            return source, [item]

        typed_parser: Callable[[Path, int, bool], tuple[ReferenceSource, list[ReferenceItem]]] = parser
        snapshot = build_snapshot(Path("C:/fixture"), 3, typed_parser)

        self.assertTrue(snapshot["readOnly"])
        self.assertFalse(snapshot["dbMutationPerformed"])
        self.assertEqual(snapshot["source"]["id"], source.id)
        self.assertEqual(snapshot["items"][0]["id"], item.id)
        self.assertEqual(snapshot["itemCount"], 1)
        self.assertEqual(snapshot["parseStats"]["rowsReturned"], 1)
        self.assertEqual(snapshot["parseStats"]["parseAttemptedCount"], 1)
        self.assertEqual(snapshot["parseStats"]["parseSuccessCount"], 1)
        self.assertEqual(snapshot["parseStats"]["parseFailureCount"], 0)
        self.assertTrue(snapshot["parseStats"]["accountingMatches"])

    def test_accounts_for_each_pdf_parse_failure_instead_of_treating_returned_rows_as_success(self) -> None:
        source = ReferenceSource(
            id="kosha-technical-support-regulations-2025",
            source_group="kosha-reference",
            source_type="zip-folder",
            agency="한국산업안전보건공단",
            title="기술지원규정 및 안전보건 기술지침 묶음",
            source_path="C:/fixture",
            origin_url=None,
            file_format="zip/pdf",
            published_at="2025-01-01",
            metadata={"priorityOnly": False},
        )
        good = ReferenceItem(
            id="good",
            source_id=source.id,
            item_type="technical-support-regulation",
            category="전기안전분야",
            subcategory="기술지원규정",
            title="B-E-17-2026 good",
            summary="good",
            body="parsed",
            keywords=[],
            risk_tags=[],
            primary_documents=[],
            controls=[],
            payload={"internalPath": "B-E-17-2026 good.pdf", "isPriority": True},
        )
        failed = ReferenceItem(
            id="failed",
            source_id=source.id,
            item_type="technical-support-regulation",
            category="전기안전분야",
            subcategory="기술지원규정",
            title="B-E-18-2026 failed",
            summary="fallback",
            body="",
            keywords=[],
            risk_tags=[],
            primary_documents=[],
            controls=[],
            payload={"internalPath": "B-E-18-2026 failed.pdf", "isPriority": True},
        )

        def parser(folder: Path, max_pdf_pages: int, priority_only: bool) -> tuple[ReferenceSource, list[ReferenceItem]]:
            print("[warn] PDF text extraction failed: B-E-18-2026 failed.pdf (fixture)")
            return source, [good, failed]

        snapshot = build_snapshot(Path("C:/fixture"), 3, parser)

        self.assertEqual(snapshot["parseStats"]["rowsReturned"], 2)
        self.assertEqual(snapshot["parseStats"]["parseAttemptedCount"], 2)
        self.assertEqual(snapshot["parseStats"]["parseSuccessCount"], 1)
        self.assertEqual(snapshot["parseStats"]["parseFailureCount"], 1)
        self.assertTrue(snapshot["parseStats"]["accountingMatches"])
        self.assertEqual(
            snapshot["parseStats"]["outcomes"],
            [
                {"internalPath": "B-E-17-2026 good.pdf", "status": "success"},
                {"internalPath": "B-E-18-2026 failed.pdf", "status": "failure"},
            ],
        )

    def test_parse_accounting_fails_closed_on_count_mismatch(self) -> None:
        self.assertTrue(hasattr(snapshot_kosha_guide_corpus, "validate_parse_accounting"))
        stats = {
            "rowsReturned": 2,
            "parseAttemptedCount": 2,
            "parseSuccessCount": 2,
            "parseFailureCount": 1,
            "outcomes": [],
        }

        validated = snapshot_kosha_guide_corpus.validate_parse_accounting(stats, expected_pdf_rows=3)

        self.assertFalse(validated["accountingMatches"])
        self.assertEqual(
            validated["mismatches"],
            ["rows-returned:2/3", "parse-outcomes:3/2", "outcome-rows:0/2"],
        )


if __name__ == "__main__":
    unittest.main()
