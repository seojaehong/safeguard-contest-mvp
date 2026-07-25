from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import kosha_exact_official_lifecycle_audit as audit


def candidate() -> audit.JsonObject:
    return {
        "stableKey": "D-C-10",
        "version": "D-C-10-2026",
        "title": "D-C-10-2026 sample title",
        "publishedAt": "2026-01-30",
        "officialFileId": "FILE-1",
        "officialUrl": "https://portal.kosha.or.kr/openapi/v1/file/down/FILE-1/1",
    }


def row(version: str, state: str = "current") -> audit.JsonObject:
    return {
        "stableKey": audit._stable_key(version),
        "version": version,
        "title": "sample title",
        "publishedAt": "2026-01-30",
        "officialFileId": "FILE-1",
        "officialFileSequence": 1,
        "statusCode": "20",
        "statusLabel": "개정",
        "category": "D",
        "stateQuery": state,
    }


class KoshaExactOfficialLifecycleAuditTest(unittest.TestCase):
    def test_current_unique_and_not_retired_passes_without_closing_human_review(self) -> None:
        result = audit.evaluate_candidate(
            candidate(),
            [row("D-C-10-2026")],
            [row("D-C-10-2025", "retired")],
        )

        self.assertTrue(result["machineLifecycleSupported"])
        self.assertFalse(result["operatorLifecycleCurrentStatusConfirmed"])
        self.assertFalse(result["humanConfirmed"])
        self.assertEqual(result["failedChecks"], [])

    def test_competing_current_version_fails_closed(self) -> None:
        result = audit.evaluate_candidate(
            candidate(),
            [row("D-C-10-2026"), row("D-C-10-2025")],
            [],
        )

        self.assertFalse(result["machineLifecycleSupported"])
        self.assertIn("singleCurrentStableKeyRow", result["failedChecks"])
        self.assertIn("noCompetingCurrentVersion", result["failedChecks"])

    def test_packet_version_in_retired_list_fails_closed(self) -> None:
        result = audit.evaluate_candidate(
            candidate(),
            [row("D-C-10-2026")],
            [row("D-C-10-2026", "retired")],
        )

        self.assertFalse(result["machineLifecycleSupported"])
        self.assertIn("packetVersionAbsentFromRetired", result["failedChecks"])

    def test_file_identity_or_publication_drift_fails_closed(self) -> None:
        current = row("D-C-10-2026")
        current["officialFileId"] = "DIFFERENT"
        current["publishedAt"] = "2026-02-01"

        result = audit.evaluate_candidate(candidate(), [current], [])

        self.assertFalse(result["machineLifecycleSupported"])
        self.assertIn("packetPublicationDateMatchesCurrent", result["failedChecks"])
        self.assertIn("packetOfficialFileIdMatchesCurrent", result["failedChecks"])
        self.assertIn("packetOfficialUrlMatchesCurrentFile", result["failedChecks"])

    def test_official_title_variant_is_retained_for_human_review_without_faking_lifecycle_drift(self) -> None:
        current = row("D-C-10-2026")
        current["title"] = "sample title (official list wording expanded)"

        result = audit.evaluate_candidate(candidate(), [current], [])

        self.assertTrue(result["machineLifecycleSupported"])
        self.assertFalse(result["officialTitleExactMatch"])
        self.assertEqual(result["findings"], ["officialTitleVariantRequiresHumanReview"])
        self.assertFalse(result["operatorLifecycleCurrentStatusConfirmed"])


if __name__ == "__main__":
    unittest.main()
