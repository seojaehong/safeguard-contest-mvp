from __future__ import annotations

import gzip
import hashlib
import json
import re
import sys
import tempfile
import unittest
import unicodedata
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import kosha_exact_promotion_reviewer_support as support
import kosha_corpus_binding as corpus_binding


def write_json(root: Path, relative_path: Path, value: object) -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def write_body_rows(root: Path, body_root: Path, rows: list[dict[str, object]]) -> None:
    path = root / body_root / "snapshots/test/items.jsonl.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8") as handle:
        for row in rows:
            body = row.get("body") if isinstance(row.get("body"), str) else ""
            pages = row.get("pages")
            if not isinstance(pages, list):
                row["pages"] = [
                    {
                        "page_number": 1,
                        "body_char_start": 0,
                        "body_char_end": len(body),
                        "normalized_text_sha256": "a" * 64,
                        "ocr_candidate": False,
                        "extraction_status": "success",
                    }
                ]
            elif len(pages) == 1 and isinstance(pages[0], dict):
                pages[0]["body_char_start"] = 0
                pages[0]["body_char_end"] = len(body)
                pages[0].setdefault("page_number", 1)
                pages[0].setdefault("normalized_text_sha256", "a" * 64)
                pages[0].setdefault("ocr_candidate", False)
                pages[0].setdefault("extraction_status", "success")
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def normalized_body_sha256(value: str) -> str:
    normalized = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def refresh_corpus_binding(root: Path) -> None:
    items_path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
    logical_items = gzip.decompress(items_path.read_bytes())
    manifest_path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["output_hashes"]["items.jsonl"] = hashlib.sha256(logical_items).hexdigest()
    write_json(root, support.DEFAULT_BODY_ROOT / "snapshots/test/manifest.json", manifest)
    current = json.loads((root / support.DEFAULT_BODY_CURRENT_PATH).read_text(encoding="utf-8"))
    current["manifest"]["sha256"] = corpus_binding.sha256_file(manifest_path)
    write_json(root, support.DEFAULT_BODY_CURRENT_PATH, current)
    rows = [json.loads(line) for line in logical_items.decode("utf-8").splitlines() if line.strip()]
    body_by_key = {row["stable_key"]: row for row in rows}
    packet_path = root / support.DEFAULT_PACKET_PATH
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    candidates = packet["candidates"]
    for candidate in candidates:
        body = body_by_key[candidate["stableKey"]]["body"]
        digest = normalized_body_sha256(body)
        candidate["bodySha256"] = digest
        candidate["recomputedBodySha256"] = digest
    packet["corpusBinding"] = corpus_binding.build_corpus_binding(
        root,
        support.DEFAULT_BODY_CURRENT_PATH,
        support.DEFAULT_BODY_ROOT,
        candidates,
    )
    write_json(root, support.DEFAULT_PACKET_PATH, packet)
    packet_sha256 = corpus_binding.sha256_file(packet_path)
    for upstream_path in (support.DEFAULT_PDF_AUDIT_PATH, support.DEFAULT_LIFECYCLE_AUDIT_PATH):
        upstream = json.loads((root / upstream_path).read_text(encoding="utf-8"))
        upstream["packetSha256"] = packet_sha256
        upstream["corpusBinding"] = packet["corpusBinding"]
        write_json(root, upstream_path, upstream)


def fixture_root() -> Path:
    root = Path(tempfile.mkdtemp(prefix="kosha-reviewer-support-"))
    candidates = []
    body_rows = []
    for index, (stable_key, groups) in enumerate(support.SEMANTIC_GROUPS.items(), start=1):
        terms = [group[0] for group in groups]
        body = f"본문 {' '.join(terms)} 검토 문맥"
        body_sha256 = hashlib.sha256(body.encode("utf-8")).hexdigest()
        candidates.append(
            {
                "stableKey": stable_key,
                "version": f"{stable_key}-2026",
                "officialCurrentTitle": f"{stable_key} official title",
                "sourceTitle": f"{stable_key}-2026 source title",
                "rationale": f"{stable_key} rationale",
                "normalizedCharCount": 1000 + index,
                "pageCount": 10 + index,
                "bodySha256": body_sha256,
                "recomputedBodySha256": body_sha256,
                "pdfSha256": hashlib.sha256(f"pdf-{stable_key}".encode("utf-8")).hexdigest(),
            }
        )
        body_rows.append(
            {
                "stable_key": stable_key,
                "version_key": f"{stable_key}-2026",
                "body": body,
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
        {
            "snapshot_path": "snapshots/test",
            "snapshot_id": "test",
            "source_identity_sha256": "c" * 64,
            "manifest": {
                "path": "snapshots/test/manifest.json",
                "sha256": "",
            },
        },
    )
    write_body_rows(root, support.DEFAULT_BODY_ROOT, body_rows)
    items_path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
    logical_items = gzip.decompress(items_path.read_bytes())
    manifest_path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/manifest.json"
    write_json(
        root,
        support.DEFAULT_BODY_ROOT / "snapshots/test/manifest.json",
        {
            "snapshot_id": "test",
            "source_identity": {"identity_sha256": "c" * 64},
            "output_hashes": {
                "items.jsonl": hashlib.sha256(logical_items).hexdigest(),
            },
        },
    )
    current = json.loads((root / support.DEFAULT_BODY_CURRENT_PATH).read_text(encoding="utf-8"))
    current["manifest"]["sha256"] = corpus_binding.sha256_file(manifest_path)
    write_json(root, support.DEFAULT_BODY_CURRENT_PATH, current)
    packet_path = root / support.DEFAULT_PACKET_PATH
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    packet["corpusBinding"] = corpus_binding.build_corpus_binding(
        root,
        support.DEFAULT_BODY_CURRENT_PATH,
        support.DEFAULT_BODY_ROOT,
        candidates,
    )
    write_json(root, support.DEFAULT_PACKET_PATH, packet)
    packet_sha256 = corpus_binding.sha256_file(packet_path)
    for upstream_path in (support.DEFAULT_PDF_AUDIT_PATH, support.DEFAULT_LIFECYCLE_AUDIT_PATH):
        upstream = json.loads((root / upstream_path).read_text(encoding="utf-8"))
        upstream["packetSha256"] = packet_sha256
        upstream["corpusBinding"] = packet["corpusBinding"]
        write_json(root, upstream_path, upstream)
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
        self.assertEqual(report["pageReceiptCount"], 24)
        self.assertEqual(report["semanticGroupsWithoutPageReceipt"], 0)
        self.assertTrue(all(
            group["pageReceipts"]
            for candidate in report["results"]
            for group in candidate["semanticGroups"]
        ))
        self.assertTrue(all(
            group["locationMappingComplete"] is True
            and group["locationMappingFailure"] is None
            and group["evidenceTerm"]
            and group["matchBodyCharEnd"] > group["matchBodyCharStart"]
            for candidate in report["results"]
            for group in candidate["semanticGroups"]
        ))
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
        refresh_corpus_binding(root)

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
        refresh_corpus_binding(root)

        report = support.build_report(root)

        candidate = next(row for row in report["results"] if row["stableKey"] == "A-G-1")
        first_group = candidate["semanticGroups"][0]
        self.assertTrue(first_group["machineSupported"])
        self.assertEqual(first_group["evidenceTerm"], "수직형추락방망")
        self.assertIn("수직형 추락방망", first_group["excerpt"])
        self.assertEqual(candidate["failedSemanticGroups"], [])
        self.assertEqual(first_group["pageReceipts"][0]["pageNumber"], 1)

    def test_semantic_match_spanning_pages_keeps_both_page_receipts(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "B-E-11")
        target["body"] = "충전\n전로 활선 전기작업 접근한계 감전 아크 절연"
        target["pages"] = [
            {
                "page_number": 1,
                "body_char_start": 0,
                "body_char_end": 2,
                "normalized_text_sha256": "1" * 64,
                "ocr_candidate": False,
                "extraction_status": "success",
            },
            {
                "page_number": 2,
                "body_char_start": 3,
                "body_char_end": len(target["body"]),
                "normalized_text_sha256": "2" * 64,
                "ocr_candidate": True,
                "extraction_status": "success",
            },
        ]
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)
        refresh_corpus_binding(root)

        report = support.build_report(root)

        candidate = next(row for row in report["results"] if row["stableKey"] == "B-E-11")
        receipts = candidate["semanticGroups"][0]["pageReceipts"]
        self.assertEqual([receipt["pageNumber"] for receipt in receipts], [1, 2])
        self.assertFalse(receipts[0]["ocrCandidate"])
        self.assertTrue(receipts[1]["ocrCandidate"])
        self.assertTrue(candidate["semanticGroups"][0]["locationMappingComplete"])
        self.assertIsNone(candidate["semanticGroups"][0]["locationMappingFailure"])

    def test_missing_page_digest_fails_closed(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "D-C-10")
        target["pages"][0]["normalized_text_sha256"] = ""
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)
        refresh_corpus_binding(root)

        with self.assertRaisesRegex(
            support.ReviewerSupportError,
            "reviewer-support-invalid-page-metadata:1",
        ):
            support.build_report(root)

    def test_malformed_page_boolean_fails_closed(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "D-C-10")
        target["pages"][0]["ocr_candidate"] = "false"
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)
        refresh_corpus_binding(root)

        with self.assertRaisesRegex(
            support.ReviewerSupportError,
            "reviewer-support-invalid-page-metadata:1",
        ):
            support.build_report(root)

    def test_non_whitespace_page_coverage_gap_fails_semantic_group(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "B-E-11")
        target["body"] = "충전전로 활선 전기작업 접근한계 감전 아크 절연"
        target["pages"] = [
            {
                "page_number": 1,
                "body_char_start": 0,
                "body_char_end": 1,
                "normalized_text_sha256": "1" * 64,
                "ocr_candidate": False,
                "extraction_status": "success",
            },
            {
                "page_number": 2,
                "body_char_start": 2,
                "body_char_end": len(target["body"]),
                "normalized_text_sha256": "2" * 64,
                "ocr_candidate": False,
                "extraction_status": "success",
            },
        ]
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)
        refresh_corpus_binding(root)

        report = support.build_report(root)
        candidate = next(row for row in report["results"] if row["stableKey"] == "B-E-11")
        first_group = candidate["semanticGroups"][0]
        self.assertFalse(first_group["machineSupported"])
        self.assertEqual(first_group["locationMappingFailure"], "semantic-match-non-whitespace-gap")

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

    def test_stale_body_corpus_is_rejected_before_semantic_review(self) -> None:
        root = fixture_root()
        path = root / support.DEFAULT_BODY_ROOT / "snapshots/test/items.jsonl.gz"
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
        target = next(row for row in rows if row["stable_key"] == "D-C-10")
        target["body"] = "committed packet 이후 변조된 본문"
        write_body_rows(root, support.DEFAULT_BODY_ROOT, rows)

        with self.assertRaisesRegex(
            support.ReviewerSupportError,
            "corpus-binding-items-logical-hash-mismatch",
        ):
            support.build_report(root)


if __name__ == "__main__":
    unittest.main()
