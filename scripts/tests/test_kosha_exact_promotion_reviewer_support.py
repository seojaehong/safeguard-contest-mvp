from __future__ import annotations

import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import kosha_exact_promotion_reviewer_support as support


def write_json(root: Path, relative_path: Path, value: object) -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def write_body_rows(root: Path, body_root: Path, rows: list[dict[str, object]]) -> None:
    path = root / body_root / "snapshots/test/items.jsonl.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def fixture_root() -> Path:
    root = Path(tempfile.mkdtemp(prefix="kosha-reviewer-support-"))
    candidates = []
    body_rows = []
    for index, (stable_key, groups) in enumerate(support.SEMANTIC_GROUPS.items(), start=1):
        terms = [group[0] for group in groups]
        candidates.append(
            {
                "stableKey": stable_key,
                "version": f"{stable_key}-2026",
                "officialCurrentTitle": f"{stable_key} official title",
                "sourceTitle": f"{stable_key}-2026 source title",
                "rationale": f"{stable_key} rationale",
                "normalizedCharCount": 1000 + index,
                "pageCount": 10 + index,
            }
        )
        body_rows.append(
            {
                "stable_key": stable_key,
                "body": f"본문 {' '.join(terms)} 검토 문맥",
            }
        )
    write_json(
        root,
        support.DEFAULT_PACKET_PATH,
        {
            "verdict": "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW",
            "mutationPerformed": False,
            "exactPromotionPerformed": False,
            "candidates": candidates,
        },
    )
    write_json(
        root,
        support.DEFAULT_PDF_AUDIT_PATH,
        {
            "verdict": "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED",
            "machineVerifiedCount": 8,
            "failedCount": 0,
            "exactPromotionPerformed": False,
        },
    )
    write_json(
        root,
        support.DEFAULT_LIFECYCLE_AUDIT_PATH,
        {
            "verdict": "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED",
            "machineLifecycleSupportedCount": 8,
            "exactTitleIdentityMatchCount": 8,
            "titleVariantFindingCount": 0,
            "failedCount": 0,
            "exactPromotionPerformed": False,
        },
    )
    write_json(
        root,
        support.DEFAULT_BODY_CURRENT_PATH,
        {"snapshot_path": "snapshots/test"},
    )
    write_body_rows(root, support.DEFAULT_BODY_ROOT, body_rows)
    return root


class KoshaExactPromotionReviewerSupportTest(unittest.TestCase):
    def test_all_semantic_groups_pass_without_completing_human_review(self) -> None:
        root = fixture_root()
        report = support.build_report(root)

        self.assertEqual(
            report["verdict"],
            "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED",
        )
        self.assertEqual(report["candidateCount"], 8)
        self.assertEqual(report["machineSupportedCount"], 8)
        self.assertEqual(report["semanticGroupCount"], 24)
        self.assertEqual(report["failedSemanticGroupCount"], 0)
        self.assertFalse(report["reviewBoundary"]["humanReviewCompleted"])
        self.assertFalse(report["reviewBoundary"]["machineEvidenceReplacesHumanReview"])
        self.assertFalse(report["exactPromotionPerformed"])
        self.assertFalse(report["exactRegistryWriteArtifactCreated"])

    def test_missing_candidate_semantic_group_fails_closed(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "B-E-11")
        target["body"] = "충전전로 전기작업만 포함"
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)

        report = support.build_report(root)

        self.assertEqual(report["verdict"], "RED_PROMOTION_CANDIDATE_CONTENT_RATIONALE_MISMATCH")
        self.assertEqual(report["failedCount"], 1)
        failed = next(row for row in report["results"] if row["stableKey"] == "B-E-11")
        self.assertEqual(failed["failedSemanticGroups"], [3])
        self.assertFalse(report["exactPromotionPerformed"])

    def test_excerpt_preserves_context_for_whitespace_normalized_match(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "A-G-1")
        target["body"] = "설치 전 수직형 추락방망 상태와 추락 위험을 현장에서 확인합니다."
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)

        report = support.build_report(root)

        candidate = next(row for row in report["results"] if row["stableKey"] == "A-G-1")
        first_group = candidate["semanticGroups"][0]
        self.assertTrue(first_group["machineSupported"])
        self.assertIn("수직형 추락방망", first_group["excerpt"])
        self.assertEqual(candidate["failedSemanticGroups"], [])

    def test_upstream_lifecycle_overclaim_is_rejected(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_LIFECYCLE_AUDIT_PATH
        lifecycle = json.loads(path.read_text(encoding="utf-8"))
        lifecycle["exactPromotionPerformed"] = True
        write_json(root, support.DEFAULT_LIFECYCLE_AUDIT_PATH, lifecycle)

        with self.assertRaisesRegex(
            support.ReviewerSupportError,
            "reviewer-support-lifecycle-audit-not-ready",
        ):
            support.build_report(root)


if __name__ == "__main__":
    unittest.main()
