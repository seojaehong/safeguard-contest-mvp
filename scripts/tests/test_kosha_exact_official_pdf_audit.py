from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import kosha_exact_official_pdf_audit as audit


def fixture_rows() -> tuple[audit.JsonObject, audit.JsonObject, audit.JsonObject, audit.JsonObject]:
    pdf_sha = "a" * 64
    body_sha = "b" * 64
    candidate: audit.JsonObject = {
        "stableKey": "D-C-10",
        "version": "D-C-10-2026",
        "title": "D-C-10-2026 official current sample",
        "sourceTitle": "D-C-10-2026 corpus source sample",
        "officialCurrentTitle": "official current sample",
        "publishedAt": "2026-01-30",
        "officialFileId": "FILE-1",
        "officialUrl": "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-1/1",
        "pdfSha256": pdf_sha,
        "bodySha256": body_sha,
        "pageCount": 3,
        "normalizedCharCount": 1200,
    }
    metadata: audit.JsonObject = {
        "stable_key": "D-C-10",
        "official_version": "D-C-10-2026",
        "publication_date": "2026-01-30",
        "official_file_id": "FILE-1",
        "official_url": "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-1/1",
        "pdf_sha256": pdf_sha,
        "body_sha256": body_sha,
        "official_status": "current",
    }
    body_item: audit.JsonObject = {
        "version_key": "D-C-10-2026",
        "title": "D-C-10-2026 corpus source sample",
        "official_provenance": {
            "body_sha256": body_sha,
            "pdf_sha256": pdf_sha,
            "official_file_id": "FILE-1",
        },
    }
    extracted: audit.JsonObject = {
        "stableKey": "D-C-10",
        "version": "D-C-10-2026",
        "title": "D-C-10-2026 corpus source sample",
        "pageCount": 3,
        "normalizedCharCount": 1200,
        "bodySha256": body_sha,
        "internalVersionTokenMatched": True,
    }
    return candidate, metadata, body_item, extracted


class KoshaExactOfficialPdfAuditTest(unittest.TestCase):
    def test_machine_checks_pass_without_closing_human_or_promotion_boundaries(self) -> None:
        candidate, metadata, body_item, extracted = fixture_rows()
        observation = audit.DownloadObservation(
            status=200,
            content_type="application/pdf; charset=UTF-8",
            final_url=str(candidate["officialUrl"]),
            content_length=20_000,
            downloaded_bytes=20_000,
            pdf_sha256=str(candidate["pdfSha256"]),
            pdf_magic=True,
        )

        result = audit.evaluate_candidate(candidate, metadata, body_item, observation, extracted)

        self.assertTrue(result["machineVerificationPassed"])
        self.assertFalse(result["humanLifecycleConfirmed"])
        self.assertFalse(result["humanConfirmed"])
        self.assertEqual(result["failedChecks"], [])
        self.assertEqual(result["title"], "D-C-10-2026 official current sample")
        self.assertEqual(result["sourceTitle"], "D-C-10-2026 corpus source sample")

    def test_pdf_hash_mismatch_fails_closed(self) -> None:
        candidate, metadata, body_item, extracted = fixture_rows()
        observation = audit.DownloadObservation(
            status=200,
            content_type="application/pdf",
            final_url=str(candidate["officialUrl"]),
            content_length=20_000,
            downloaded_bytes=20_000,
            pdf_sha256="c" * 64,
            pdf_magic=True,
        )

        result = audit.evaluate_candidate(candidate, metadata, body_item, observation, extracted)

        self.assertFalse(result["machineVerificationPassed"])
        self.assertIn("pdfSha256MatchesPacket", result["failedChecks"])
        self.assertIn("metadataPdfSha256Matches", result["failedChecks"])

    def test_stale_metadata_and_body_mismatch_fail_closed(self) -> None:
        candidate, metadata, body_item, extracted = fixture_rows()
        metadata["official_status"] = "superseded"
        extracted["bodySha256"] = "d" * 64
        observation = audit.DownloadObservation(
            status=200,
            content_type="application/pdf",
            final_url=str(candidate["officialUrl"]),
            content_length=20_000,
            downloaded_bytes=20_000,
            pdf_sha256=str(candidate["pdfSha256"]),
            pdf_magic=True,
        )

        result = audit.evaluate_candidate(candidate, metadata, body_item, observation, extracted)

        self.assertFalse(result["machineVerificationPassed"])
        self.assertIn("metadataSnapshotSaysCurrent", result["failedChecks"])
        self.assertIn("extractedBodySha256Matches", result["failedChecks"])

    def test_source_title_drift_fails_closed_without_replacing_official_title(self) -> None:
        candidate, metadata, body_item, extracted = fixture_rows()
        body_item["title"] = "D-C-10-2026 drifted corpus title"
        observation = audit.DownloadObservation(
            status=200,
            content_type="application/pdf",
            final_url=str(candidate["officialUrl"]),
            content_length=20_000,
            downloaded_bytes=20_000,
            pdf_sha256=str(candidate["pdfSha256"]),
            pdf_magic=True,
        )

        result = audit.evaluate_candidate(candidate, metadata, body_item, observation, extracted)

        self.assertFalse(result["machineVerificationPassed"])
        self.assertIn("bodyCorpusSourceTitleMatches", result["failedChecks"])
        self.assertNotIn("packetTitleUsesOfficialCurrentTitle", result["failedChecks"])


if __name__ == "__main__":
    unittest.main()
