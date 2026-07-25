from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit


JsonObject = dict[str, object]
PageFetcher = Callable[[str, bool, int, int, float, int], tuple[list[JsonObject], int]]

SCHEMA_VERSION = "safeclaw-kosha-exact-official-lifecycle-audit/v1"
OFFICIAL_API_URL = "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList"
DEFAULT_PACKET_PATH = Path("evaluation/kosha-exact-promotion-packet-2026-07-22/report.json")
DEFAULT_OUTPUT_DIR = Path("evaluation/kosha-exact-official-lifecycle-audit-2026-07-25")
VERSION_PATTERN = re.compile(r"^(?P<stable>.+)-(?P<year>\d{4})$")


class LifecycleAuditError(RuntimeError):
    pass


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _integer(value: object) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return 0


def _read_json(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise LifecycleAuditError(f"invalid-json-object:{path}")
    return value


def _git_head(root_dir: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root_dir,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _format_date(value: object) -> str:
    text = _text(value)
    if re.fullmatch(r"\d{8}", text):
        return f"{text[0:4]}-{text[4:6]}-{text[6:8]}"
    return text


def _stable_key(version: str) -> str:
    match = VERSION_PATTERN.fullmatch(version)
    return match.group("stable") if match else ""


def _normalize_official_row(row: JsonObject, state: str) -> JsonObject:
    version = _text(row.get("techGdlnNo"))
    file_id = _text(row.get("techGdlnOrgnlAtcflNo")) or _text(row.get("techGdlnPdfTrsfAtcflNo"))
    file_sequence = _integer(row.get("techGdlnOrgnlAtcflNoSeq"))
    return {
        "stableKey": _stable_key(version),
        "version": version,
        "title": _text(row.get("techGdlnNm")),
        "publishedAt": _format_date(row.get("techGdlnOfancYmd") or row.get("techGdlnEnctmYmd")),
        "officialFileId": file_id,
        "officialFileSequence": file_sequence,
        "statusCode": _text(row.get("techGdlnSttsSeCd")),
        "statusLabel": _text(row.get("techGdlnSttsSeCdSt")),
        "category": _text(row.get("techGdlnCtgryCd")),
        "stateQuery": state,
    }


def _post_official_page(
    category: str,
    current: bool,
    page: int,
    rows_per_page: int,
    timeout_seconds: float,
    retries: int,
) -> tuple[list[JsonObject], int]:
    request_body = {
        "techGdlnCtgryCd": category,
        "techGdlnSttsSeCdIng": "1" if current else "0",
        "techGdlnSttsSeCdDel": "0" if current else "1",
        "startDt": None,
        "endDt": None,
        "searchType": "all",
        "searchVal": None,
        "page": page,
        "rowsPerPage": str(rows_per_page),
    }
    payload = json.dumps(request_body, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        request = urllib.request.Request(
            OFFICIAL_API_URL,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "SafeClaw-KOSHA-Lifecycle-Audit/1.0",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                if int(response.status) != 200:
                    raise LifecycleAuditError(f"official-api-http:{response.status}")
                decoded = json.loads(response.read().decode("utf-8"))
                if not isinstance(decoded, dict) or decoded.get("result") != "success":
                    raise LifecycleAuditError("official-api-result-invalid")
                response_payload = decoded.get("payload")
                if not isinstance(response_payload, dict):
                    raise LifecycleAuditError("official-api-payload-invalid")
                rows_value = response_payload.get("list")
                if not isinstance(rows_value, list):
                    raise LifecycleAuditError("official-api-list-invalid")
                rows = [row for row in rows_value if isinstance(row, dict)]
                if len(rows) != len(rows_value):
                    raise LifecycleAuditError("official-api-row-invalid")
                total_count = _integer(response_payload.get("totalCount"))
                return rows, total_count
        except (TimeoutError, urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(0.5)
    raise LifecycleAuditError(
        f"official-api-request-failed:{category}:{'current' if current else 'retired'}:{page}:{last_error}"
    ) from last_error


def _fetch_state(
    categories: list[str],
    current: bool,
    timeout_seconds: float,
    retries: int,
    fetch_page: PageFetcher,
) -> tuple[list[JsonObject], JsonObject]:
    rows_per_page = 100
    all_rows: list[JsonObject] = []
    category_counts: JsonObject = {}
    request_count = 0
    empty_pages: list[str] = []
    for category in categories:
        first_rows, total_count = fetch_page(
            category,
            current,
            1,
            rows_per_page,
            timeout_seconds,
            retries,
        )
        request_count += 1
        category_counts[category] = total_count
        if total_count > 0 and not first_rows:
            empty_pages.append(f"{category}:1")
        all_rows.extend(first_rows)
        page_count = (total_count + rows_per_page - 1) // rows_per_page
        for page in range(2, page_count + 1):
            page_rows, page_total = fetch_page(
                category,
                current,
                page,
                rows_per_page,
                timeout_seconds,
                retries,
            )
            request_count += 1
            if page_total != total_count:
                raise LifecycleAuditError(
                    f"official-api-total-count-drift:{category}:{total_count}:{page_total}"
                )
            if not page_rows:
                empty_pages.append(f"{category}:{page}")
            all_rows.extend(page_rows)
    state = "current" if current else "retired"
    normalized = [_normalize_official_row(row, state) for row in all_rows]
    malformed_count = sum(
        1
        for row in normalized
        if not _text(row.get("stableKey")) or not _text(row.get("version"))
    )
    return normalized, {
        "state": state,
        "categories": categories,
        "categoryCounts": category_counts,
        "rowCount": len(normalized),
        "requestCount": request_count,
        "emptyPages": empty_pages,
        "malformedRowCount": malformed_count,
    }


def _packet_title_body(candidate: JsonObject) -> str:
    title = _text(candidate.get("title"))
    version = _text(candidate.get("version"))
    prefix = f"{version} "
    return title[len(prefix) :] if title.startswith(prefix) else title


def _official_url_matches(candidate: JsonObject, current_row: JsonObject) -> bool:
    parsed = urlsplit(_text(candidate.get("officialUrl")))
    parts = [part for part in parsed.path.split("/") if part]
    return (
        parsed.scheme == "https"
        and parsed.hostname == "portal.kosha.or.kr"
        and len(parts) >= 2
        and parts[-2] == _text(current_row.get("officialFileId"))
        and _integer(parts[-1]) == _integer(current_row.get("officialFileSequence"))
    )


def evaluate_candidate(
    candidate: JsonObject,
    current_rows: list[JsonObject],
    retired_rows: list[JsonObject],
) -> JsonObject:
    stable_key = _text(candidate.get("stableKey"))
    version = _text(candidate.get("version"))
    matching_current = [row for row in current_rows if _text(row.get("stableKey")) == stable_key]
    matching_retired = [row for row in retired_rows if _text(row.get("stableKey")) == stable_key]
    exact_current = [row for row in matching_current if _text(row.get("version")) == version]
    exact_retired = [row for row in matching_retired if _text(row.get("version")) == version]
    current_row = exact_current[0] if len(exact_current) == 1 else {}
    packet_title = _packet_title_body(candidate)
    current_title = _text(current_row.get("title"))
    title_exact_match = current_title == packet_title
    checks: JsonObject = {
        "singleCurrentStableKeyRow": len(matching_current) == 1,
        "singleExactCurrentVersionRow": len(exact_current) == 1,
        "packetVersionMatchesCurrent": _text(current_row.get("version")) == version,
        "packetPublicationDateMatchesCurrent": _text(current_row.get("publishedAt"))
        == _text(candidate.get("publishedAt")),
        "packetOfficialFileIdMatchesCurrent": _text(current_row.get("officialFileId"))
        == _text(candidate.get("officialFileId")),
        "packetOfficialUrlMatchesCurrentFile": _official_url_matches(candidate, current_row),
        "currentQueryStateRecorded": _text(current_row.get("stateQuery")) == "current",
        "packetVersionAbsentFromRetired": len(exact_retired) == 0,
        "noCompetingCurrentVersion": all(
            _text(row.get("version")) == version for row in matching_current
        ),
    }
    failed_checks = [name for name, passed in checks.items() if passed is not True]
    findings = [] if title_exact_match else ["officialTitleVariantRequiresHumanReview"]
    return {
        "stableKey": stable_key,
        "packetVersion": version,
        "packetTitle": packet_title,
        "currentOfficialTitle": current_title,
        "officialTitleExactMatch": title_exact_match,
        "currentVersions": sorted(_text(row.get("version")) for row in matching_current),
        "retiredVersions": sorted(_text(row.get("version")) for row in matching_retired),
        "currentOfficialFileId": _text(current_row.get("officialFileId")),
        "currentPublishedAt": _text(current_row.get("publishedAt")),
        "currentStatusCode": _text(current_row.get("statusCode")),
        "currentStatusLabel": _text(current_row.get("statusLabel")),
        "checks": checks,
        "failedChecks": failed_checks,
        "findings": findings,
        "machineLifecycleSupported": len(failed_checks) == 0,
        "operatorLifecycleCurrentStatusConfirmed": False,
        "humanConfirmed": False,
    }


def _canonical_sha256(rows: list[JsonObject]) -> str:
    canonical = json.dumps(
        rows,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_report(
    root_dir: Path,
    packet_path: Path,
    timeout_seconds: float,
    retries: int,
    fetch_page: PageFetcher = _post_official_page,
) -> JsonObject:
    started = time.perf_counter()
    packet = _read_json(root_dir / packet_path)
    candidates_value = packet.get("candidates")
    if not isinstance(candidates_value, list) or not candidates_value:
        raise LifecycleAuditError("packet-candidates-missing")
    candidates = [row for row in candidates_value if isinstance(row, dict)]
    if len(candidates) != len(candidates_value):
        raise LifecycleAuditError("packet-candidate-invalid")
    stable_keys = [_text(row.get("stableKey")) for row in candidates]
    if not all(stable_keys) or len(stable_keys) != len(set(stable_keys)):
        raise LifecycleAuditError("packet-candidate-set-invalid")

    categories = sorted({stable_key.split("-", maxsplit=1)[0] for stable_key in stable_keys})
    current_rows, current_summary = _fetch_state(
        categories,
        True,
        timeout_seconds,
        retries,
        fetch_page,
    )
    retired_rows, retired_summary = _fetch_state(
        categories,
        False,
        timeout_seconds,
        retries,
        fetch_page,
    )
    results = [
        evaluate_candidate(candidate, current_rows, retired_rows)
        for candidate in candidates
    ]
    passed_count = sum(1 for row in results if row.get("machineLifecycleSupported") is True)
    title_variant_count = sum(1 for row in results if row.get("officialTitleExactMatch") is False)
    total_count = len(results)
    relevant_current = [
        row for row in current_rows if _text(row.get("stableKey")) in set(stable_keys)
    ]
    relevant_retired = [
        row for row in retired_rows if _text(row.get("stableKey")) in set(stable_keys)
    ]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceHead": _git_head(root_dir),
        "verdict": (
            "RED_OFFICIAL_CURRENT_LIFECYCLE_MISMATCH"
            if passed_count != total_count
            else (
                "REVIEW_REQUIRED_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_TITLE_VARIANTS_UNRESOLVED"
                if title_variant_count > 0
                else "PASS_OFFICIAL_CURRENT_LIFECYCLE_MACHINE_SUPPORTED_HUMAN_REVIEW_REQUIRED"
            )
        ),
        "scope": "read-only current and retired KOSHA official-list reconciliation for the bounded promotion packet",
        "officialApiUrl": OFFICIAL_API_URL,
        "packetPath": packet_path.as_posix(),
        "candidateCount": total_count,
        "machineLifecycleSupportedCount": passed_count,
        "exactTitleIdentityMatchCount": total_count - title_variant_count,
        "failedCount": total_count - passed_count,
        "titleVariantFindingCount": title_variant_count,
        "elapsedMs": round((time.perf_counter() - started) * 1000),
        "officialInventory": {
            "current": current_summary,
            "retired": retired_summary,
            "relevantCurrentCanonicalSha256": _canonical_sha256(relevant_current),
            "relevantRetiredCanonicalSha256": _canonical_sha256(relevant_retired),
        },
        "results": results,
        "reviewChecklistImpact": {
            "officialCurrentAndRetiredListsMachineReconciled": passed_count == total_count,
            "packetVersionCurrentAndNotRetiredMachineSupported": passed_count == total_count,
            "officialTitleVariantsRequireHumanReview": title_variant_count > 0,
            "operatorLifecycleCurrentStatusConfirmed": False,
            "humanConfirmationRecorded": False,
            "reviewChecklistComplete": False,
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
        "separatePromotionApprovalRequired": True,
        "safeClaims": [
            "The official current and retired KOSHA lists were queried read-only for the candidate categories.",
            "Passing candidates have one matching current version and no identical version in the retired list.",
            "Passing current rows match packet version, publication date, file ID, and official download URL identity.",
            "Official-list title variants remain visible for human review rather than being normalized away.",
        ],
        "forbiddenClaims": [
            "Operator lifecycle review is complete.",
            "Human review is complete.",
            "The exact-kosha registry was mutated or promoted.",
            "Machine lifecycle support replaces separate exact-trust promotion approval.",
        ],
    }


def render_markdown(report: JsonObject) -> str:
    results_value = report.get("results")
    results = results_value if isinstance(results_value, list) else []
    table_rows: list[str] = []
    for value in results:
        if not isinstance(value, dict):
            continue
        machine_status = "RED"
        if value.get("machineLifecycleSupported") is True:
            machine_status = (
                "PASS"
                if value.get("officialTitleExactMatch") is True
                else "PASS_WITH_TITLE_REVIEW"
            )
        table_rows.append(
            "| {stable} | {version} | {retired} | {file_id} | {status} | {title_finding} |".format(
                stable=_text(value.get("stableKey")),
                version=", ".join(value.get("currentVersions", []))
                if isinstance(value.get("currentVersions"), list)
                else "",
                retired=", ".join(value.get("retiredVersions", []))
                if isinstance(value.get("retiredVersions"), list)
                else "",
                file_id=_text(value.get("currentOfficialFileId")),
                status=machine_status,
                title_finding=(
                    ""
                    if value.get("officialTitleExactMatch") is True
                    else f"Packet: {_text(value.get('packetTitle'))}<br>Official: {_text(value.get('currentOfficialTitle'))}"
                ),
            )
        )
    return f"""# KOSHA Exact Official Lifecycle Audit

- Verdict: `{_text(report.get("verdict"))}`
- Source HEAD: `{_text(report.get("sourceHead"))}`
- Candidates: `{_integer(report.get("candidateCount"))}`
- Machine lifecycle supported: `{_integer(report.get("machineLifecycleSupportedCount"))}`
- Exact official title identity matches: `{_integer(report.get("exactTitleIdentityMatchCount"))}`
- Title variants requiring human review: `{_integer(report.get("titleVariantFindingCount"))}`
- Failed: `{_integer(report.get("failedCount"))}`
- Exact promotion performed: `{str(report.get("exactPromotionPerformed")).lower()}`

| Stable key | Current version | Retired versions for stable key | Current file ID | Machine audit | Title finding |
| --- | --- | --- | --- | --- | --- |
{chr(10).join(table_rows)}

## Review Boundary

This audit queries the official KOSHA current and retired lists and reconciles the
bounded packet version, title, publication date, file ID, and download identity.
It records machine support for current/not-retired status only.

Operator lifecycle judgment, reviewer identity, reviewedAt, humanConfirmed, and
the separate exact-trust promotion approval remain incomplete. No DB, Share,
provider, embedding, vector, or exact-trust registry mutation is performed.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit current and retired KOSHA lifecycle state for exact-promotion candidates"
    )
    parser.add_argument("--root-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--packet", type=Path, default=DEFAULT_PACKET_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--timeout-seconds", type=float, default=20.0)
    parser.add_argument("--retries", type=int, default=1)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root_dir = args.root_dir.resolve()
    report = build_report(
        root_dir=root_dir,
        packet_path=args.packet,
        timeout_seconds=args.timeout_seconds,
        retries=args.retries,
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
                "machineLifecycleSupportedCount": report["machineLifecycleSupportedCount"],
                "outputDir": args.output_dir.as_posix(),
            },
            ensure_ascii=False,
        )
    )
    if report["failedCount"] != 0:
        return 1
    return 2 if report["titleVariantFindingCount"] != 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
