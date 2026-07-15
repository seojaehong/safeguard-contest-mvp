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
from scripts import recover_kosha_ocr_boundary, snapshot_kosha_guide_corpus
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


def current_ocr_generator_sha256() -> str:
    return hashlib.sha256(
        Path(recover_kosha_ocr_boundary.__file__).read_bytes()
    ).hexdigest()


class StaticOcrTransport:
    def __init__(self, page_texts: list[str]) -> None:
        self._page_texts = page_texts

    def transcribe_page(
        self,
        *,
        page_number: int,
        image_png: bytes,
        image_sha256: str,
    ) -> recover_kosha_ocr_boundary.OcrPageResponse:
        self.assert_image_hash(image_png, image_sha256)
        return recover_kosha_ocr_boundary.OcrPageResponse(
            text=self._page_texts[page_number - 1],
            response_id=f"response-{page_number}",
            model="test-vision-model",
            created_at=1_783_000_000 + page_number,
            status="completed",
        )

    @staticmethod
    def assert_image_hash(image_png: bytes, image_sha256: str) -> None:
        if hashlib.sha256(image_png).hexdigest() != image_sha256:
            raise AssertionError("rendered page hash mismatch")


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
        reviewed_ocr_candidate_paths: list[Path] | None = None,
        trusted_ocr_reviewer_ids: set[str] | None = None,
        ocr_review_hmac_key: bytes | None = None,
        expected_ocr_generator_sha256: str | None = None,
    ) -> dict[str, object]:
        kwargs: dict[str, object] = {}
        if resource_limits is not None:
            kwargs["resource_limits"] = resource_limits
        if publication_hook is not None:
            kwargs["publication_hook"] = publication_hook
        if reviewed_ocr_candidate_paths is not None:
            kwargs["reviewed_ocr_candidate_paths"] = reviewed_ocr_candidate_paths
        if trusted_ocr_reviewer_ids is not None:
            kwargs["trusted_ocr_reviewer_ids"] = trusted_ocr_reviewer_ids
        if ocr_review_hmac_key is not None:
            kwargs["ocr_review_hmac_key"] = ocr_review_hmac_key
        if expected_ocr_generator_sha256 is not None:
            kwargs["expected_ocr_generator_sha256"] = expected_ocr_generator_sha256
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

    def write_reviewed_ocr_candidate(
        self,
        root: Path,
        source_pdf: Path,
        page_texts: list[str],
        *,
        item_key: str | None = None,
        reviewer_id: str = "corpus-reviewer",
        hmac_key: bytes = b"r" * 32,
    ) -> tuple[Path, dict[str, object]]:
        effective_item_key = item_key or f"<direct>::{source_pdf.name}"
        item_id = (
            f"kosha-{hashlib.sha256(effective_item_key.encode('utf-8')).hexdigest()[:24]}"
        )
        raw_sha256 = hashlib.sha256(source_pdf.read_bytes()).hexdigest()
        candidate = recover_kosha_ocr_boundary.recover_pdf_candidate(
            source_pdf=source_pdf,
            item_id=item_id,
            expected_raw_sha256=raw_sha256,
            transport=StaticOcrTransport(page_texts),
        )
        candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
            candidate,
            reviewer_id=reviewer_id,
            reviewed_at="2026-07-13T00:00:00Z",
            hmac_key=hmac_key,
        )
        candidate_path = root / "reviewed-ocr-candidate.json"
        candidate_path.write_text(
            f"{json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n",
            encoding="utf-8",
            newline="\n",
        )
        return candidate_path, candidate

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

    def test_imports_reviewed_ocr_only_for_native_empty_boundary_with_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "G-3-2025 scanned.pdf"
            source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            candidate_path, candidate = self.write_reviewed_ocr_candidate(
                root,
                source,
                ["검토 완료 OCR 본문"],
            )
            candidate_bytes = candidate_path.read_bytes()

            summary = self.run_recovery(
                source,
                root / "output",
                reviewed_ocr_candidate_paths=[candidate_path],
                trusted_ocr_reviewer_ids={"corpus-reviewer"},
                ocr_review_hmac_key=b"r" * 32,
                expected_ocr_generator_sha256=current_ocr_generator_sha256(),
            )

            snapshot_dir = self.snapshot_dir(summary)
            item = self.read_jsonl(snapshot_dir / "items.jsonl")[0]
            failures = self.read_jsonl(snapshot_dir / "failures.jsonl")
            manifest = json.loads(
                (snapshot_dir / "manifest.json").read_text(encoding="utf-8")
            )
            provenance = item["reviewed_ocr_provenance"]
            review = candidate["review"]
            self.assertEqual(item["extraction_status"], "success")
            self.assertEqual(item["body"], "검토 완료 OCR 본문")
            self.assertEqual(item["body_origin"], "human-reviewed-ocr")
            self.assertEqual(
                provenance["candidate_sha256"],
                hashlib.sha256(candidate_bytes).hexdigest(),
            )
            self.assertEqual(provenance["content_sha256"], review["content_sha256"])
            self.assertEqual(provenance["reviewed_by"], "corpus-reviewer")
            self.assertEqual(provenance["reviewed_at"], "2026-07-13T00:00:00Z")
            self.assertEqual(len(provenance["pages"]), 1)
            self.assertEqual(
                provenance["pages"][0]["image_sha256"],
                candidate["pages"][0]["image_sha256"],
            )
            self.assertEqual(failures, [])
            self.assertEqual(candidate_path.read_bytes(), candidate_bytes)
            self.assertTrue((root / "output" / "current.json").is_file())
            self.assertEqual(
                manifest["generation_policy"]["reviewed_ocr_candidates"],
                [
                    {
                        "item_id": candidate["source"]["item_id"],
                        "candidate_sha256": hashlib.sha256(candidate_bytes).hexdigest(),
                        "content_sha256": review["content_sha256"],
                        "attestation_sha256": hashlib.sha256(
                            snapshot_kosha_guide_corpus._canonical_json(review).encode(
                                "utf-8"
                            )
                        ).hexdigest(),
                    }
                ],
            )
            validator = Draft202012Validator(self.load_corpus_schema())
            validator.validate(item)
            validator.validate(manifest)
            orphaned_provenance_item = {**item}
            del orphaned_provenance_item["body_origin"]
            with self.assertRaisesRegex(ValidationError, "body_origin"):
                validator.validate(orphaned_provenance_item)
            report_dir = root / "evaluation"
            snapshot_kosha_guide_corpus.write_quality_report(
                summary,
                root / "output",
                report_dir,
                0.5,
            )
            report = json.loads((report_dir / "report.json").read_text(encoding="utf-8"))
            report_markdown = (report_dir / "report.md").read_text(encoding="utf-8")
            self.assertEqual(report["reviewed_ocr_import_count"], 1)
            self.assertIn("- body success: 1", report_markdown)
            self.assertNotIn("- native body success:", report_markdown)
            self.assertIn("Human-reviewed OCR imports: 1", report_markdown)
            self.assertIn(
                "declared human-reviewed OCR candidates were validated before import",
                report_markdown,
            )
            self.assertNotIn("No OCR result is represented as recovered text", report_markdown)

    def test_reviewed_ocr_canonical_pages_drive_spans_hashes_and_chunks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "G-3-2025 multi-page-scanned.pdf"
            source.write_bytes(build_pdf_bytes(["", ""], image_pages={1, 2}))
            candidate_path, candidate = self.write_reviewed_ocr_candidate(
                root,
                source,
                ["placeholder one", "placeholder two"],
            )
            raw_page_texts = [
                "  first   line\r\nsecond\t\tline  \r\n\r\n  ",
                "\rthird\u00a0\u00a0line\r\n\r\n\r\n fourth   line \r",
            ]
            canonical_page_texts = [
                recover_kosha_ocr_boundary._normalize_text(text)
                for text in raw_page_texts
            ]
            candidate_pages = candidate["pages"]
            self.assertIsInstance(candidate_pages, list)
            for candidate_page, raw_text, canonical_text in zip(
                candidate_pages,
                raw_page_texts,
                canonical_page_texts,
                strict=True,
            ):
                self.assertIsInstance(candidate_page, dict)
                candidate_page["text"] = raw_text
                candidate_page["text_sha256"] = hashlib.sha256(
                    canonical_text.encode("utf-8")
                ).hexdigest()
                candidate_page["normalized_char_count"] = len(
                    "".join(canonical_text.split())
                )
            expected_body = "\n".join(canonical_page_texts)
            candidate["body"] = expected_body
            candidate["body_sha256"] = hashlib.sha256(
                expected_body.encode("utf-8")
            ).hexdigest()
            candidate["normalized_char_count"] = len("".join(expected_body.split()))
            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T00:00:00Z",
                hmac_key=b"r" * 32,
            )
            candidate_path.write_text(
                f"{json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n",
                encoding="utf-8",
                newline="\n",
            )

            summary = self.run_recovery(
                source,
                root / "output",
                chunk_chars=7,
                reviewed_ocr_candidate_paths=[candidate_path],
                trusted_ocr_reviewer_ids={"corpus-reviewer"},
                ocr_review_hmac_key=b"r" * 32,
                expected_ocr_generator_sha256=current_ocr_generator_sha256(),
            )

            snapshot_dir = self.snapshot_dir(summary)
            item = self.read_jsonl(snapshot_dir / "items.jsonl")[0]
            chunks = self.read_jsonl(snapshot_dir / "chunks.jsonl")
            self.assertEqual(item["body"], expected_body)
            rejoined_pages: list[str] = []
            expected_start = 0
            for page_number, (page, canonical_text) in enumerate(
                zip(item["pages"], canonical_page_texts, strict=True),
                start=1,
            ):
                page_start = page["body_char_start"]
                page_end = page["body_char_end"]
                self.assertEqual(page_start, expected_start)
                self.assertEqual(page_end, page_start + len(canonical_text))
                self.assertEqual(page["char_count"], len(canonical_text))
                self.assertEqual(
                    page["normalized_text_sha256"],
                    hashlib.sha256(
                        snapshot_kosha_guide_corpus._normalized_for_hash(
                            canonical_text
                        ).encode("utf-8")
                    ).hexdigest(),
                )
                page_text = expected_body[page_start:page_end]
                self.assertEqual(page_text, canonical_text)
                rejoined_pages.append(page_text)
                page_chunks = [
                    chunk for chunk in chunks if chunk["page_start"] == page_number
                ]
                self.assertEqual(
                    "".join(str(chunk["text"]) for chunk in page_chunks),
                    canonical_text,
                )
                for chunk in page_chunks:
                    span = chunk["source_spans"][0]
                    self.assertEqual(
                        chunk["text"],
                        canonical_text[span["char_start"]:span["char_end"]],
                    )
                expected_start = page_end + (
                    1 if page_number < len(canonical_page_texts) else 0
                )
            self.assertEqual("\n".join(rejoined_pages), expected_body)
            self.assertEqual(
                len(chunks),
                sum((len(text) + 6) // 7 for text in canonical_page_texts),
            )

    def test_rejects_reviewed_ocr_overwrite_of_native_success_without_publishing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "G-4-2025 native.pdf"
            source.write_bytes(build_pdf_bytes(["native text remains authoritative"]))
            candidate_path, _candidate = self.write_reviewed_ocr_candidate(
                root,
                source,
                ["OCR must not replace native text"],
            )
            output_dir = root / "output"

            with self.assertRaisesRegex(
                RuntimeError,
                "reviewed OCR candidate cannot overwrite native extraction",
            ):
                self.run_recovery(
                    source,
                    output_dir,
                    reviewed_ocr_candidate_paths=[candidate_path],
                    trusted_ocr_reviewer_ids={"corpus-reviewer"},
                    ocr_review_hmac_key=b"r" * 32,
                    expected_ocr_generator_sha256=current_ocr_generator_sha256(),
                )

            self.assertFalse(output_dir.exists())

    def test_imports_reviewed_ocr_candidates_for_two_distinct_items(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_dir = root / "source"
            first_candidate_dir = root / "first-candidate"
            second_candidate_dir = root / "second-candidate"
            source_dir.mkdir()
            first_candidate_dir.mkdir()
            second_candidate_dir.mkdir()
            first_source = source_dir / "G-4-2025 first-scanned.pdf"
            second_source = source_dir / "G-5-2025 second-scanned.pdf"
            first_source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            second_source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            first_candidate, first_payload = self.write_reviewed_ocr_candidate(
                first_candidate_dir,
                first_source,
                ["첫 번째 검토 본문"],
            )
            second_candidate, second_payload = self.write_reviewed_ocr_candidate(
                second_candidate_dir,
                second_source,
                ["두 번째 검토 본문"],
            )
            output_dir = root / "output"

            summary = self.run_recovery(
                source_dir,
                output_dir,
                reviewed_ocr_candidate_paths=[first_candidate, second_candidate],
                trusted_ocr_reviewer_ids={"corpus-reviewer"},
                ocr_review_hmac_key=b"r" * 32,
                expected_ocr_generator_sha256=current_ocr_generator_sha256(),
            )

            items = self.read_jsonl(self.snapshot_dir(summary) / "items.jsonl")
            manifest = json.loads(
                (self.snapshot_dir(summary) / "manifest.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(summary["inventory"], 2)
            self.assertEqual(summary["success"], 2)
            self.assertEqual(summary["boundary"], 0)
            self.assertEqual(
                {item["body"] for item in items},
                {"첫 번째 검토 본문", "두 번째 검토 본문"},
            )
            self.assertTrue(
                all(item["body_origin"] == "human-reviewed-ocr" for item in items)
            )
            self.assertEqual(
                {
                    row["item_id"]
                    for row in manifest["generation_policy"][
                        "reviewed_ocr_candidates"
                    ]
                },
                {
                    first_payload["source"]["item_id"],
                    second_payload["source"]["item_id"],
                },
            )

    def test_rejects_two_reviewed_ocr_candidates_for_the_same_item(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            first_candidate_dir = root / "first-candidate"
            second_candidate_dir = root / "second-candidate"
            first_candidate_dir.mkdir()
            second_candidate_dir.mkdir()
            source = root / "G-4-2025 scanned.pdf"
            source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            first_candidate, _ = self.write_reviewed_ocr_candidate(
                first_candidate_dir,
                source,
                ["첫 번째 검토 본문"],
                reviewer_id="corpus-reviewer-a",
            )
            second_candidate, _ = self.write_reviewed_ocr_candidate(
                second_candidate_dir,
                source,
                ["두 번째 검토 본문"],
                reviewer_id="corpus-reviewer-b",
            )
            output_dir = root / "output"

            with self.assertRaisesRegex(
                RuntimeError,
                "duplicate reviewed OCR candidate for item",
            ):
                self.run_recovery(
                    source,
                    output_dir,
                    reviewed_ocr_candidate_paths=[first_candidate, second_candidate],
                    trusted_ocr_reviewer_ids={
                        "corpus-reviewer-a",
                        "corpus-reviewer-b",
                    },
                    ocr_review_hmac_key=b"r" * 32,
                    expected_ocr_generator_sha256=current_ocr_generator_sha256(),
                )

            self.assertFalse(output_dir.exists())

    def test_rejects_duplicate_reviewed_ocr_attestation_across_items(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source_dir = root / "source"
            first_candidate_dir = root / "first-candidate"
            second_candidate_dir = root / "second-candidate"
            source_dir.mkdir()
            first_candidate_dir.mkdir()
            second_candidate_dir.mkdir()
            first_source = source_dir / "G-4-2025 first-scanned.pdf"
            second_source = source_dir / "G-5-2025 second-scanned.pdf"
            first_source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            second_source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            first_candidate, first_payload = self.write_reviewed_ocr_candidate(
                first_candidate_dir,
                first_source,
                ["첫 번째 검토 본문"],
            )
            second_candidate, second_payload = self.write_reviewed_ocr_candidate(
                second_candidate_dir,
                second_source,
                ["두 번째 검토 본문"],
            )
            second_payload["review"] = first_payload["review"]
            second_candidate.write_text(
                f"{snapshot_kosha_guide_corpus._canonical_json(second_payload)}\n",
                encoding="utf-8",
                newline="\n",
            )
            output_dir = root / "output"

            with self.assertRaisesRegex(
                RuntimeError,
                "duplicate reviewed OCR candidate attestation",
            ):
                self.run_recovery(
                    source_dir,
                    output_dir,
                    reviewed_ocr_candidate_paths=[first_candidate, second_candidate],
                    trusted_ocr_reviewer_ids={"corpus-reviewer"},
                    ocr_review_hmac_key=b"r" * 32,
                    expected_ocr_generator_sha256=current_ocr_generator_sha256(),
                )

            self.assertFalse(output_dir.exists())

    def test_resume_rejects_changed_reviewed_ocr_candidate_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            boundary_member = "G-6-2025 scanned.pdf"
            boundary_pdf = build_pdf_bytes([""], image_pages={1})
            source = self.write_zip(
                root,
                {
                    "G-5-2025 native.pdf": build_pdf_bytes(["native first item"]),
                    boundary_member: boundary_pdf,
                },
            )
            candidate_source = root / "candidate-source.pdf"
            candidate_source.write_bytes(boundary_pdf)
            candidate_path, candidate = self.write_reviewed_ocr_candidate(
                root,
                candidate_source,
                ["검토 완료 OCR 본문"],
                item_key=f"{source.name}::{boundary_member}",
            )
            generator_sha256 = current_ocr_generator_sha256()
            output_dir = root / "output"

            first = self.run_recovery(
                source,
                output_dir,
                max_files=1,
                reviewed_ocr_candidate_paths=[candidate_path],
                trusted_ocr_reviewer_ids={"corpus-reviewer"},
                ocr_review_hmac_key=b"r" * 32,
                expected_ocr_generator_sha256=generator_sha256,
            )
            original_digest = hashlib.sha256(candidate_path.read_bytes()).hexdigest()
            self.assertEqual(first["status"], "staged")

            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T01:00:00Z",
                hmac_key=b"r" * 32,
            )
            candidate_path.write_text(
                f"{json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n",
                encoding="utf-8",
                newline="\n",
            )
            self.assertNotEqual(
                hashlib.sha256(candidate_path.read_bytes()).hexdigest(),
                original_digest,
            )

            with self.assertRaisesRegex(RuntimeError, "resume generation policy mismatch"):
                self.run_recovery(
                    source,
                    output_dir,
                    resume=True,
                    reviewed_ocr_candidate_paths=[candidate_path],
                    trusted_ocr_reviewer_ids={"corpus-reviewer"},
                    ocr_review_hmac_key=b"r" * 32,
                    expected_ocr_generator_sha256=generator_sha256,
                )

            self.assertFalse((output_dir / "current.json").exists())

    def test_cli_imports_declared_reviewed_ocr_candidate_without_network(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "G-7-2025 scanned.pdf"
            source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            candidate_path, _candidate = self.write_reviewed_ocr_candidate(
                root,
                source,
                ["CLI 검토 완료 본문"],
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
                    "--provenance",
                    "",
                    "--reviewed-ocr-candidate",
                    str(candidate_path),
                    "--trusted-ocr-reviewer-id",
                    "corpus-reviewer",
                    "--expected-ocr-generator-sha256",
                    current_ocr_generator_sha256(),
                ],
                cwd=repo_root,
                capture_output=True,
                check=False,
                text=True,
                encoding="utf-8",
                env={**os.environ, "KOSHA_OCR_REVIEW_HMAC_KEY": "r" * 32},
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            item = self.read_jsonl(Path(payload["snapshot_dir"]) / "items.jsonl")[0]
            self.assertEqual(item["body_origin"], "human-reviewed-ocr")
            self.assertEqual(item["body"], "CLI 검토 완료 본문")

    def test_declared_draft_ocr_candidate_fails_closed_before_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "G-8-2025 scanned.pdf"
            source.write_bytes(build_pdf_bytes([""], image_pages={1}))
            candidate_path, candidate = self.write_reviewed_ocr_candidate(
                root,
                source,
                ["아직 승인되지 않은 OCR 본문"],
            )
            candidate["review"] = {
                "state": "draft",
                "human_confirmed": False,
                "reviewed_by": None,
                "reviewed_at": None,
            }
            candidate_path.write_text(
                f"{json.dumps(candidate, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n",
                encoding="utf-8",
                newline="\n",
            )
            output_dir = root / "output"

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_not_human_confirmed",
            ):
                self.run_recovery(
                    source,
                    output_dir,
                    reviewed_ocr_candidate_paths=[candidate_path],
                    trusted_ocr_reviewer_ids={"corpus-reviewer"},
                    ocr_review_hmac_key=b"r" * 32,
                    expected_ocr_generator_sha256=current_ocr_generator_sha256(),
                )

            self.assertFalse(output_dir.exists())

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
            report_markdown = (report_dir / "report.md").read_text(encoding="utf-8")

            canonical_hash = initial["reproducibility_hash"]
            self.assertEqual(manifest["reproducibility_hash"], canonical_hash)
            self.assertEqual(report["reproducibility_hash"], canonical_hash)
            self.assertNotIn("reviewed_ocr_import_count", report)
            self.assertIn("- native body success: 1", report_markdown)
            self.assertNotIn("- body success: 1", report_markdown)
            self.assertNotIn("Human-reviewed OCR imports", report_markdown)
            self.assertNotIn("human-reviewed OCR candidates", report_markdown)
            self.assertIn(
                "- OCR candidates are boundaries only. No OCR result is represented as recovered text.",
                report_markdown,
            )
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

    def test_two_zero_work_reports_never_promote_validation_time_to_build_time(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 validation-only.pdf": build_pdf_bytes(["body"])},
            )
            output_dir = root / "output"
            report_dir = root / "evaluation"
            self.run_recovery(source, output_dir)

            first_noop = self.run_recovery(source, output_dir, resume=True)
            snapshot_kosha_guide_corpus.write_quality_report(
                first_noop,
                output_dir,
                report_dir,
                0.25,
            )
            first_report = json.loads(
                (report_dir / "report.json").read_text(encoding="utf-8")
            )
            self.assertEqual(first_report["elapsed_seconds"], 0.25)
            self.assertEqual(
                first_report["elapsed_semantics"],
                "resume_validation_wall_time_only",
            )

            second_noop = self.run_recovery(source, output_dir, resume=True)
            snapshot_kosha_guide_corpus.write_quality_report(
                second_noop,
                output_dir,
                report_dir,
                0.1,
            )
            second_report = json.loads(
                (report_dir / "report.json").read_text(encoding="utf-8")
            )

            self.assertEqual(second_report["elapsed_seconds"], 0.1)
            self.assertEqual(second_report["snapshot_elapsed_seconds"], 0.1)
            self.assertEqual(second_report["invocation_elapsed_seconds"], 0.1)
            self.assertEqual(
                second_report["elapsed_semantics"],
                "resume_validation_wall_time_only",
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

    def test_identity_hash_normalizes_integral_floats_for_cross_runtime_canonicalization(
        self,
    ) -> None:
        material = {
            "max_compression_ratio": 100.0,
            "nested": {"limit": 2.0, "fraction": 2.5},
        }
        expected_canonical = (
            '{"max_compression_ratio":100,"nested":{"fraction":2.5,"limit":2}}'
        )

        self.assertEqual(
            snapshot_kosha_guide_corpus._identity_sha256(material),
            hashlib.sha256(expected_canonical.encode("utf-8")).hexdigest(),
        )

    def test_native_only_policy_and_resume_match_base_contract(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"G-1-2025 native.pdf": build_pdf_bytes(["native body"])},
            )
            output_dir = root / "output"
            provenance = {
                "official_list_url": snapshot_kosha_guide_corpus.OFFICIAL_LIST_URL,
                "official_api_url": snapshot_kosha_guide_corpus.OFFICIAL_API_URL,
                "official_snapshot": None,
                "lineage_by_member": {},
            }
            provenance_json = json.dumps(
                provenance,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
            expected_policy = {
                "schema_version": snapshot_kosha_guide_corpus.CORPUS_SCHEMA_VERSION,
                "extractor_version": snapshot_kosha_guide_corpus.EXTRACTOR_VERSION,
                "pypdf_version": snapshot_kosha_guide_corpus.PYPDF_VERSION,
                "chunk_chars": 200,
                "filters": {"category": None, "state": None},
                "ocr_thresholds": {
                    "page_requires_image": True,
                    "page_normalized_chars": (
                        snapshot_kosha_guide_corpus.PAGE_OCR_CHAR_THRESHOLD
                    ),
                    "document_normalized_chars": (
                        snapshot_kosha_guide_corpus.DOCUMENT_OCR_CHAR_THRESHOLD
                    ),
                },
                "resource_limits": {
                    "max_member_count": 10_000,
                    "max_member_bytes": 64 * 1024 * 1024,
                    "max_compression_ratio": 100.0,
                    "max_total_uncompressed_bytes": 1024 * 1024 * 1024,
                    "max_pages_per_pdf": 2000,
                    "max_normalized_chars_per_pdf": 2_000_000,
                },
                "provenance_identity_sha256": hashlib.sha256(
                    provenance_json.encode("utf-8")
                ).hexdigest(),
                "normalization": "NFKC+line-ending+horizontal-whitespace/v1",
                "chunking": "per-page-fixed-character-span/v1",
            }
            expected_policy_json = json.dumps(
                expected_policy,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )

            initial = self.run_recovery(source, output_dir)
            snapshot_dir = self.snapshot_dir(initial)
            manifest = json.loads(
                (snapshot_dir / "manifest.json").read_text(encoding="utf-8")
            )
            current_before_resume = (output_dir / "current.json").read_bytes()

            self.assertEqual(manifest["generation_policy"], expected_policy)
            self.assertNotIn("reviewed_ocr_candidates", manifest["generation_policy"])
            self.assertEqual(
                json.dumps(
                    manifest["generation_policy"],
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ),
                expected_policy_json,
            )
            self.assertEqual(
                manifest["generation_policy_sha256"],
                snapshot_kosha_guide_corpus._identity_sha256(expected_policy),
            )

            resumed = self.run_recovery(source, output_dir, resume=True)

            self.assertEqual(resumed["processed_this_run"], 0)
            self.assertEqual(resumed["generation_policy"], expected_policy)
            self.assertEqual(resumed["reproducibility_hash"], initial["reproducibility_hash"])
            self.assertEqual((output_dir / "current.json").read_bytes(), current_before_resume)

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

    def test_directory_entries_count_toward_zip_member_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "first/": b"",
                    "second/": b"",
                },
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_member_count=1)

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member count exceeds limit: 2/1",
            ):
                snapshot_kosha_guide_corpus._discover_entries(source, limits)

    def test_directory_entry_declared_size_obeys_member_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(root, {"oversize/": b"x" * 64})
            limits = snapshot_kosha_guide_corpus.ResourceLimits(max_member_bytes=32)

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member exceeds max member bytes: .*::oversize/ \(64/32\)",
            ):
                snapshot_kosha_guide_corpus._discover_entries(source, limits)

    def test_directory_entry_obeys_compression_ratio_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {"compressed/": b"0" * 20_000},
                compression=zipfile.ZIP_DEFLATED,
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(
                max_member_bytes=50_000,
                max_compression_ratio=2.0,
            )

            with self.assertRaisesRegex(
                ValueError,
                r"ZIP member compression ratio exceeds limit: .*::compressed/",
            ):
                snapshot_kosha_guide_corpus._discover_entries(source, limits)

    def test_directory_entry_bytes_obey_total_uncompressed_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = self.write_zip(
                root,
                {
                    "first/": b"a" * 700,
                    "second/": b"b" * 700,
                },
            )
            limits = snapshot_kosha_guide_corpus.ResourceLimits(
                max_member_bytes=1024,
                max_total_uncompressed_bytes=1000,
            )

            with self.assertRaisesRegex(
                ValueError,
                r"total uncompressed ZIP member bytes exceed limit: 1400/1000",
            ):
                snapshot_kosha_guide_corpus._discover_entries(source, limits)

    def test_duplicate_normalized_pdf_paths_fail_before_completed_accounting(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "[2025] 기술지원규정(테스트분야).zip"
            member_name = "G-1-2025 duplicate.pdf"
            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr(member_name, build_pdf_bytes(["first body"]))
                with self.assertWarnsRegex(UserWarning, "Duplicate name"):
                    archive.writestr(member_name, build_pdf_bytes(["second body"]))
            output_dir = root / "output"

            with self.assertRaisesRegex(
                ValueError,
                r"duplicate normalized ZIP member path: .*::G-1-2025 duplicate\.pdf",
            ):
                self.run_recovery(source, output_dir)

            self.assertFalse((output_dir / "current.json").exists())
            self.assertEqual(list(output_dir.glob("staging/*/checkpoint.json")), [])

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
