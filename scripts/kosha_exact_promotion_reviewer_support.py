from __future__ import annotations

import argparse
import gzip
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from kosha_corpus_binding import build_corpus_binding, require_packet_corpus_binding, sha256_file


JsonObject = dict[str, Any]

DEFAULT_PACKET_PATH = Path("evaluation/kosha-exact-promotion-packet-2026-07-22/report.json")
DEFAULT_PDF_AUDIT_PATH = Path("evaluation/kosha-exact-official-pdf-audit-2026-07-25/report.json")
DEFAULT_LIFECYCLE_AUDIT_PATH = Path("evaluation/kosha-exact-official-lifecycle-audit-2026-07-25/report.json")
DEFAULT_BODY_CURRENT_PATH = Path("data/safety-knowledge/kosha-guide-corpus/current.json")
DEFAULT_BODY_ROOT = Path("data/safety-knowledge/kosha-guide-corpus")
DEFAULT_OUTPUT_DIR = Path("evaluation/kosha-exact-promotion-reviewer-support-2026-07-25")

SEMANTIC_GROUPS: dict[str, tuple[tuple[str, ...], ...]] = {
    "D-C-10": (
        ("이동식크레인", "항타기", "항발기", "타워크레인"),
        ("작업계획서",),
        ("신호수", "작업반경", "줄걸이", "전도"),
    ),
    "D-C-11": (
        ("굴착", "토공"),
        ("흙막이", "굴착면", "지보공"),
        ("매설물", "붕괴", "토사"),
    ),
    "A-G-1": (
        ("추락방호망", "수직형추락방망"),
        ("설치", "테두리로프", "인장"),
        ("추락", "낙하"),
    ),
    "A-G-15": (
        ("비상조치계획",),
        ("대피", "비상연락", "응급"),
        ("화재", "폭발", "누출"),
    ),
    "B-E-11": (
        ("충전전로",),
        ("활선", "전기작업", "접근한계"),
        ("감전", "아크", "절연"),
    ),
    "B-E-9": (
        ("접지설비",),
        ("접지저항", "접지도체", "보호접지"),
        ("감전", "고장전류", "등전위"),
    ),
    "D-C-4": (
        ("굴착기",),
        ("작업계획서", "유도자", "후진"),
        ("충돌", "협착", "전도"),
    ),
    "E-G-4": (
        ("근골격계질환",),
        ("업종", "직종"),
        ("반복", "중량물", "부담작업", "작업자세"),
    ),
}


class ReviewerSupportError(RuntimeError):
    pass


def _read_json(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ReviewerSupportError(f"invalid-json-object:{path}")
    return value


def _read_gzip_jsonl(path: Path) -> list[JsonObject]:
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        rows = [json.loads(line) for line in handle if line.strip()]
    if not all(isinstance(row, dict) for row in rows):
        raise ReviewerSupportError(f"invalid-jsonl-row:{path}")
    return rows


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _integer(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _git_head(root_dir: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=root_dir,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _normalized_text(value: str) -> str:
    return re.sub(r"\s+", "", value)


def _match_context(body: str, term: str, radius: int = 90) -> tuple[str, int, int]:
    normalized_chars: list[str] = []
    source_indexes: list[int] = []
    for source_index, character in enumerate(body):
        if character.isspace():
            continue
        normalized_chars.append(character)
        source_indexes.append(source_index)
    normalized = "".join(normalized_chars)
    normalized_term = _normalized_text(term)
    normalized_index = normalized.find(normalized_term)
    if normalized_index < 0 or not normalized_term:
        return "", -1, -1
    source_start = source_indexes[normalized_index]
    source_end_index = normalized_index + len(normalized_term) - 1
    source_end = source_indexes[source_end_index] + 1
    start = max(0, source_start - radius)
    end = min(len(body), source_end + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(body) else ""
    excerpt = re.sub(r"\s+", " ", body[start:end]).strip()
    return f"{prefix}{excerpt}{suffix}", source_start, source_end


def _page_receipts(
    body_row: JsonObject,
    body: str,
    match_start: int,
    match_end: int,
) -> tuple[list[JsonObject], str | None]:
    pages_value = body_row.get("pages")
    if not isinstance(pages_value, list) or not pages_value:
        raise ReviewerSupportError("reviewer-support-page-metadata-missing")
    pages = pages_value
    receipts: list[JsonObject] = []
    previous_page_number = 0
    previous_page_end = 0
    for page_index, page_value in enumerate(pages):
        if not isinstance(page_value, dict):
            raise ReviewerSupportError(f"reviewer-support-invalid-page-row:{page_index}")
        page_start = page_value.get("body_char_start")
        page_end = page_value.get("body_char_end")
        page_number = page_value.get("page_number")
        page_digest = _text(page_value.get("normalized_text_sha256"))
        ocr_candidate = page_value.get("ocr_candidate")
        extraction_status = _text(page_value.get("extraction_status"))
        if (
            not isinstance(page_start, int)
            or isinstance(page_start, bool)
            or not isinstance(page_end, int)
            or isinstance(page_end, bool)
            or not isinstance(page_number, int)
            or isinstance(page_number, bool)
            or page_start < 0
            or page_end < page_start
            or page_end > len(body)
            or page_number <= 0
            or page_number <= previous_page_number
            or page_start < previous_page_end
            or re.fullmatch(r"[0-9a-f]{64}", page_digest) is None
            or not isinstance(ocr_candidate, bool)
            or extraction_status not in {"success", "empty"}
        ):
            raise ReviewerSupportError(
                f"reviewer-support-invalid-page-metadata:{page_index + 1}"
            )
        previous_page_number = page_number
        previous_page_end = page_end
        overlap_start = max(match_start, page_start)
        overlap_end = min(match_end, page_end)
        if overlap_start >= overlap_end:
            continue
        receipts.append(
            {
                "pageNumber": page_number,
                "bodyCharStart": page_start,
                "bodyCharEnd": page_end,
                "matchCharStart": overlap_start,
                "matchCharEnd": overlap_end,
                "normalizedTextSha256": page_digest,
                "ocrCandidate": ocr_candidate,
                "extractionStatus": extraction_status,
            }
        )
    if not receipts:
        return [], "semantic-match-page-location-missing"

    coverage_cursor = match_start
    for receipt in receipts:
        receipt_start = int(receipt["matchCharStart"])
        receipt_end = int(receipt["matchCharEnd"])
        if receipt_start < coverage_cursor:
            return receipts, "semantic-match-page-location-overlap"
        if _normalized_text(body[coverage_cursor:receipt_start]):
            return receipts, "semantic-match-non-whitespace-gap"
        coverage_cursor = receipt_end
    if _normalized_text(body[coverage_cursor:match_end]):
        return receipts, "semantic-match-non-whitespace-gap"
    return receipts, None


def _assert_upstream_boundaries(
    packet: JsonObject,
    pdf_audit: JsonObject,
    lifecycle_audit: JsonObject,
) -> None:
    if (
        _text(packet.get("verdict")) != "EXACT_PROMOTION_PACKET_READY_FOR_OPERATOR_REVIEW"
        or packet.get("exactPromotionPerformed") is not False
        or packet.get("mutationPerformed") is not False
    ):
        raise ReviewerSupportError("reviewer-support-packet-boundary-mismatch")
    if (
        _text(pdf_audit.get("verdict"))
        != "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED"
        or _integer(pdf_audit.get("machineVerifiedCount")) != 8
        or _integer(pdf_audit.get("failedCount")) != 0
        or pdf_audit.get("exactPromotionPerformed") is not False
    ):
        raise ReviewerSupportError("reviewer-support-pdf-audit-not-ready")
    if (
        _text(lifecycle_audit.get("verdict"))
        != "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED"
        or _integer(lifecycle_audit.get("machineLifecycleSupportedCount")) != 8
        or _integer(lifecycle_audit.get("exactTitleIdentityMatchCount")) != 8
        or _integer(lifecycle_audit.get("titleVariantFindingCount")) != 0
        or _integer(lifecycle_audit.get("failedCount")) != 0
        or lifecycle_audit.get("exactPromotionPerformed") is not False
    ):
        raise ReviewerSupportError("reviewer-support-lifecycle-audit-not-ready")


def build_report(
    root_dir: Path,
    packet_path: Path = DEFAULT_PACKET_PATH,
    pdf_audit_path: Path = DEFAULT_PDF_AUDIT_PATH,
    lifecycle_audit_path: Path = DEFAULT_LIFECYCLE_AUDIT_PATH,
    body_current_path: Path = DEFAULT_BODY_CURRENT_PATH,
    body_root: Path = DEFAULT_BODY_ROOT,
) -> JsonObject:
    packet = _read_json(root_dir / packet_path)
    pdf_audit = _read_json(root_dir / pdf_audit_path)
    lifecycle_audit = _read_json(root_dir / lifecycle_audit_path)
    _assert_upstream_boundaries(packet, pdf_audit, lifecycle_audit)

    candidates_value = packet.get("candidates")
    candidates = candidates_value if isinstance(candidates_value, list) else []
    if len(candidates) != 8 or not all(isinstance(value, dict) for value in candidates):
        raise ReviewerSupportError(f"reviewer-support-candidate-count:{len(candidates)}")
    typed_candidates = [value for value in candidates if isinstance(value, dict)]
    try:
        corpus_binding = build_corpus_binding(
            root_dir,
            body_current_path,
            body_root,
            typed_candidates,
        )
        require_packet_corpus_binding(packet, corpus_binding)
    except RuntimeError as error:
        raise ReviewerSupportError(str(error)) from error
    packet_sha256 = sha256_file(root_dir / packet_path)
    binding_sha256 = _text(corpus_binding.get("bindingSha256"))
    for label, upstream in (("pdf", pdf_audit), ("lifecycle", lifecycle_audit)):
        upstream_binding = upstream.get("corpusBinding")
        if (
            not isinstance(upstream_binding, dict)
            or _text(upstream_binding.get("bindingSha256")) != binding_sha256
            or _text(upstream.get("packetSha256")) != packet_sha256
        ):
            raise ReviewerSupportError(f"reviewer-support-{label}-corpus-binding-mismatch")

    current = _read_json(root_dir / body_current_path)
    snapshot_path = _text(current.get("snapshot_path"))
    if not snapshot_path:
        raise ReviewerSupportError("reviewer-support-body-snapshot-missing")
    items_path = root_dir / body_root / snapshot_path / "items.jsonl.gz"
    body_rows = _read_gzip_jsonl(items_path)
    body_by_key = {_text(row.get("stable_key")): row for row in body_rows}
    results: list[JsonObject] = []
    for candidate_value in candidates:
        if not isinstance(candidate_value, dict):
            raise ReviewerSupportError("reviewer-support-invalid-candidate")
        stable_key = _text(candidate_value.get("stableKey"))
        body_row = body_by_key.get(stable_key)
        groups = SEMANTIC_GROUPS.get(stable_key)
        if body_row is None or groups is None:
            raise ReviewerSupportError(f"reviewer-support-missing-source:{stable_key}")
        body = _text(body_row.get("body"))
        normalized_body = _normalized_text(body)
        group_rows: list[JsonObject] = []
        for index, terms in enumerate(groups, start=1):
            matched_terms = [term for term in terms if term in normalized_body]
            first_term = matched_terms[0] if matched_terms else ""
            excerpt, match_start, match_end = (
                _match_context(body, first_term) if first_term else ("", -1, -1)
            )
            page_receipts, location_mapping_failure = (
                _page_receipts(body_row, body, match_start, match_end)
                if match_start >= 0 and match_end > match_start
                else ([], "semantic-match-location-unavailable")
            )
            group_rows.append(
                {
                    "group": index,
                    "requiredAny": list(terms),
                    "matchedTerms": matched_terms,
                    "evidenceTerm": first_term,
                    "excerpt": excerpt,
                    "matchBodyCharStart": match_start,
                    "matchBodyCharEnd": match_end,
                    "pageReceipts": page_receipts,
                    "locationMappingComplete": location_mapping_failure is None,
                    "locationMappingFailure": location_mapping_failure,
                    "machineSupported": (
                        bool(matched_terms)
                        and bool(excerpt)
                        and bool(page_receipts)
                        and location_mapping_failure is None
                    ),
                }
            )
        failed_groups = [row["group"] for row in group_rows if row["machineSupported"] is not True]
        results.append(
            {
                "stableKey": stable_key,
                "version": _text(candidate_value.get("version")),
                "officialCurrentTitle": _text(candidate_value.get("officialCurrentTitle")),
                "sourceTitle": _text(candidate_value.get("sourceTitle")),
                "rationale": _text(candidate_value.get("rationale")),
                "normalizedCharCount": _integer(candidate_value.get("normalizedCharCount")),
                "pageCount": _integer(candidate_value.get("pageCount")),
                "semanticGroups": group_rows,
                "failedSemanticGroups": failed_groups,
                "contentRationaleMachineSupported": not failed_groups,
                "humanReviewCompleted": False,
                "humanConfirmed": False,
            }
        )

    passed_count = sum(1 for row in results if row["contentRationaleMachineSupported"] is True)
    failed_count = len(results) - passed_count
    verdict = (
        "PASS_MACHINE_REVIEWER_SUPPORT_HUMAN_CONFIRMATION_REQUIRED"
        if failed_count == 0
        else "RED_PROMOTION_CANDIDATE_CONTENT_RATIONALE_MISMATCH"
    )
    return {
        "schemaVersion": "safeclaw-kosha-exact-promotion-reviewer-support/v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceHead": _git_head(root_dir),
        "verdict": verdict,
        "scope": "read-only semantic support for the bounded KOSHA exact-promotion human review",
        "candidateCount": len(results),
        "machineSupportedCount": passed_count,
        "failedCount": failed_count,
        "semanticGroupCount": sum(len(row["semanticGroups"]) for row in results),
        "failedSemanticGroupCount": sum(len(row["failedSemanticGroups"]) for row in results),
        "pageReceiptCount": sum(
            len(group["pageReceipts"])
            for row in results
            for group in row["semanticGroups"]
        ),
        "semanticGroupsWithoutPageReceipt": sum(
            1
            for row in results
            for group in row["semanticGroups"]
            if not group["pageReceipts"]
        ),
        "bodySnapshotId": _text(current.get("snapshot_id")),
        "bodySourceIdentitySha256": _text(current.get("source_identity_sha256")),
        "corpusBinding": corpus_binding,
        "upstreamArtifacts": {
            "packet": {"path": packet_path.as_posix(), "sha256": packet_sha256},
            "pdfAudit": {"path": pdf_audit_path.as_posix(), "sha256": sha256_file(root_dir / pdf_audit_path)},
            "lifecycleAudit": {
                "path": lifecycle_audit_path.as_posix(),
                "sha256": sha256_file(root_dir / lifecycle_audit_path),
            },
        },
        "results": results,
        "reviewBoundary": {
            "humanReviewCompleted": False,
            "reviewChecklistComplete": False,
            "reviewerRecorded": False,
            "reviewedAtRecorded": False,
            "humanConfirmationRecorded": False,
            "machineEvidenceReplacesHumanReview": False,
        },
        "mutationBoundary": {
            "dbMutationPerformed": False,
            "providerDispatchCalled": False,
            "shareSessionCreated": False,
            "embeddingGenerated": False,
            "vectorUploadPerformed": False,
            "exactTrustRegistryMutationPerformed": False,
        },
        "exactPromotionPerformed": False,
        "exactRegistryWriteArtifactCreated": False,
        "separatePromotionApprovalRequired": True,
        "safeClaims": [
            "All passing candidates contain candidate-specific semantic evidence supporting their packet rationale.",
            "The report provides bounded excerpts for operator review without confirming the human checklist.",
        ],
        "forbiddenClaims": [
            "Human review is complete.",
            "The exact-kosha registry was promoted.",
            "Machine semantic support replaces reviewer, reviewedAt, or humanConfirmed.",
        ],
    }


def render_markdown(report: JsonObject) -> str:
    rows_value = report.get("results")
    rows = rows_value if isinstance(rows_value, list) else []
    table_rows: list[str] = []
    details: list[str] = []
    for value in rows:
        if not isinstance(value, dict):
            continue
        groups_value = value.get("semanticGroups")
        groups = groups_value if isinstance(groups_value, list) else []
        matched = [
            "/".join(group.get("matchedTerms", []))
            for group in groups
            if isinstance(group, dict)
        ]
        table_rows.append(
            f"| {_text(value.get('stableKey'))} | {_text(value.get('officialCurrentTitle'))} | "
            f"{' · '.join(matched)} | {'PASS' if value.get('contentRationaleMachineSupported') is True else 'RED'} |"
        )
        detail_lines = [
            f"### {_text(value.get('stableKey'))} · {_text(value.get('officialCurrentTitle'))}",
            "",
            f"Rationale: {_text(value.get('rationale'))}",
            "",
        ]
        for group in groups:
            if not isinstance(group, dict):
                continue
            detail_lines.extend(
                [
                    f"- Group {_integer(group.get('group'))}: matched `{', '.join(group.get('matchedTerms', []))}`",
                    f"  - Excerpt: {_text(group.get('excerpt'))}",
                    "  - Page receipts: " + ", ".join(
                        f"p.{_integer(receipt.get('pageNumber'))} "
                        f"chars {_integer(receipt.get('matchCharStart'))}-{_integer(receipt.get('matchCharEnd'))} "
                        f"sha {_text(receipt.get('normalizedTextSha256'))[:12]}"
                        for receipt in group.get("pageReceipts", [])
                        if isinstance(receipt, dict)
                    ),
                ]
            )
        details.append("\n".join(detail_lines))
    return f"""# KOSHA Exact Promotion Reviewer Support

- Verdict: `{_text(report.get("verdict"))}`
- Source HEAD: `{_text(report.get("sourceHead"))}`
- Candidates: `{_integer(report.get("candidateCount"))}`
- Machine-supported candidates: `{_integer(report.get("machineSupportedCount"))}`
- Semantic groups: `{_integer(report.get("semanticGroupCount"))}`
- Failed semantic groups: `{_integer(report.get("failedSemanticGroupCount"))}`
- Page receipts: `{_integer(report.get("pageReceiptCount"))}`
- Semantic groups without page receipt: `{_integer(report.get("semanticGroupsWithoutPageReceipt"))}`
- Human review completed: `false`
- Exact promotion performed: `false`

| Stable key | Official current title | Matched semantic evidence | Machine support |
| --- | --- | --- | --- |
{chr(10).join(table_rows)}

## Candidate Evidence

{chr(10).join(details)}

## Boundary

This report supports reviewer inspection only. It does not fill reviewer,
reviewedAt, humanConfirmed, or any required review checkbox, and it does not
create an exact-registry artifact. Separate human review and promotion approval
remain mandatory.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build read-only semantic reviewer support for KOSHA exact-promotion candidates"
    )
    parser.add_argument("--root-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--packet", type=Path, default=DEFAULT_PACKET_PATH)
    parser.add_argument("--pdf-audit", type=Path, default=DEFAULT_PDF_AUDIT_PATH)
    parser.add_argument("--lifecycle-audit", type=Path, default=DEFAULT_LIFECYCLE_AUDIT_PATH)
    parser.add_argument("--body-current", type=Path, default=DEFAULT_BODY_CURRENT_PATH)
    parser.add_argument("--body-root", type=Path, default=DEFAULT_BODY_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root_dir = args.root_dir.resolve()
    report = build_report(
        root_dir=root_dir,
        packet_path=args.packet,
        pdf_audit_path=args.pdf_audit,
        lifecycle_audit_path=args.lifecycle_audit,
        body_current_path=args.body_current,
        body_root=args.body_root,
    )
    output_dir = root_dir / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "report.md").write_text(render_markdown(report), encoding="utf-8")
    print(
        json.dumps(
            {
                "verdict": report["verdict"],
                "candidateCount": report["candidateCount"],
                "machineSupportedCount": report["machineSupportedCount"],
                "outputDir": args.output_dir.as_posix(),
            },
            ensure_ascii=False,
        )
    )
    return 0 if report["failedCount"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
