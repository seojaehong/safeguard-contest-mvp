from __future__ import annotations

import unittest
import io
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Callable

from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from scripts.ingest_safety_reference_catalog import ReferenceItem, ReferenceSource
from scripts import snapshot_kosha_guide_corpus
from scripts.snapshot_kosha_guide_corpus import build_snapshot


def build_pdf_bytes(page_texts: list[str], image_pages: set[int] | None = None) -> bytes:
    writer = PdfWriter()
    image_pages = image_pages or set()
    for page_index, text in enumerate(page_texts, start=1):
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        resources = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): writer._add_object(font)}
                )
            }
        )
        content = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        commands = [f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET"]
        if page_index in image_pages:
            image = DecodedStreamObject()
            image.set_data(b"\x00")
            image.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Image"),
                    NameObject("/Width"): NumberObject(1),
                    NameObject("/Height"): NumberObject(1),
                    NameObject("/ColorSpace"): NameObject("/DeviceGray"),
                    NameObject("/BitsPerComponent"): NumberObject(8),
                }
            )
            resources[NameObject("/XObject")] = DictionaryObject(
                {NameObject("/Im1"): writer._add_object(image)}
            )
            commands.append("q 1 0 0 1 0 0 cm /Im1 Do Q")
        content.set_data("\n".join(commands).encode("ascii"))
        page[NameObject("/Resources")] = resources
        page[NameObject("/Contents")] = writer._add_object(content)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


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
        self.assertEqual(snapshot["parseStats"]["parseEmptyOutputCount"], 0)
        self.assertEqual(snapshot["parseStats"]["parseFailureCount"], 0)
        self.assertTrue(snapshot["parseStats"]["accountingMatches"])

    def test_separates_usable_empty_output_and_hard_failure_for_attempted_pdfs(self) -> None:
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
        empty_output = ReferenceItem(
            id="empty-output",
            source_id=source.id,
            item_type="technical-support-regulation",
            category="전기안전분야",
            subcategory="기술지원규정",
            title="B-E-19-2026 empty output",
            summary="fallback",
            body="   ",
            keywords=[],
            risk_tags=[],
            primary_documents=[],
            controls=[],
            payload={"internalPath": "B-E-19-2026 empty output.pdf", "isPriority": True},
        )

        def parser(folder: Path, max_pdf_pages: int, priority_only: bool) -> tuple[ReferenceSource, list[ReferenceItem]]:
            print("[warn] PDF text extraction failed: B-E-18-2026 failed.pdf (fixture)")
            return source, [good, failed, empty_output]

        snapshot = build_snapshot(Path("C:/fixture"), 3, parser)

        self.assertEqual(snapshot["parseStats"]["rowsReturned"], 3)
        self.assertEqual(snapshot["parseStats"]["parseAttemptedCount"], 3)
        self.assertEqual(snapshot["parseStats"]["parseSuccessCount"], 1)
        self.assertEqual(snapshot["parseStats"]["parseEmptyOutputCount"], 1)
        self.assertEqual(snapshot["parseStats"]["parseFailureCount"], 1)
        self.assertTrue(snapshot["parseStats"]["accountingMatches"])
        self.assertEqual(
            snapshot["parseStats"]["outcomes"],
            [
                {"internalPath": "B-E-17-2026 good.pdf", "status": "success"},
                {"internalPath": "B-E-18-2026 failed.pdf", "status": "failure"},
                {"internalPath": "B-E-19-2026 empty output.pdf", "status": "empty_output"},
            ],
        )

    def test_parse_accounting_fails_closed_on_count_mismatch(self) -> None:
        self.assertTrue(hasattr(snapshot_kosha_guide_corpus, "validate_parse_accounting"))
        stats = {
            "rowsReturned": 2,
            "parseAttemptedCount": 2,
            "parseSuccessCount": 2,
            "parseEmptyOutputCount": 0,
            "parseFailureCount": 1,
            "outcomes": [],
        }

        validated = snapshot_kosha_guide_corpus.validate_parse_accounting(stats, expected_pdf_rows=3)

        self.assertFalse(validated["accountingMatches"])
        self.assertEqual(
            validated["mismatches"],
            ["rows-returned:2/3", "parse-outcomes:3/2", "outcome-rows:0/2"],
        )


class KoshaBodyRecoveryTest(unittest.TestCase):
    def write_zip(self, root: Path, members: dict[str, bytes]) -> Path:
        zip_path = root / "[2025] 기술지원규정(테스트분야).zip"
        with zipfile.ZipFile(zip_path, "w") as archive:
            for name, data in members.items():
                archive.writestr(name, data)
        return zip_path

    def read_jsonl(self, path: Path) -> list[dict[str, object]]:
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]

    def run_recovery(
        self,
        source: Path,
        output_dir: Path,
        *,
        resume: bool = False,
        max_files: int | None = None,
        chunk_chars: int = 200,
    ) -> dict[str, object]:
        return snapshot_kosha_guide_corpus.recover_corpus(
            source=source,
            output_dir=output_dir,
            resume=resume,
            max_files=max_files,
            category=None,
            state=None,
            chunk_chars=chunk_chars,
            provenance_path=None,
        )

    def test_extracts_every_page_and_includes_technical_guidelines(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 일반 기술지침.pdf": build_pdf_bytes(["first page", "second page"])},
            )
            output_dir = root / "output"

            self.run_recovery(source, output_dir)

            items = self.read_jsonl(output_dir / "items.jsonl")
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["item_type"], "technical-guideline")
            self.assertEqual(items[0]["page_count"], 2)
            self.assertEqual(len(items[0]["pages"]), 2)
            self.assertIn("first page", items[0]["body"])
            self.assertIn("second page", items[0]["body"])

    def test_marks_page_and_document_ocr_candidates_without_running_ocr(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-2-2025 이미지 기술지침.pdf": build_pdf_bytes(
                        ["A" * 600, "scan"], image_pages={2}
                    )
                },
            )
            output_dir = root / "output"

            self.run_recovery(source, output_dir)

            item = self.read_jsonl(output_dir / "items.jsonl")[0]
            pages = item["pages"]
            self.assertFalse(pages[0]["ocr_candidate"])
            self.assertTrue(pages[1]["has_image"])
            self.assertLess(pages[1]["normalized_char_count"], 80)
            self.assertTrue(pages[1]["ocr_candidate"])
            self.assertTrue(item["ocr_candidate"])
            self.assertIn("image-low-text-page", item["ocr_candidate_reasons"])

    def test_resume_processes_only_remaining_members(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first body"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second body"]),
                },
            )
            output_dir = root / "output"

            first = self.run_recovery(source, output_dir, max_files=1)
            second = self.run_recovery(source, output_dir, resume=True)

            self.assertEqual(first["processed_this_run"], 1)
            self.assertEqual(second["processed_this_run"], 1)
            self.assertEqual(len(self.read_jsonl(output_dir / "items.jsonl")), 2)
            checkpoint = json.loads((output_dir / "checkpoint.json").read_text(encoding="utf-8"))
            self.assertEqual(checkpoint["completed_count"], 2)

    def test_hashes_and_outputs_are_stable_across_clean_runs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 stable.pdf": build_pdf_bytes(["stable body text"])},
            )
            first_output = root / "first"
            second_output = root / "second"

            first = self.run_recovery(source, first_output)
            second = self.run_recovery(source, second_output)

            self.assertEqual(first["reproducibility_hash"], second["reproducibility_hash"])
            for name in ["manifest.json", "items.jsonl", "chunks.jsonl", "failures.jsonl", "checkpoint.json"]:
                self.assertEqual((first_output / name).read_bytes(), (second_output / name).read_bytes())

    def test_initial_manifest_report_and_zero_work_resume_share_one_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 canonical.pdf": build_pdf_bytes(["canonical body text"])},
            )
            output_dir = root / "output"
            report_dir = root / "evaluation"

            initial = self.run_recovery(source, output_dir)
            snapshot_kosha_guide_corpus.write_quality_report(
                initial, output_dir, report_dir, 1.25
            )
            resumed = self.run_recovery(source, output_dir, resume=True)
            manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
            report = json.loads((report_dir / "report.json").read_text(encoding="utf-8"))

            canonical_hash = initial["reproducibility_hash"]
            self.assertEqual(manifest["reproducibility_hash"], canonical_hash)
            self.assertEqual(report["reproducibility_hash"], canonical_hash)
            self.assertEqual(resumed["reproducibility_hash"], canonical_hash)
            self.assertEqual(resumed["processed_this_run"], 0)
            descriptor = initial["manifest_output"]
            manifest_path = Path(descriptor["path"])
            self.assertTrue(manifest_path.is_file())
            self.assertEqual(descriptor["size_bytes"], manifest_path.stat().st_size)
            self.assertEqual(
                descriptor["sha256"], hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            )

    def test_cli_stdout_exposes_existing_manifest_descriptor(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 cli.pdf": build_pdf_bytes(["CLI body text"])},
            )
            output_dir = root / "output"
            result = subprocess.run(
                [
                    sys.executable,
                    "scripts/snapshot_kosha_guide_corpus.py",
                    "--source",
                    str(source),
                    "--output-dir",
                    str(output_dir),
                ],
                cwd=repo_root,
                capture_output=True,
                check=False,
                text=True,
                encoding="utf-8",
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            descriptor = payload["manifest"]
            self.assertIsInstance(descriptor, dict)
            manifest_path = Path(descriptor["path"])
            self.assertTrue(manifest_path.is_file())
            self.assertEqual(descriptor["size_bytes"], manifest_path.stat().st_size)
            self.assertEqual(
                descriptor["sha256"], hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            )
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["reproducibility_hash"], manifest["reproducibility_hash"])

    def test_empty_and_corrupt_pdfs_fail_closed_and_remain_in_ledger(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 valid.pdf": build_pdf_bytes(["valid body"]),
                    "G-2-2025 empty.pdf": b"",
                    "G-3-2025 corrupt.pdf": b"not a pdf",
                },
            )
            output_dir = root / "output"

            self.run_recovery(source, output_dir)

            items = self.read_jsonl(output_dir / "items.jsonl")
            failures = self.read_jsonl(output_dir / "failures.jsonl")
            chunks = self.read_jsonl(output_dir / "chunks.jsonl")
            self.assertEqual(len(items), 3)
            self.assertEqual(len(failures), 2)
            self.assertEqual({failure["error_code"] for failure in failures}, {"zero-byte-pdf", "bad-pdf"})
            self.assertEqual(len(chunks), 1)
            failed_items = [item for item in items if item["extraction_status"] == "failure"]
            self.assertEqual(len(failed_items), 2)
            self.assertTrue(all("body" not in item for item in failed_items))

    def test_chunks_preserve_item_and_page_source_spans(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 chunks.pdf": build_pdf_bytes(["alpha beta gamma delta", "epsilon zeta"])},
            )
            output_dir = root / "output"

            self.run_recovery(source, output_dir, chunk_chars=12)

            item = self.read_jsonl(output_dir / "items.jsonl")[0]
            chunks = self.read_jsonl(output_dir / "chunks.jsonl")
            self.assertGreater(len(chunks), 2)
            self.assertEqual("".join(chunk["text"] for chunk in chunks).replace(" ", ""), item["body"].replace("\n", "").replace(" ", ""))
            for chunk in chunks:
                self.assertEqual(chunk["item_id"], item["item_id"])
                self.assertEqual(chunk["page_start"], chunk["page_end"])
                self.assertEqual(len(chunk["source_spans"]), 1)
                span = chunk["source_spans"][0]
                self.assertEqual(span["page_number"], chunk["page_start"])
                self.assertLess(span["char_start"], span["char_end"])

    def test_jsonl_resume_treats_only_lf_as_a_record_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "items.jsonl"
            rows = [{"body": "before\u2028after", "item_id": "fixture"}]
            snapshot_kosha_guide_corpus._write_jsonl(path, rows)

            self.assertEqual(snapshot_kosha_guide_corpus._read_jsonl(path), rows)


if __name__ == "__main__":
    unittest.main()
