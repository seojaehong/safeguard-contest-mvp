from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib import error

from scripts import build_b_m_37_review_packet


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def metadata_row(pdf_hash: str, body_hash: str) -> dict[str, object]:
    return {
        "stable_key": build_b_m_37_review_packet.TARGET_STABLE_KEY,
        "official_version": build_b_m_37_review_packet.TARGET_VERSION,
        "official_file_id": build_b_m_37_review_packet.TARGET_FILE_ID,
        "official_file_sequence": build_b_m_37_review_packet.TARGET_FILE_SEQUENCE,
        "official_url": build_b_m_37_review_packet.OFFICIAL_URL,
        "pdf_sha256": pdf_hash,
        "body_sha256": body_hash,
        "official_status": "current",
        "publication_date": "2026-01-30",
    }


class BuildBM37ReviewPacketTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        build_b_m_37_review_packet.DEFAULT_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

    def test_shared_fetch_uses_twenty_second_timeout_and_one_retry(self) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b"pdf"
        opener = MagicMock()
        opener.open.side_effect = [error.URLError("timeout"), response]
        with patch("scripts.acquire_exact_kosha_body.request.build_opener", return_value=opener):
            self.assertEqual(
                build_b_m_37_review_packet.fetch_official_pdf(
                    build_b_m_37_review_packet.OFFICIAL_URL
                ),
                b"pdf",
            )
        self.assertEqual(opener.open.call_count, 2)
        self.assertEqual(
            [call.kwargs["timeout"] for call in opener.open.call_args_list],
            [20.0, 20.0],
        )

    def test_pdf_hash_mismatch_fails_closed_without_content_packet(self) -> None:
        with (
            tempfile.TemporaryDirectory(
                dir=build_b_m_37_review_packet.REPO_ROOT / "evaluation"
            ) as temp_dir,
            tempfile.TemporaryDirectory(
                dir=build_b_m_37_review_packet.DEFAULT_CACHE_PATH.parent
            ) as cache_dir,
        ):
            root = Path(temp_dir)
            metadata_path = root / "metadata.jsonl"
            output_dir = root / "output"
            cache_path = Path(cache_dir) / "fixture.pdf"
            metadata_path.write_text(
                f"{json.dumps(metadata_row(build_b_m_37_review_packet.EXPECTED_PDF_SHA256, build_b_m_37_review_packet.EXPECTED_BODY_SHA256))}\n",
                encoding="utf-8",
            )
            output_dir.mkdir()
            (output_dir / "official.pdf").write_bytes(b"stale-verified-content")
            (output_dir / "review-packet.md").write_text("stale", encoding="utf-8")
            with self.assertRaisesRegex(
                build_b_m_37_review_packet.ReviewPacketError,
                "pdf-sha256-mismatch",
            ):
                build_b_m_37_review_packet.run_acquisition(
                    metadata_path,
                    output_dir,
                    cache_path,
                    fetch_bytes=lambda url: b"tampered",
                )
            report = json.loads((output_dir / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "fail-closed")
            self.assertFalse((output_dir / "official.pdf").exists())
            self.assertFalse((output_dir / "normalized-body.txt").exists())
            self.assertFalse((output_dir / "review-packet.md").exists())

    def test_candidate_parser_is_reproducible_and_bounds_exact_context(self) -> None:
        body = (
            "4.1회전기계등의위험방지 근로자가 위험에 처할 우려가 있는 부위에 방호장치를 설치한다."
            "4.2.1공작기계의위험방지 위험한 톱날 부위에 덮개 또는 울 등을 설치하여야 한다."
        )
        fake_item: dict[str, object] = {
            "body": body,
            "pages": [
                {
                    "page_number": 8,
                    "body_char_start": 0,
                    "body_char_end": len(body),
                }
            ],
        }
        first = build_b_m_37_review_packet.build_candidates(fake_item)
        second = build_b_m_37_review_packet.build_candidates(fake_item)
        self.assertEqual(first, second)
        representative = next(
            candidate
            for candidate in first
            if candidate["exactCandidateSubstring"] == "덮개"
        )
        self.assertEqual(representative["detectedSection"]["number"], "4.2.1")
        self.assertTrue(
            all(
                len(str(candidate["exactCandidateSubstring"]))
                <= build_b_m_37_review_packet.MAX_EXACT_MATCH_CHARS
                and len(str(candidate["contextBefore"]))
                <= build_b_m_37_review_packet.MAX_CONTEXT_CHARS
                and len(str(candidate["contextAfter"]))
                <= build_b_m_37_review_packet.MAX_CONTEXT_CHARS
                and build_b_m_37_review_packet.MIN_ACTIONABLE_EXCERPT_CHARS
                <= len(str(candidate["actionableExcerpt"]))
                <= build_b_m_37_review_packet.MAX_ACTIONABLE_EXCERPT_CHARS
                for candidate in first
            )
        )

    def test_adjacent_same_depth_headings_fail_to_explicit_unknown(self) -> None:
        body = (
            "4.2.3목재가공용기계의위험방지\n"
            "4.2.4원심기및분쇄기등,고속회전체의위험방지 덮개를 설치한다."
        )
        fake_item: dict[str, object] = {
            "body": body,
            "pages": [
                {
                    "page_number": 9,
                    "body_char_start": 0,
                    "body_char_end": len(body),
                }
            ],
        }
        candidates = build_b_m_37_review_packet.build_candidates(fake_item)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["detectedSection"]["status"], "unknown")
        self.assertIsNone(candidates[0]["detectedSection"]["number"])

    def test_success_path_uses_ignored_cache_without_full_source_output(self) -> None:
        body = "4.2.1공작기계의위험방지 방호장치 재기동 잠금장치"
        fake_item: dict[str, object] = {
            "stable_key": build_b_m_37_review_packet.TARGET_STABLE_KEY,
            "version_key": build_b_m_37_review_packet.TARGET_VERSION,
            "extraction_status": "success",
            "page_count": 1,
            "normalized_char_count": len(body),
            "body": body,
            "pages": [
                {
                    "page_number": 1,
                    "body_char_start": 0,
                    "body_char_end": len(body),
                }
            ],
        }
        pdf_bytes = b"fixture-pdf"
        with (
            tempfile.TemporaryDirectory(
                dir=build_b_m_37_review_packet.REPO_ROOT / "evaluation"
            ) as temp_dir,
            tempfile.TemporaryDirectory(
                dir=build_b_m_37_review_packet.DEFAULT_CACHE_PATH.parent
            ) as cache_dir,
        ):
            root = Path(temp_dir)
            metadata_path = root / "metadata.jsonl"
            output_dir = root / "output"
            cache_path = Path(cache_dir) / "fixture.pdf"
            with (
                patch.object(
                    build_b_m_37_review_packet,
                    "EXPECTED_PDF_SHA256",
                    sha256(pdf_bytes),
                ),
                patch.object(
                    build_b_m_37_review_packet,
                    "EXPECTED_BODY_SHA256",
                    sha256(body.encode("utf-8")),
                ),
                patch.object(
                    build_b_m_37_review_packet,
                    "extract_item",
                    return_value=fake_item,
                ),
            ):
                metadata_path.write_text(
                    f"{json.dumps(metadata_row(sha256(pdf_bytes), sha256(body.encode('utf-8'))))}\n",
                    encoding="utf-8",
                )
                before = build_b_m_37_review_packet.inventory_hashes(
                    build_b_m_37_review_packet.PROTECTED_ROOTS
                )
                report = build_b_m_37_review_packet.run_acquisition(
                    metadata_path,
                    output_dir,
                    cache_path,
                    fetch_bytes=lambda url: pdf_bytes,
                )
                after = build_b_m_37_review_packet.inventory_hashes(
                    build_b_m_37_review_packet.PROTECTED_ROOTS
                )
            self.assertEqual(before, after)
            self.assertEqual(report["productionTrustMutationCount"], 0)
            self.assertEqual(sha256(cache_path.read_bytes()), sha256(pdf_bytes))
            self.assertFalse((output_dir / "official.pdf").exists())
            self.assertFalse((output_dir / "normalized-body.txt").exists())
            self.assertFalse(report["fullSourceArtifactsTrackedInFinalTree"])
            self.assertEqual(
                report["priorUnpushedCommitWithRemovedSource"],
                build_b_m_37_review_packet.PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE,
            )
            receipt_text = (output_dir / "unsigned-receipt.json").read_text(
                encoding="utf-8"
            )
            self.assertNotIn("human_confirmed", receipt_text)
            self.assertEqual(json.loads(receipt_text)["status"], "unsigned")

    def test_real_official_pdf_regression(self) -> None:
        pdf_bytes, _ = build_b_m_37_review_packet.load_or_fetch_pdf(
            build_b_m_37_review_packet.DEFAULT_CACHE_PATH,
            build_b_m_37_review_packet.fetch_official_pdf,
        )
        self.assertEqual(
            sha256(pdf_bytes),
            build_b_m_37_review_packet.EXPECTED_PDF_SHA256,
        )
        item = build_b_m_37_review_packet.extract_item(pdf_bytes)
        body = build_b_m_37_review_packet.normalized_body(item)
        self.assertEqual(
            sha256(body.encode("utf-8")),
            build_b_m_37_review_packet.EXPECTED_BODY_SHA256,
        )
        first = build_b_m_37_review_packet.build_candidates(item)
        second = build_b_m_37_review_packet.build_candidates(item)
        self.assertEqual(
            build_b_m_37_review_packet.canonical_json(first),
            build_b_m_37_review_packet.canonical_json(second),
        )
        representative = [
            candidate
            for candidate in first
            if candidate["page"] == 8
            and candidate["exactCandidateSubstring"] == "덮개"
            and candidate["detectedSection"]["number"] == "4.2.1"
        ]
        self.assertTrue(representative)
        pages = dict(build_b_m_37_review_packet.page_texts(item))
        for candidate in first:
            page_text = pages[int(candidate["page"])]
            excerpt_start = int(candidate["actionableExcerptStart"])
            excerpt_end = int(candidate["actionableExcerptEnd"])
            match_start = int(candidate["sourceMatchStart"])
            match_end = int(candidate["sourceMatchEnd"])
            self.assertEqual(
                page_text[excerpt_start:excerpt_end],
                candidate["actionableExcerpt"],
            )
            self.assertEqual(
                page_text[match_start:match_end],
                candidate["exactCandidateSubstring"],
            )
            self.assertLessEqual(excerpt_start, match_start)
            self.assertGreaterEqual(excerpt_end, match_end)
            self.assertGreaterEqual(
                len(str(candidate["actionableExcerpt"])),
                build_b_m_37_review_packet.MIN_ACTIONABLE_EXCERPT_CHARS,
            )
            self.assertLessEqual(
                len(str(candidate["actionableExcerpt"])),
                build_b_m_37_review_packet.MAX_ACTIONABLE_EXCERPT_CHARS,
            )
            self.assertIsNotNone(
                build_b_m_37_review_packet.ACTIONABLE_CONTROL_PATTERN.search(
                    str(candidate["actionableExcerpt"])
                )
            )
        metrics = build_b_m_37_review_packet.candidate_metrics(first)
        self.assertEqual(
            metrics,
            {
                "candidateCount": 11,
                "detectedSectionCandidateCount": 7,
                "unknownSectionCandidateCount": 4,
                "maxExactMatchChars": 4,
                "maxContextBeforeChars": 120,
                "maxContextAfterChars": 120,
                "minActionableExcerptChars": 54,
                "maxActionableExcerptChars": 202,
                "actionableExcerptContractMinChars": 40,
                "actionableExcerptContractMaxChars": 280,
            },
        )

    def test_no_full_source_artifacts_are_tracked(self) -> None:
        result = subprocess.run(
            [
                "git",
                "ls-files",
                "evaluation/b-m-37-acquisition-review-2026-07-16",
            ],
            cwd=build_b_m_37_review_packet.REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        tracked = set(result.stdout.splitlines())
        self.assertNotIn(
            "evaluation/b-m-37-acquisition-review-2026-07-16/official.pdf",
            tracked,
        )
        self.assertNotIn(
            "evaluation/b-m-37-acquisition-review-2026-07-16/normalized-body.txt",
            tracked,
        )

    def test_rejects_output_and_cache_outside_bounded_roots(self) -> None:
        with self.assertRaisesRegex(
            build_b_m_37_review_packet.ReviewPacketError,
            "output-outside-evaluation",
        ):
            build_b_m_37_review_packet.ensure_evaluation_output(
                build_b_m_37_review_packet.REPO_ROOT / "data" / "forbidden"
            )
        with self.assertRaisesRegex(
            build_b_m_37_review_packet.ReviewPacketError,
            "cache-outside-ignored-local-root",
        ):
            build_b_m_37_review_packet.ensure_local_cache_path(
                build_b_m_37_review_packet.REPO_ROOT / "evaluation" / "forbidden.pdf"
            )


if __name__ == "__main__":
    unittest.main()
