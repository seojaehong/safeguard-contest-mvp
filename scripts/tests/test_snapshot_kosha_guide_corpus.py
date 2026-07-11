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
from typing import Callable, Iterable
from unittest.mock import patch

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError
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
    def load_corpus_schema(self) -> dict[str, object]:
        schema_path = (
            Path(__file__).resolve().parents[2]
            / "data"
            / "safety-knowledge"
            / "kosha-body-corpus.schema.json"
        )
        return json.loads(schema_path.read_text(encoding="utf-8"))

    def write_zip(
        self,
        root: Path,
        members: dict[str, bytes],
        compression: int = zipfile.ZIP_STORED,
    ) -> Path:
        zip_path = root / "[2025] 기술지원규정(테스트분야).zip"
        with zipfile.ZipFile(zip_path, "w", compression=compression) as archive:
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
        provenance_path: Path | None = None,
        resource_limits: snapshot_kosha_guide_corpus.ResourceLimits | None = None,
        progress: Callable[[int, int, str], None] | None = None,
        publication_hook: Callable[[str], None] | None = None,
    ) -> dict[str, object]:
        kwargs: dict[str, object] = {}
        if resource_limits is not None:
            kwargs["resource_limits"] = resource_limits
        if publication_hook is not None:
            kwargs["publication_hook"] = publication_hook
        return snapshot_kosha_guide_corpus.recover_corpus(
            source=source,
            output_dir=output_dir,
            resume=resume,
            max_files=max_files,
            category=None,
            state=None,
            chunk_chars=chunk_chars,
            provenance_path=provenance_path,
            progress=progress,
            **kwargs,
        )

    def snapshot_dir(self, summary: dict[str, object]) -> Path:
        value = summary["snapshot_dir"]
        self.assertIsInstance(value, str)
        return Path(value)

    def test_extracts_every_page_and_includes_technical_guidelines(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 일반 기술지침.pdf": build_pdf_bytes(["first page", "second page"])},
            )
            output_dir = root / "output"

            summary = self.run_recovery(source, output_dir)

            items = self.read_jsonl(self.snapshot_dir(summary) / "items.jsonl")
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

            summary = self.run_recovery(source, output_dir)

            item = self.read_jsonl(self.snapshot_dir(summary) / "items.jsonl")[0]
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
            self.assertEqual(first["status"], "staged")
            self.assertFalse((output_dir / "current.json").exists())
            self.assertEqual(first["processed_this_run"], 1)
            second = self.run_recovery(source, output_dir, resume=True)
            self.assertEqual(second["processed_this_run"], 1)
            snapshot_dir = self.snapshot_dir(second)
            self.assertEqual(len(self.read_jsonl(snapshot_dir / "items.jsonl")), 2)
            checkpoint = json.loads((snapshot_dir / "checkpoint.json").read_text(encoding="utf-8"))
            self.assertEqual(checkpoint["completed_count"], 2)
            clean = self.run_recovery(source, root / "clean-output")
            self.assertEqual(second["reproducibility_hash"], clean["reproducibility_hash"])

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
            first_snapshot = self.snapshot_dir(first)
            second_snapshot = self.snapshot_dir(second)
            for name in ["manifest.json", "items.jsonl", "chunks.jsonl", "failures.jsonl", "checkpoint.json"]:
                self.assertEqual((first_snapshot / name).read_bytes(), (second_snapshot / name).read_bytes())

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
            current_before = (output_dir / "current.json").read_bytes()
            resumed = self.run_recovery(source, output_dir, resume=True)
            snapshot_kosha_guide_corpus.write_quality_report(
                resumed, output_dir, report_dir, 0.25
            )
            manifest = json.loads((self.snapshot_dir(initial) / "manifest.json").read_text(encoding="utf-8"))
            report = json.loads((report_dir / "report.json").read_text(encoding="utf-8"))

            canonical_hash = initial["reproducibility_hash"]
            self.assertEqual(manifest["reproducibility_hash"], canonical_hash)
            self.assertEqual(report["reproducibility_hash"], canonical_hash)
            self.assertEqual(resumed["reproducibility_hash"], canonical_hash)
            self.assertEqual(resumed["processed_this_run"], 0)
            self.assertEqual((output_dir / "current.json").read_bytes(), current_before)
            self.assertEqual(report["elapsed_seconds"], 1.25)
            self.assertEqual(report["snapshot_elapsed_seconds"], 1.25)
            self.assertEqual(report["invocation_elapsed_seconds"], 0.25)
            self.assertEqual(report["elapsed_semantics"], "preserved_snapshot_build_wall_time")
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

            summary = self.run_recovery(source, output_dir)

            snapshot_dir = self.snapshot_dir(summary)
            items = self.read_jsonl(snapshot_dir / "items.jsonl")
            failures = self.read_jsonl(snapshot_dir / "failures.jsonl")
            chunks = self.read_jsonl(snapshot_dir / "chunks.jsonl")
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

            summary = self.run_recovery(source, output_dir, chunk_chars=12)

            snapshot_dir = self.snapshot_dir(summary)
            item = self.read_jsonl(snapshot_dir / "items.jsonl")[0]
            chunks = self.read_jsonl(snapshot_dir / "chunks.jsonl")
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

    def test_resume_rejects_staging_without_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"
            orphan = output_dir / "staging" / "orphan"
            orphan.mkdir(parents=True)
            (orphan / "items.jsonl").write_text("{}\n", encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "checkpoint"):
                self.run_recovery(source, output_dir, resume=True)

    def test_resume_rejects_legacy_root_outputs_without_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"
            output_dir.mkdir()
            (output_dir / "items.jsonl").write_text('{"source_key":"stale"}\n', encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "checkpoint|legacy"):
                self.run_recovery(source, output_dir, resume=True)

    def test_falls_back_to_chunked_zip_member_read_after_memory_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )
            output_dir = root / "output"
            original_read = zipfile.ZipFile.read

            def flaky_read(
                archive: zipfile.ZipFile,
                name: str,
                pwd: bytes | None = None,
            ) -> bytes:
                if name == "G-2-2025 second.pdf":
                    raise MemoryError("Unable to allocate output buffer.")
                return original_read(archive, name, pwd)

            with patch.object(zipfile.ZipFile, "read", autospec=True, side_effect=flaky_read):
                summary = self.run_recovery(source, output_dir)

            items = self.read_jsonl(self.snapshot_dir(summary) / "items.jsonl")
            self.assertEqual(summary["failure"], 0)
            self.assertEqual(summary["success"], 2)
            self.assertEqual(len(items), 2)
            self.assertTrue(all(item["extraction_status"] == "success" for item in items))

    def test_resume_rejects_source_identity_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )
            output_dir = root / "output"
            self.run_recovery(source, output_dir, max_files=1)
            self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["changed"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )

            with self.assertRaisesRegex(RuntimeError, "source identity"):
                self.run_recovery(source, output_dir, resume=True)

    def test_resume_rejects_generation_policy_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )
            output_dir = root / "output"
            self.run_recovery(source, output_dir, max_files=1, chunk_chars=12)

            with self.assertRaisesRegex(RuntimeError, "generation policy"):
                self.run_recovery(source, output_dir, resume=True, chunk_chars=13)

    def test_zero_work_resume_rejects_completed_policy_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"
            self.run_recovery(source, output_dir, chunk_chars=12)

            with self.assertRaisesRegex(RuntimeError, "generation policy"):
                self.run_recovery(source, output_dir, resume=True, chunk_chars=13)

    def test_zero_work_resume_rejects_missing_snapshot_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"
            initial = self.run_recovery(source, output_dir)
            (self.snapshot_dir(initial) / "checkpoint.json").unlink()

            with self.assertRaisesRegex(RuntimeError, "checkpoint"):
                self.run_recovery(source, output_dir, resume=True)

    def test_zero_work_resume_rejects_corpus_hash_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"
            initial = self.run_recovery(source, output_dir)
            with (self.snapshot_dir(initial) / "items.jsonl").open("ab") as file:
                file.write(b"{}\n")

            with self.assertRaisesRegex(RuntimeError, "hash mismatch"):
                self.run_recovery(source, output_dir, resume=True)

    def test_interruption_persists_checkpoint_and_resume_publishes_atomically(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )
            output_dir = root / "output"

            def interrupt(current: int, total: int, key: str) -> None:
                del total, key
                if current == 1:
                    raise InterruptedError("fixture interruption")

            with self.assertRaisesRegex(InterruptedError, "fixture interruption"):
                self.run_recovery(source, output_dir, progress=interrupt)

            self.assertFalse((output_dir / "current.json").exists())
            self.assertFalse((output_dir / "items.jsonl").exists())
            checkpoints = list((output_dir / "staging").glob("*/checkpoint.json"))
            self.assertEqual(len(checkpoints), 1)
            checkpoint = json.loads(checkpoints[0].read_text(encoding="utf-8"))
            self.assertEqual(checkpoint["completed_count"], 1)

            resumed = self.run_recovery(source, output_dir, resume=True)
            self.assertEqual(resumed["processed_this_run"], 1)
            self.assertTrue((output_dir / "current.json").is_file())
            self.assertEqual(len(self.read_jsonl(self.snapshot_dir(resumed) / "items.jsonl")), 2)

    def test_publication_interruption_leaves_no_mixed_root_and_can_resume(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"

            def interrupt_publication(phase: str) -> None:
                if phase == "snapshot-ready":
                    raise InterruptedError("publish interruption")

            with self.assertRaisesRegex(InterruptedError, "publish interruption"):
                self.run_recovery(source, output_dir, publication_hook=interrupt_publication)

            self.assertFalse((output_dir / "current.json").exists())
            for name in ["manifest.json", "items.jsonl", "chunks.jsonl", "failures.jsonl", "checkpoint.json"]:
                self.assertFalse((output_dir / name).exists())

            resumed = self.run_recovery(source, output_dir, resume=True)
            self.assertEqual(resumed["processed_this_run"], 0)
            self.assertTrue((output_dir / "current.json").is_file())

    def test_resume_truncates_only_uncheckpointed_tail_after_prefix_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 first.pdf": build_pdf_bytes(["first"]),
                    "G-2-2025 second.pdf": build_pdf_bytes(["second"]),
                },
            )
            output_dir = root / "output"
            staged = self.run_recovery(source, output_dir, max_files=1)
            staging_dir = Path(str(staged["staging_dir"]))
            with (staging_dir / "items.jsonl").open("ab") as file:
                file.write(b'{"partial":')

            resumed = self.run_recovery(source, output_dir, resume=True)

            self.assertEqual(resumed["processed_this_run"], 1)
            items = self.read_jsonl(self.snapshot_dir(resumed) / "items.jsonl")
            self.assertEqual(len(items), 2)
            self.assertFalse(any("partial" in item for item in items))

    def test_generation_policy_identity_is_canonical_and_zero_work_stable(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 body.pdf": build_pdf_bytes(["body"])})
            output_dir = root / "output"

            initial = self.run_recovery(source, output_dir, chunk_chars=32)
            snapshot_dir = self.snapshot_dir(initial)
            manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
            checkpoint = json.loads((snapshot_dir / "checkpoint.json").read_text(encoding="utf-8"))
            policy = manifest["generation_policy"]

            self.assertEqual(policy["chunk_chars"], 32)
            self.assertEqual(policy["ocr_thresholds"]["page_normalized_chars"], 80)
            self.assertEqual(policy["ocr_thresholds"]["document_normalized_chars"], 500)
            self.assertIn("extractor_version", policy)
            self.assertIn("resource_limits", policy)
            self.assertEqual(policy["resource_limits"]["max_member_count"], 10_000)
            self.assertEqual(manifest["generation_policy_sha256"], checkpoint["generation_policy_sha256"])
            resumed = self.run_recovery(source, output_dir, resume=True, chunk_chars=32)
            self.assertEqual(resumed["processed_this_run"], 0)
            self.assertEqual(resumed["reproducibility_hash"], initial["reproducibility_hash"])

    def test_source_identity_tracks_all_members_before_pdf_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            payload = os.urandom(4096)
            note = b"metadata-note"
            pdf_bytes = build_pdf_bytes(["body"])
            source = self.write_zip(
                root,
                {
                    "payload.bin": payload,
                    "notes.txt": note,
                    "G-1-2025 body.pdf": pdf_bytes,
                },
                compression=zipfile.ZIP_DEFLATED,
            )

            summary = self.run_recovery(source, root / "output")
            source_identity = summary["source_identity"]

            self.assertEqual(source_identity["source_member_count"], 3)
            self.assertEqual(source_identity["pdf_entry_count"], 1)
            self.assertEqual(
                source_identity["total_uncompressed_bytes"],
                len(payload) + len(note) + len(pdf_bytes),
            )
            self.assertEqual(source_identity["max_member_bytes"], len(payload))
            self.assertGreaterEqual(source_identity["max_compression_ratio"], 1.0)

    def test_rejects_oversize_and_zip_bomb_members_before_pdf_read(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"G-1-2025 large.pdf": b"x" * 1024})
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_member_bytes=100)

            with self.assertRaisesRegex(ValueError, "member.*bytes"):
                self.run_recovery(source, root / "oversize-output", resource_limits=limits)

            compressed_source = self.write_zip(
                root,
                {"G-1-2025 compressed.pdf": b"0" * 10000},
                compression=zipfile.ZIP_DEFLATED,
            )
            ratio_limits = snapshot_kosha_guide_corpus.ResourceLimits(max_compression_ratio=2.0)
            with self.assertRaisesRegex(ValueError, "compression ratio"):
                self.run_recovery(
                    compressed_source,
                    root / "ratio-output",
                    resource_limits=ratio_limits,
                )

    def test_rejects_non_pdf_member_size_limit_before_type_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "payload.bin": b"0" * (10 * 1024 * 1024),
                    "G-1-2025 body.pdf": build_pdf_bytes(["body"]),
                },
                compression=zipfile.ZIP_DEFLATED,
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_member_bytes=2 * 1024 * 1024)

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member exceeds max member bytes: .*::payload\.bin \(10485760/2097152\)",
            ):
                self.run_recovery(source, root / "output", resource_limits=limits)

    def test_rejects_non_pdf_member_compression_ratio_limit_before_type_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "payload.bin": b"0" * 20_000,
                    "G-1-2025 body.pdf": build_pdf_bytes(["body"]),
                },
                compression=zipfile.ZIP_DEFLATED,
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(
                max_member_bytes=50_000,
                max_compression_ratio=2.0,
            )

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member compression ratio exceeds limit: .*::payload\.bin",
            ):
                self.run_recovery(source, root / "output", resource_limits=limits)

    def test_rejects_non_pdf_total_uncompressed_limit_before_type_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "part-1.txt": b"a" * (1536 * 1024),
                    "part-2.txt": b"b" * (1536 * 1024),
                },
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(
                max_member_bytes=2 * 1024 * 1024,
                max_total_uncompressed_bytes=2 * 1024 * 1024,
            )

            with self.assertRaisesRegex(
                ValueError,
                r"total uncompressed ZIP member bytes exceed limit: 3145728/2097152",
            ):
                self.run_recovery(source, root / "output", resource_limits=limits)

    def test_rejects_excessive_zip_member_count_before_type_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {f"tiny-{index}.txt": b"x" for index in range(6)},
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_member_count=5)

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member count exceeds limit: 6/5",
            ):
                self.run_recovery(source, root / "output", resource_limits=limits)

    def test_page_count_limit_fails_item_closed_in_ledger(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 pages.pdf": build_pdf_bytes(["first", "second"])},
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_pages_per_pdf=1)

            summary = self.run_recovery(source, root / "output", resource_limits=limits)

            snapshot_dir = self.snapshot_dir(summary)
            item = self.read_jsonl(snapshot_dir / "items.jsonl")[0]
            failure = self.read_jsonl(snapshot_dir / "failures.jsonl")[0]
            self.assertEqual(item["extraction_status"], "failure")
            self.assertEqual(failure["error_code"], "resource-limit-pages")

    def test_jsonl_writer_streams_iterables_without_path_write_text(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "stream.jsonl"

            def rows() -> Iterable[dict[str, object]]:
                for index in range(5):
                    yield {"index": index, "body": "x" * 1024}

            with patch.object(Path, "write_text", side_effect=AssertionError("write_text buffers output")):
                snapshot_kosha_guide_corpus._write_jsonl(path, rows())

            self.assertEqual(len(self.read_jsonl(path)), 5)

    def test_json_schema_validates_generated_v2_records_and_final_artifacts(self) -> None:
        schema = self.load_corpus_schema()
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "G-1-2025 success.pdf": build_pdf_bytes(["first page", "second page"]),
                    "G-2-2025 boundary.pdf": build_pdf_bytes([""]),
                    "G-3-2025 corrupt.pdf": b"not a pdf",
                },
            )
            output_dir = root / "output"
            summary = self.run_recovery(source, output_dir, chunk_chars=8)
            snapshot_dir = self.snapshot_dir(summary)

            items = self.read_jsonl(snapshot_dir / "items.jsonl")
            chunks = self.read_jsonl(snapshot_dir / "chunks.jsonl")
            failures = self.read_jsonl(snapshot_dir / "failures.jsonl")
            current = json.loads((output_dir / "current.json").read_text(encoding="utf-8"))
            manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))

            success_item = next(item for item in items if item["extraction_status"] == "success")
            boundary_item = next(item for item in items if item["extraction_status"] == "boundary")
            failure_item = next(item for item in items if item["extraction_status"] == "failure")

            validator.validate(success_item)
            validator.validate(boundary_item)
            validator.validate(failure_item)
            validator.validate(chunks[0])
            validator.validate(failures[0])
            validator.validate(current)
            validator.validate(manifest)

    def test_json_schema_validates_generated_item_with_current_version_mismatch(self) -> None:
        validator = Draft202012Validator(self.load_corpus_schema())

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            member_name = "G-1-2025 success.pdf"
            source = self.write_zip(
                root,
                {member_name: build_pdf_bytes(["first page"])},
            )
            provenance_path = root / "provenance.json"
            provenance_path.write_text(
                json.dumps(
                    {
                        "inventory": {
                            "official": {
                                "listUrl": "https://example.test/list",
                                "apiUrl": "https://example.test/api",
                            },
                            "officialComparison": {
                                "versionMismatches": [
                                    {
                                        "internalPath": member_name,
                                        "officialCode": "G-1-2026",
                                        "localCode": "G-1-2025",
                                    }
                                ]
                            },
                        }
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            summary = self.run_recovery(
                source,
                root / "output",
                provenance_path=provenance_path,
            )

            item = self.read_jsonl(self.snapshot_dir(summary) / "items.jsonl")[0]

            self.assertEqual(item["state"], "current-version-mismatch")
            self.assertEqual(item["version_lineage"]["state"], "current-version-mismatch")
            validator.validate(item)

    def test_json_schema_rejects_legacy_policy_fixture_without_max_member_count(self) -> None:
        validator = Draft202012Validator(self.load_corpus_schema())

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 success.pdf": build_pdf_bytes(["first page"])},
            )
            summary = self.run_recovery(source, root / "output")
            manifest = json.loads(
                (self.snapshot_dir(summary) / "manifest.json").read_text(encoding="utf-8")
            )
            del manifest["generation_policy"]["resource_limits"]["max_member_count"]

            with self.assertRaisesRegex(ValidationError, "max_member_count"):
                validator.validate(manifest)


if __name__ == "__main__":
    unittest.main()
