from __future__ import annotations

import argparse
import gzip
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def _excerpt(body: str, term: str, radius: int = 90) -> str:
    compact = re.sub(r"\s+", " ", body).strip()
    normalized_chars: list[str] = []
    source_indexes: list[int] = []
    for source_index, character in enumerate(compact):
        if character.isspace():
            continue
        normalized_chars.append(character)
        source_indexes.append(source_index)
    normalized = "".join(normalized_chars)
    normalized_term = _normalized_text(term)
    normalized_index = normalized.find(normalized_term)
    if normalized_index < 0 or not normalized_term:
        return ""
    source_start = source_indexes[normalized_index]
    source_end_index = normalized_index + len(normalized_term) - 1
    source_end = source_indexes[source_end_index] + 1
    start = max(0, source_start - radius)
    end = min(len(compact), source_end + radius)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(compact) else ""
    return f"{prefix}{compact[start:end]}{suffix}"


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

    current = _read_json(root_dir / body_current_path)
    snapshot_path = _text(current.get("snapshot_path"))
    if not snapshot_path:
        raise ReviewerSupportError("reviewer-support-body-snapshot-missing")
    items_path = root_dir / body_root / snapshot_path / "items.jsonl.gz"
    body_rows = _read_gzip_jsonl(items_path)
    body_by_key = {_text(row.get("stable_key")): row for row in body_rows}
    candidates_value = packet.get("candidates")
    candidates = candidates_value if isinstance(candidates_value, list) else []
    if len(candidates) != 8:
        raise ReviewerSupportError(f"reviewer-support-candidate-count:{len(candidates)}")

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
            excerpt = _excerpt(body, first_term) if first_term else ""
            group_rows.append(
                {
                    "group": index,
                    "requiredAny": list(terms),
                    "matchedTerms": matched_terms,
                    "excerpt": excerpt,
                    "machineSupported": bool(matched_terms) and bool(excerpt),
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
