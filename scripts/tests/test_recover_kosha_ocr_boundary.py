from __future__ import annotations

import hashlib
import tempfile
import unittest
from unittest import mock
from pathlib import Path

import fitz

from scripts import recover_kosha_ocr_boundary


class FakeVisionTransport:
    def __init__(self, texts: list[str]) -> None:
        self._texts = texts
        self.calls: list[tuple[int, str]] = []

    def transcribe_page(
        self,
        *,
        page_number: int,
        image_png: bytes,
        image_sha256: str,
    ) -> recover_kosha_ocr_boundary.OcrPageResponse:
        self.calls.append((page_number, image_sha256))
        return recover_kosha_ocr_boundary.OcrPageResponse(
            text=self._texts[page_number - 1],
            response_id=f"resp-{page_number}",
            model="gpt-test-vision",
            created_at=1_783_000_000 + page_number,
            status="completed",
        )


def create_scanned_pdf(path: Path, page_count: int = 2) -> None:
    source = fitz.open()
    for page_number in range(1, page_count + 1):
        page = source.new_page(width=320, height=420)
        page.insert_text((32, 72), f"SCAN PAGE {page_number}", fontsize=22)
    rendered_pages = [
        page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).tobytes("png")
        for page in source
    ]
    source.close()

    scanned = fitz.open()
    for image in rendered_pages:
        page = scanned.new_page(width=320, height=420)
        page.insert_image(page.rect, stream=image)
    scanned.save(path)
    scanned.close()


def current_generator_sha256() -> str:
    return hashlib.sha256(Path(recover_kosha_ocr_boundary.__file__).read_bytes()).hexdigest()


class RecoverKoshaOcrBoundaryTests(unittest.TestCase):
    def test_builds_a_draft_candidate_with_page_and_source_hashes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "B-E-3-2025.pdf"
            create_scanned_pdf(source)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            transport = FakeVisionTransport([
                "첫 번째 페이지 본문입니다.",
                "두 번째 페이지 본문입니다.",
            ])

            result = recover_kosha_ocr_boundary.recover_pdf_candidate(
                source_pdf=source,
                item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                transport=transport,
                dpi=144,
                max_pages=10,
            )

            self.assertEqual(result["schema_version"], "safeclaw-kosha-ocr-candidate/v1")
            self.assertEqual(result["status"], "candidate")
            self.assertEqual(result["source"]["raw_sha256"], raw_sha256)
            self.assertEqual(result["source"]["page_count"], 2)
            self.assertEqual(result["review"], {
                "state": "draft",
                "human_confirmed": False,
                "reviewed_by": None,
                "reviewed_at": None,
            })
            self.assertFalse(result["db_mutation_performed"])
            self.assertEqual(result["body"], "첫 번째 페이지 본문입니다.\n두 번째 페이지 본문입니다.")
            self.assertEqual(len(result["pages"]), 2)
            self.assertTrue(all(page["image_sha256"] for page in result["pages"]))
            self.assertTrue(all(page["text_sha256"] for page in result["pages"]))
            self.assertEqual([call[0] for call in transport.calls], [1, 2])
            self.assertNotIn(str(source.parent), str(result))
            self.assertNotIn("OPENAI_API_KEY", str(result))

    def test_rejects_a_source_hash_mismatch_before_vision_calls(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            transport = FakeVisionTransport(["본문"])

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "source_hash_mismatch",
            ):
                recover_kosha_ocr_boundary.recover_pdf_candidate(
                    source_pdf=source,
                    item_id="kosha-test-item",
                    expected_raw_sha256="0" * 64,
                    transport=transport,
                )

            self.assertEqual(transport.calls, [])

    def test_rejects_empty_page_ocr_instead_of_publishing_partial_body(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "empty_ocr_page:1",
            ):
                recover_kosha_ocr_boundary.recover_pdf_candidate(
                    source_pdf=source,
                    item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    transport=FakeVisionTransport(["  \n  "]),
                )

    def test_rejects_incomplete_openai_response_with_partial_text(self) -> None:
        transport = recover_kosha_ocr_boundary.OpenAiResponsesVisionTransport(
            api_key="test-key",
            model="gpt-test-vision",
        )
        payload = {
            "id": "resp-incomplete",
            "model": "gpt-test-vision",
            "status": "incomplete",
            "incomplete_details": {"reason": "max_output_tokens"},
            "output_text": "부분 전사 본문",
        }
        image = b"not-a-real-image-but-hash-valid"

        with mock.patch.object(transport, "_request", return_value=payload):
            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "openai_response_incomplete:1:max_output_tokens",
            ):
                transport.transcribe_page(
                    page_number=1,
                    image_png=image,
                    image_sha256=hashlib.sha256(image).hexdigest(),
                )

    def test_review_gate_rejects_draft_and_accepts_explicit_human_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            candidate = recover_kosha_ocr_boundary.recover_pdf_candidate(
                source_pdf=source,
                item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                transport=FakeVisionTransport(["검토 대상 본문"]),
            )

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_not_human_confirmed",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                )

            candidate["review"] = {
                **recover_kosha_ocr_boundary.create_review_attestation(
                    candidate,
                    reviewer_id="corpus-reviewer",
                    reviewed_at="2026-07-13T00:00:00Z",
                    hmac_key=b"a" * 32,
                )
            }
            reviewed = recover_kosha_ocr_boundary.validate_reviewed_candidate(
                candidate,
                expected_item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                source_pdf=source,
                trusted_reviewer_ids={"corpus-reviewer"},
                review_hmac_key=b"a" * 32,
                expected_generator_sha256=current_generator_sha256(),
            )

            self.assertEqual(reviewed["body"], "검토 대상 본문")
            self.assertEqual(reviewed["review"]["state"], "verified")

    def test_review_gate_rejects_incomplete_page_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            candidate = recover_kosha_ocr_boundary.recover_pdf_candidate(
                source_pdf=source,
                item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                transport=FakeVisionTransport(["검토 대상 본문"]),
            )
            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T00:00:00Z",
                hmac_key=b"a" * 32,
            )
            candidate["source"]["page_count"] = 2

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_page_count_mismatch",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=current_generator_sha256(),
                )

            candidate["source"]["page_count"] = 1
            candidate["pages"][0]["response_id"] = ""
            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_page_response_missing:1",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=current_generator_sha256(),
                )

    def test_review_gate_rejects_self_declared_or_tampered_attestation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            candidate = recover_kosha_ocr_boundary.recover_pdf_candidate(
                source_pdf=source,
                item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                transport=FakeVisionTransport(["검토 대상 본문"]),
            )
            candidate["review"] = {
                "state": "verified",
                "human_confirmed": True,
                "reviewed_by": "untrusted-reviewer",
                "reviewed_at": "not-a-date",
                "attestation_schema": "safeclaw-kosha-ocr-review-attestation/v1",
                "content_sha256": "0" * 64,
                "signature_hmac_sha256": "0" * 64,
            }

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_reviewer_untrusted",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=current_generator_sha256(),
                )

            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T00:00:00Z",
                hmac_key=b"a" * 32,
            )
            candidate["pages"][0]["text"] = "변조 본문"
            candidate["pages"][0]["text_sha256"] = hashlib.sha256("변조 본문".encode()).hexdigest()
            candidate["body"] = "변조 본문"
            candidate["body_sha256"] = hashlib.sha256("변조 본문".encode()).hexdigest()

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_attestation_content_mismatch",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=current_generator_sha256(),
                )

    def test_review_gate_rejects_re_signed_untrusted_generator_and_source_image(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)
            raw_sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
            candidate = recover_kosha_ocr_boundary.recover_pdf_candidate(
                source_pdf=source,
                item_id="kosha-test-item",
                expected_raw_sha256=raw_sha256,
                transport=FakeVisionTransport(["검토 대상 본문"]),
            )
            trusted_generator = current_generator_sha256()
            candidate["generator"]["script_sha256"] = "0" * 64
            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T00:00:00Z",
                hmac_key=b"a" * 32,
            )

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_generator_hash_mismatch",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=trusted_generator,
                )

            candidate["generator"]["script_sha256"] = trusted_generator
            candidate["pages"][0]["image_sha256"] = "0" * 64
            candidate["review"] = recover_kosha_ocr_boundary.create_review_attestation(
                candidate,
                reviewer_id="corpus-reviewer",
                reviewed_at="2026-07-13T00:00:00Z",
                hmac_key=b"a" * 32,
            )
            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "ocr_candidate_source_image_hash_mismatch:1",
            ):
                recover_kosha_ocr_boundary.validate_reviewed_candidate(
                    candidate,
                    expected_item_id="kosha-test-item",
                    expected_raw_sha256=raw_sha256,
                    source_pdf=source,
                    trusted_reviewer_ids={"corpus-reviewer"},
                    review_hmac_key=b"a" * 32,
                    expected_generator_sha256=trusted_generator,
                )

    def test_rejects_output_that_can_replace_the_source_or_hide_as_non_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            create_scanned_pdf(source, page_count=1)

            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "output_matches_source",
            ):
                recover_kosha_ocr_boundary.validate_output_path(source, source, overwrite=False)
            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "output_must_be_json",
            ):
                recover_kosha_ocr_boundary.validate_output_path(
                    source,
                    Path(tmp) / "candidate.pdf",
                    overwrite=False,
                )
            existing = Path(tmp) / "candidate.json"
            existing.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(
                recover_kosha_ocr_boundary.OcrBoundaryError,
                "output_exists",
            ):
                recover_kosha_ocr_boundary.validate_output_path(
                    source,
                    existing,
                    overwrite=False,
                )
            self.assertEqual(
                recover_kosha_ocr_boundary.validate_output_path(
                    source,
                    existing,
                    overwrite=True,
                ),
                existing.resolve(),
            )


if __name__ == "__main__":
    unittest.main()
