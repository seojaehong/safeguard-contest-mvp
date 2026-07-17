from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
import time
from collections.abc import Callable, Sequence
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import acquire_exact_kosha_body, snapshot_kosha_guide_corpus


TARGET_STABLE_KEY = "B-M-37"
TARGET_VERSION = "B-M-37-2026"
TARGET_FILE_ID = "CTC2026012913155142440463"
TARGET_FILE_SEQUENCE = 1
TARGET_TITLE = "B-M-37-2026 회전기계 등의 끼임·절단재해 예방을 위한 기술지원규정"
TARGET_MEMBER = f"{TARGET_TITLE}.pdf"
PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE = "c4d3684580b5e51ad403fa29fd1668ac35b04960"
EXPECTED_PDF_SHA256 = "85a8ff9713a684c0768cb2f210e0827e48e4801f0208cde178e8d0f5c6f4a05e"
EXPECTED_BODY_SHA256 = "a3aec8a392778a07389b3e3bdf51c5503b391ff5720c26d7dac3e99c4d24111d"
OFFICIAL_URL = (
    "https://portal.kosha.or.kr/openapi/v1/file/down/"
    f"{TARGET_FILE_ID}/{TARGET_FILE_SEQUENCE}"
)
DEFAULT_METADATA_PATH = (
    REPO_ROOT
    / "evaluation"
    / "kosha-official-metadata-promotion-2026-07-15"
    / "snapshots"
    / "c10572ee3531d9c66ca455265bf0d599f5eae5b01b8113daaa71ad5f9012a129"
    / "official-metadata.jsonl"
)
DEFAULT_OUTPUT_DIR = REPO_ROOT / "evaluation" / "b-m-37-acquisition-review-2026-07-16"
DEFAULT_CACHE_PATH = REPO_ROOT / ".cache" / "kosha-review" / f"{TARGET_VERSION}.pdf"
MAX_CONTEXT_CHARS = 120
MIN_ACTIONABLE_EXCERPT_CHARS = 40
MAX_ACTIONABLE_EXCERPT_CHARS = 280
CONTENT_START_PAGE = 5
PROTECTED_ROOTS = (
    REPO_ROOT / "data",
    REPO_ROOT / "knowledge",
    REPO_ROOT / "lib",
    REPO_ROOT / "supabase",
)

JsonObject = dict[str, object]
FetchBytes = Callable[[str], bytes]

CONTROL_TERMS: dict[str, tuple[str, ...]] = {
    "guards": ("방호덮개", "방호장치", "방호 울", "덮개", "가드"),
    "interlocks": ("인터록", "연동장치", "연동 장치", "연동"),
    "restart_prevention": ("재기동", "재가동", "불시기동", "기동 방지", "기동방지"),
    "loto": (
        "에너지 차단",
        "잠금·표지",
        "잠금 및 표지",
        "록아웃",
        "태그아웃",
        "Lockout",
        "tagout",
        "LOTO",
    ),
}
MAX_EXACT_MATCH_CHARS = max(len(term) for terms in CONTROL_TERMS.values() for term in terms)
ACTIONABLE_CONTROL_PATTERN = re.compile(
    r"(?:설치(?:한다|하여야|할|하고|되어|된)|"
    r"차단(?:한다|하여|할)|정지(?:한다|하여|할)|"
    r"방지(?:한다|하여|할)|사용(?:한다|하여|할)|"
    r"작동(?:한다|하지|할)|운전(?:하지|정지)|잠금|"
    r"점검(?:한다|하여|할)|접근(?:하지|방지)|격리)"
    r"|(?:준비한다|시험한다)"
)
SECTION_HEADING_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?P<number>"
    r"\d+(?:\.\d+){1,3}|"
    r"[1-7](?=\.(?:목적|적용범위|용어의정의|회전기계|위험동력기계))"
    r")\.?"
    r"(?P<title>"
    r"목적|적용범위|용어의정의|"
    r"[가-힣A-Za-z‧·,]+?"
    r"(?:위험방지|예방조치|계획검토|고장조사|추가적인조치|저장방법및위치|"
    r"저장조건|설치예비기기|점검|분류|관리|저장)"
    r")"
)


class ReviewPacketError(RuntimeError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)}\n", encoding="utf-8")


def load_official_metadata(path: Path) -> JsonObject:
    matches: list[JsonObject] = []
    with path.open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ReviewPacketError(f"metadata-row-invalid:{line_number}")
            if value.get("stable_key") == TARGET_STABLE_KEY:
                matches.append(value)
    if len(matches) != 1:
        raise ReviewPacketError(f"metadata-target-count:{len(matches)}")
    metadata = matches[0]
    expected = {
        "official_version": TARGET_VERSION,
        "official_file_id": TARGET_FILE_ID,
        "official_file_sequence": TARGET_FILE_SEQUENCE,
        "official_url": OFFICIAL_URL,
        "pdf_sha256": EXPECTED_PDF_SHA256,
        "body_sha256": EXPECTED_BODY_SHA256,
        "official_status": "current",
    }
    for field, expected_value in expected.items():
        if metadata.get(field) != expected_value:
            raise ReviewPacketError(f"metadata-{field}-mismatch")
    acquire_exact_kosha_body._validate_official_url(metadata["official_url"])
    return metadata


def fetch_official_pdf(url: str) -> bytes:
    return acquire_exact_kosha_body.fetch_official_pdf(
        url,
        timeout_seconds=20.0,
        retries=1,
    )


def load_or_fetch_pdf(cache_path: Path, fetch_bytes: FetchBytes) -> tuple[bytes, str]:
    if cache_path.is_file():
        cached = cache_path.read_bytes()
        cached_sha256 = sha256_bytes(cached)
        if cached_sha256 != EXPECTED_PDF_SHA256:
            raise ReviewPacketError(f"cached-pdf-sha256-mismatch:{cached_sha256}")
        return cached, "validated-local-cache"
    pdf_bytes = fetch_bytes(OFFICIAL_URL)
    actual_sha256 = sha256_bytes(pdf_bytes)
    if actual_sha256 != EXPECTED_PDF_SHA256:
        raise ReviewPacketError(f"pdf-sha256-mismatch:{actual_sha256}")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = cache_path.with_suffix(f"{cache_path.suffix}.tmp")
    temporary_path.write_bytes(pdf_bytes)
    temporary_path.replace(cache_path)
    return pdf_bytes, "official-download"


def extract_item(pdf_bytes: bytes) -> JsonObject:
    entry = snapshot_kosha_guide_corpus.LocalPdfEntry(
        archive_path=None,
        archive_name="official-direct-download",
        member_name=TARGET_MEMBER,
        category="기계안전분야",
        file_size=len(pdf_bytes),
        compressed_size=len(pdf_bytes),
        crc32=None,
    )
    provenance: JsonObject = {
        "official_list_url": snapshot_kosha_guide_corpus.OFFICIAL_LIST_URL,
        "official_api_url": snapshot_kosha_guide_corpus.OFFICIAL_API_URL,
    }
    item, failure = snapshot_kosha_guide_corpus._build_item(
        entry,
        pdf_bytes,
        provenance,
        snapshot_kosha_guide_corpus.ResourceLimits(),
    )
    if failure is not None or item.get("extraction_status") != "success":
        error_code = failure.get("error_code") if isinstance(failure, dict) else item.get("extraction_status")
        raise ReviewPacketError(f"extraction-failed:{error_code}")
    if item.get("stable_key") != TARGET_STABLE_KEY or item.get("version_key") != TARGET_VERSION:
        raise ReviewPacketError("extracted-document-identity-mismatch")
    return item


def normalized_body(item: JsonObject) -> str:
    body = item.get("body")
    if not isinstance(body, str):
        raise ReviewPacketError("extracted-body-missing")
    return snapshot_kosha_guide_corpus._normalized_for_hash(body)


def page_texts(item: JsonObject) -> list[tuple[int, str]]:
    body = item.get("body")
    pages = item.get("pages")
    if not isinstance(body, str) or not isinstance(pages, list):
        raise ReviewPacketError("extracted-page-map-missing")
    values: list[tuple[int, str]] = []
    for page in pages:
        if not isinstance(page, dict):
            raise ReviewPacketError("extracted-page-row-invalid")
        page_number = page.get("page_number")
        start = page.get("body_char_start")
        end = page.get("body_char_end")
        if not isinstance(page_number, int) or not isinstance(start, int) or not isinstance(end, int):
            raise ReviewPacketError("extracted-page-span-invalid")
        values.append((page_number, body[start:end]))
    return values


def detect_section_headings(page_text: str) -> list[JsonObject]:
    return [
        {
            "start": match.start(),
            "end": match.end(),
            "number": match.group("number"),
            "heading": match.group(0),
        }
        for match in SECTION_HEADING_PATTERN.finditer(page_text)
    ]


def non_overlapping_term_matches(page_text: str, terms: Sequence[str]) -> list[tuple[int, int, str]]:
    matches: list[tuple[int, int, str]] = []
    for term in sorted(terms, key=lambda value: (-len(value), value)):
        for match in re.finditer(re.escape(term), page_text, flags=re.IGNORECASE):
            candidate = (match.start(), match.end(), match.group(0))
            if any(candidate[0] < existing[1] and existing[0] < candidate[1] for existing in matches):
                continue
            matches.append(candidate)
    return sorted(matches)


def nearest_section(
    headings: Sequence[JsonObject],
    source_start: int,
    page_length: int,
) -> tuple[JsonObject, int, int, int]:
    preceding = [
        (index, heading)
        for index, heading in enumerate(headings)
        if isinstance(heading.get("start"), int) and int(heading["start"]) <= source_start
    ]
    if not preceding:
        next_start = int(headings[0]["start"]) if headings else page_length
        return {
            "status": "unknown",
            "number": None,
            "heading": None,
        }, 0, 0, next_start
    heading_index, heading = preceding[-1]
    if heading_index > 0:
        previous = headings[heading_index - 1]
        previous_end = previous.get("end")
        heading_start = heading.get("start")
        previous_number = str(previous.get("number"))
        heading_number = str(heading.get("number"))
        headings_are_adjacent = (
            isinstance(previous_end, int)
            and isinstance(heading_start, int)
            and 0 <= heading_start - previous_end <= 2
        )
        if headings_are_adjacent and previous_number.count(".") == heading_number.count("."):
            block_end = (
                int(headings[heading_index + 1]["start"])
                if heading_index + 1 < len(headings)
                else page_length
            )
            return {
                "status": "unknown",
                "number": None,
                "heading": None,
            }, 0, int(heading["end"]), block_end
    block_end = (
        int(headings[heading_index + 1]["start"])
        if heading_index + 1 < len(headings)
        else page_length
    )
    return {
        "status": "detected",
        "number": heading["number"],
        "heading": heading["heading"],
    }, heading_index + 1, int(heading["end"]), block_end


def bounded_actionable_excerpt(
    page_text: str,
    source_start: int,
    source_end: int,
    block_start: int,
    block_end: int,
) -> tuple[str, int, int]:
    excerpt_start = page_text.rfind(".", block_start, source_start) + 1
    next_boundary = page_text.find(".", source_end, block_end)
    excerpt_end = next_boundary + 1 if next_boundary >= 0 else block_end

    if excerpt_end - excerpt_start < MIN_ACTIONABLE_EXCERPT_CHARS:
        following_boundary = page_text.find(".", excerpt_end, block_end)
        if following_boundary >= 0:
            excerpt_end = following_boundary + 1
        if excerpt_end - excerpt_start < MIN_ACTIONABLE_EXCERPT_CHARS:
            preceding_boundary = page_text.rfind(
                ".",
                block_start,
                max(block_start, excerpt_start - 1),
            )
            excerpt_start = preceding_boundary + 1

    if excerpt_end - excerpt_start > MAX_ACTIONABLE_EXCERPT_CHARS:
        before_budget = min(100, source_start - block_start)
        excerpt_start = source_start - before_budget
        excerpt_end = min(block_end, excerpt_start + MAX_ACTIONABLE_EXCERPT_CHARS)
        if excerpt_end < source_end:
            excerpt_end = source_end
            excerpt_start = max(block_start, excerpt_end - MAX_ACTIONABLE_EXCERPT_CHARS)

    while excerpt_start < source_start and page_text[excerpt_start].isspace():
        excerpt_start += 1
    while excerpt_end > source_end and page_text[excerpt_end - 1].isspace():
        excerpt_end -= 1
    return page_text[excerpt_start:excerpt_end], excerpt_start, excerpt_end


def candidate_rank(candidate: JsonObject) -> tuple[int, int, int, int]:
    excerpt = str(candidate["actionableExcerpt"])
    has_control_language = ACTIONABLE_CONTROL_PATTERN.search(excerpt) is not None
    preferred_length_distance = abs(len(excerpt) - 140)
    return (
        1 if has_control_language else 0,
        0 if candidate.get("anchorInHeading") is True else 1,
        1 if len(excerpt) >= MIN_ACTIONABLE_EXCERPT_CHARS else 0,
        -preferred_length_distance,
    )


def build_candidates(item: JsonObject) -> list[JsonObject]:
    selected: dict[tuple[str, int, str], JsonObject] = {}
    for page_number, page_text in page_texts(item):
        if page_number < CONTENT_START_PAGE:
            continue
        headings = detect_section_headings(page_text)
        for category, terms in CONTROL_TERMS.items():
            for source_start, source_end, exact_match in non_overlapping_term_matches(page_text, terms):
                section, block_index, block_start, block_end = nearest_section(
                    headings,
                    source_start,
                    len(page_text),
                )
                section_key = str(section["number"] or "unknown")
                dedupe_key = (
                    (category, page_number, section_key)
                    if section_key != "unknown"
                    else (category, 0, section_key)
                )
                context_before_start = max(block_start, source_start - MAX_CONTEXT_CHARS)
                context_after_end = min(block_end, source_end + MAX_CONTEXT_CHARS)
                actionable_excerpt, excerpt_start, excerpt_end = bounded_actionable_excerpt(
                    page_text,
                    source_start,
                    source_end,
                    min(block_start, source_start),
                    block_end,
                )
                candidate: JsonObject = {
                    "category": category,
                    "page": page_number,
                    "pageLine": page_text.count("\n", 0, source_start) + 1,
                    "blockIndex": block_index,
                    "detectedSection": section,
                    "matchedTerms": [exact_match],
                    "exactCandidateSubstring": exact_match,
                    "actionableExcerpt": actionable_excerpt,
                    "contextBefore": page_text[context_before_start:source_start],
                    "contextAfter": page_text[source_end:context_after_end],
                    "sourceMatchStart": source_start,
                    "sourceMatchEnd": source_end,
                    "actionableExcerptStart": excerpt_start,
                    "actionableExcerptEnd": excerpt_end,
                    "anchorInHeading": source_start < block_start,
                }
                existing = selected.get(dedupe_key)
                if existing is None or candidate_rank(candidate) > candidate_rank(existing):
                    selected[dedupe_key] = candidate
    candidates = [
        candidate
        for candidate in selected.values()
        if candidate_rank(candidate)[0] == 1
    ]
    return sorted(
        candidates,
        key=lambda value: (
            int(value["page"]),
            int(value["sourceMatchStart"]),
            str(value["category"]),
        ),
    )


def candidate_metrics(candidates: Sequence[JsonObject]) -> JsonObject:
    detected = sum(
        1
        for candidate in candidates
        if isinstance(candidate.get("detectedSection"), dict)
        and candidate["detectedSection"].get("status") == "detected"
    )
    return {
        "candidateCount": len(candidates),
        "detectedSectionCandidateCount": detected,
        "unknownSectionCandidateCount": len(candidates) - detected,
        "maxExactMatchChars": max(
            (len(str(candidate["exactCandidateSubstring"])) for candidate in candidates),
            default=0,
        ),
        "maxContextBeforeChars": max(
            (len(str(candidate["contextBefore"])) for candidate in candidates),
            default=0,
        ),
        "maxContextAfterChars": max(
            (len(str(candidate["contextAfter"])) for candidate in candidates),
            default=0,
        ),
        "minActionableExcerptChars": min(
            (len(str(candidate["actionableExcerpt"])) for candidate in candidates),
            default=0,
        ),
        "maxActionableExcerptChars": max(
            (len(str(candidate["actionableExcerpt"])) for candidate in candidates),
            default=0,
        ),
        "actionableExcerptContractMinChars": MIN_ACTIONABLE_EXCERPT_CHARS,
        "actionableExcerptContractMaxChars": MAX_ACTIONABLE_EXCERPT_CHARS,
    }


def inventory_hashes(roots: Sequence[Path]) -> dict[str, str]:
    inventory: dict[str, str] = {}
    for root in roots:
        if not root.exists():
            continue
        for path in sorted(value for value in root.rglob("*") if value.is_file()):
            inventory[path.relative_to(REPO_ROOT).as_posix()] = sha256_bytes(path.read_bytes())
    return inventory


def ensure_evaluation_output(output_dir: Path) -> Path:
    resolved = output_dir.resolve()
    evaluation_root = (REPO_ROOT / "evaluation").resolve()
    try:
        resolved.relative_to(evaluation_root)
    except ValueError as exc:
        raise ReviewPacketError("output-outside-evaluation") from exc
    if resolved == evaluation_root:
        raise ReviewPacketError("output-must-be-evaluation-child")
    return resolved


def ensure_local_cache_path(cache_path: Path) -> Path:
    resolved = cache_path.resolve()
    cache_root = DEFAULT_CACHE_PATH.parent.resolve()
    try:
        resolved.relative_to(cache_root)
    except ValueError as exc:
        raise ReviewPacketError("cache-outside-ignored-local-root") from exc
    return resolved


def render_review_packet(
    metadata: JsonObject,
    item: JsonObject,
    candidates: list[JsonObject],
    cache_path: Path,
    pdf_size_bytes: int,
) -> str:
    by_category = {
        category: sum(1 for candidate in candidates if candidate["category"] == category)
        for category in CONTROL_TERMS
    }
    metrics = candidate_metrics(candidates)
    lines = [
        "# B-M-37-2026 Human Review Packet",
        "",
        "## Document identity",
        "",
        f"- Stable key: `{TARGET_STABLE_KEY}`",
        f"- Version: `{TARGET_VERSION}`",
        f"- Official file ID / sequence: `{TARGET_FILE_ID}` / `{TARGET_FILE_SEQUENCE}`",
        f"- Publication date: `{metadata.get('publication_date')}`",
        f"- Official URL: `{OFFICIAL_URL}`",
        f"- PDF SHA-256: `{EXPECTED_PDF_SHA256}`",
        f"- Normalized body SHA-256: `{EXPECTED_BODY_SHA256}`",
        f"- Official PDF byte size: `{pdf_size_bytes}`",
        f"- Pages / normalized characters: `{item.get('page_count')}` / `{item.get('normalized_char_count')}`",
        f"- Extractor: `{snapshot_kosha_guide_corpus.EXTRACTOR_VERSION}` / `pypdf=={snapshot_kosha_guide_corpus.PYPDF_VERSION}`",
        f"- Ignored local cache: `{cache_path.relative_to(REPO_ROOT).as_posix()}`",
        "- Copyright boundary: redistribution permission was not established; no PDF or full extracted body is included.",
        "",
        "## Candidate inventory",
        "",
    ]
    for category in CONTROL_TERMS:
        lines.append(f"- `{category}`: {by_category[category]}")
    lines.extend(
        [
            f"- Detected section candidates: {metrics['detectedSectionCandidateCount']}",
            f"- Explicitly unknown section candidates: {metrics['unknownSectionCandidateCount']}",
            f"- Maximum exact/context-before/context-after characters: `{metrics['maxExactMatchChars']}` / `{metrics['maxContextBeforeChars']}` / `{metrics['maxContextAfterChars']}`",
            f"- Actionable excerpt contract (min/max characters): `{MIN_ACTIONABLE_EXCERPT_CHARS}` / `{MAX_ACTIONABLE_EXCERPT_CHARS}`",
            f"- Observed actionable excerpt range: `{metrics['minActionableExcerptChars']}` / `{metrics['maxActionableExcerptChars']}`",
        ]
    )
    lines.extend(["", "## Exact candidates", ""])
    if candidates:
        for index, candidate in enumerate(candidates, start=1):
            lines.extend(
                [
                    f"### {index}. {candidate['category']} - page {candidate['page']}",
                    "",
                    f"- Section status: `{candidate['detectedSection']['status']}`",
                    f"- Detected section: `{candidate['detectedSection']['heading'] or 'unknown'}`",
                    f"- Matched terms: `{', '.join(candidate['matchedTerms'])}`",
                    f"- Exact keyword anchor: `{candidate['exactCandidateSubstring']}`",
                    f"- Bounded exact source clause: `{candidate['actionableExcerpt']}`",
                    "",
                ]
            )
    else:
        lines.extend(["No keyword candidates were found. Do not infer absent controls.", ""])
    lines.extend(
        [
            "## Reviewer checklist",
            "",
            "- [ ] Confirm the document identity against the official PDF.",
            "- [ ] Confirm each quoted substring is exact and remains in its stated page and section.",
            "- [ ] Classify whether each candidate is mandatory language, guidance, definition, example, or cross-reference.",
            "- [ ] Reject keyword matches that do not govern guards, interlocks, restart prevention, or LOTO.",
            "- [ ] Record missing categories explicitly; do not infer controls not stated in the document.",
            "- [ ] Keep this packet evaluation-only until a separate authorized trust workflow is completed.",
            "",
            "## Scope boundary",
            "",
            f"This packet is unsigned and evaluation-only. Redistribution permission for the source was not established, so the final tree contains only bounded candidate context and immutable provenance. The removed source artifacts remain reachable only in prior unpushed commit `{PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE}`. This packet does not update product trust pins, production registries, Phase A mappings, databases, migrations, or Supabase.",
            "",
        ]
    )
    return "\n".join(lines)


def build_unsigned_receipt(
    metadata: JsonObject,
    item: JsonObject,
    candidates: list[JsonObject],
    pdf_size_bytes: int,
) -> JsonObject:
    return {
        "schemaVersion": "safeclaw-b-m-37-human-review-receipt/v1",
        "status": "unsigned",
        "decision": None,
        "reviewerName": None,
        "reviewerOrganization": None,
        "signedAt": None,
        "document": {
            "stableKey": TARGET_STABLE_KEY,
            "version": TARGET_VERSION,
            "officialFileId": TARGET_FILE_ID,
            "officialFileSequence": TARGET_FILE_SEQUENCE,
            "officialUrl": OFFICIAL_URL,
            "publicationDate": metadata.get("publication_date"),
            "pdfSha256": EXPECTED_PDF_SHA256,
            "pdfSizeBytes": pdf_size_bytes,
            "normalizedBodySha256": EXPECTED_BODY_SHA256,
            "pageCount": item.get("page_count"),
        },
        "candidateCount": len(candidates),
        "reviewChecklistComplete": False,
        "evaluationOnly": True,
        "productionTrustMutationAuthorized": False,
        "sourceRedistributionPermissionEstablished": False,
    }


def failure_report(
    error_message: str,
    elapsed_seconds: float,
    production_trust_mutation_count: int,
) -> JsonObject:
    return {
        "schemaVersion": "safeclaw-b-m-37-acquisition-report/v1",
        "status": "fail-closed",
        "targetCount": 1,
        "successCount": 0,
        "failureCount": 1,
        "candidateCount": 0,
        "elapsedSeconds": round(elapsed_seconds, 3),
        "error": error_message,
        "contentPublished": False,
        "fullSourceArtifactsTrackedInFinalTree": False,
        "priorUnpushedCommitWithRemovedSource": PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE,
        "sourceRedistributionPermissionEstablished": False,
        "copyrightBoundary": "permission-unknown-no-source-redistribution",
        "evaluationOnly": True,
        "productionTrustMutationCount": production_trust_mutation_count,
    }


def run_acquisition(
    metadata_path: Path,
    output_dir: Path,
    cache_path: Path = DEFAULT_CACHE_PATH,
    fetch_bytes: FetchBytes = fetch_official_pdf,
) -> JsonObject:
    started = time.perf_counter()
    safe_output = ensure_evaluation_output(output_dir)
    safe_cache = ensure_local_cache_path(cache_path)
    protected_before = inventory_hashes(PROTECTED_ROOTS)
    safe_output.parent.mkdir(parents=True, exist_ok=True)
    temporary_dir = Path(tempfile.mkdtemp(prefix=".b-m-37-review-", dir=safe_output.parent))
    try:
        metadata = load_official_metadata(metadata_path)
        pdf_bytes, acquisition_source = load_or_fetch_pdf(safe_cache, fetch_bytes)
        actual_pdf_sha256 = sha256_bytes(pdf_bytes)
        if actual_pdf_sha256 != EXPECTED_PDF_SHA256:
            raise ReviewPacketError(f"pdf-sha256-mismatch:{actual_pdf_sha256}")
        item = extract_item(pdf_bytes)
        body = normalized_body(item)
        actual_body_sha256 = sha256_bytes(body.encode("utf-8"))
        if actual_body_sha256 != EXPECTED_BODY_SHA256:
            raise ReviewPacketError(f"normalized-body-sha256-mismatch:{actual_body_sha256}")
        candidates = build_candidates(item)
        write_json(temporary_dir / "candidates.json", candidates)
        write_json(
            temporary_dir / "unsigned-receipt.json",
            build_unsigned_receipt(metadata, item, candidates, len(pdf_bytes)),
        )
        (temporary_dir / "review-packet.md").write_text(
            render_review_packet(metadata, item, candidates, safe_cache, len(pdf_bytes)),
            encoding="utf-8",
        )
        protected_after = inventory_hashes(PROTECTED_ROOTS)
        changed_protected = sorted(
            path
            for path in set(protected_before) | set(protected_after)
            if protected_before.get(path) != protected_after.get(path)
        )
        if changed_protected:
            raise ReviewPacketError(f"production-trust-mutation:{','.join(changed_protected)}")
        elapsed = time.perf_counter() - started
        counts = {
            category: sum(1 for candidate in candidates if candidate["category"] == category)
            for category in CONTROL_TERMS
        }
        metrics = candidate_metrics(candidates)
        report: JsonObject = {
            "schemaVersion": "safeclaw-b-m-37-acquisition-report/v1",
            "status": "acquired-hash-verified-review-pending",
            "targetCount": 1,
            "successCount": 1,
            "failureCount": 0,
            "candidateCount": len(candidates),
            "candidateCounts": counts,
            "candidateMetrics": metrics,
            "elapsedSeconds": round(elapsed, 3),
            "officialUrl": OFFICIAL_URL,
            "officialPdfSizeBytes": len(pdf_bytes),
            "pdfSha256": actual_pdf_sha256,
            "normalizedBodySha256": actual_body_sha256,
            "pageCount": item.get("page_count"),
            "normalizedCharCount": len(body),
            "extractorVersion": snapshot_kosha_guide_corpus.EXTRACTOR_VERSION,
            "extractorDependency": f"pypdf=={snapshot_kosha_guide_corpus.PYPDF_VERSION}",
            "acquisitionSource": acquisition_source,
            "ignoredLocalCachePath": safe_cache.relative_to(REPO_ROOT).as_posix(),
            "fullSourceArtifactsTrackedInFinalTree": False,
            "priorUnpushedCommitWithRemovedSource": PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE,
            "sourceRedistributionPermissionEstablished": False,
            "copyrightBoundary": "permission-unknown-no-source-redistribution",
            "evaluationOnly": True,
            "humanReviewStatus": "pending",
            "productionTrustMutationCount": 0,
            "dbMutationPerformed": False,
            "migrationPerformed": False,
            "supabaseWritePerformed": False,
            "phaseAMappingChanged": False,
        }
        write_json(temporary_dir / "report.json", report)
        (temporary_dir / "report.md").write_text(
            "\n".join(
                [
                    "# B-M-37 Acquisition Report",
                    "",
                    f"- Status: `{report['status']}`",
                    f"- Targets / success / failure: `{report['targetCount']}` / `{report['successCount']}` / `{report['failureCount']}`",
                    f"- Candidates: `{report['candidateCount']}`",
                    f"- Candidate counts: `{canonical_json(counts)}`",
                    f"- Candidate metrics: `{canonical_json(metrics)}`",
                    f"- PDF SHA-256: `{actual_pdf_sha256}`",
                    f"- Official PDF byte size: `{len(pdf_bytes)}`",
                    f"- Normalized body SHA-256: `{actual_body_sha256}`",
                    f"- Pages / normalized characters: `{report['pageCount']}` / `{report['normalizedCharCount']}`",
                    f"- Elapsed seconds: `{report['elapsedSeconds']}`",
                    "- Production trust mutations: `0`",
                    "- Human review: `pending`",
                    "- Copyright boundary: `permission-unknown-no-source-redistribution`",
                    f"- Ignored local cache: `{safe_cache.relative_to(REPO_ROOT).as_posix()}`",
                    "- Full-source artifacts tracked in final tree: `false`",
                    f"- Prior unpushed commit with removed source: `{PRIOR_UNPUSHED_COMMIT_WITH_REMOVED_SOURCE}`",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        if safe_output.exists():
            shutil.rmtree(safe_output)
        temporary_dir.replace(safe_output)
        return report
    except Exception as exc:
        shutil.rmtree(temporary_dir, ignore_errors=True)
        protected_after_failure = inventory_hashes(PROTECTED_ROOTS)
        production_trust_mutation_count = sum(
            1
            for path in set(protected_before) | set(protected_after_failure)
            if protected_before.get(path) != protected_after_failure.get(path)
        )
        if safe_output.exists():
            shutil.rmtree(safe_output)
        safe_output.mkdir(parents=True, exist_ok=True)
        report = failure_report(
            f"{type(exc).__name__}:{exc}",
            time.perf_counter() - started,
            production_trust_mutation_count,
        )
        write_json(safe_output / "report.json", report)
        (safe_output / "report.md").write_text(
            "\n".join(
                [
                    "# B-M-37 Acquisition Report",
                    "",
                    "- Status: `fail-closed`",
                    "- Targets / success / failure: `1` / `0` / `1`",
                    f"- Error: `{report['error']}`",
                    "- Content published: `false`",
                    "- Copyright boundary: `permission-unknown-no-source-redistribution`",
                    f"- Production trust mutations: `{production_trust_mutation_count}`",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        raise


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Acquire B-M-37 and build an evaluation-only review packet.")
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--cache-path", type=Path, default=DEFAULT_CACHE_PATH)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = run_acquisition(args.metadata, args.output_dir, args.cache_path)
    except Exception as exc:
        print(f"B-M-37 acquisition failed closed: {exc}", file=sys.stderr)
        return 1
    print(f"B-M-37 acquisition complete: {canonical_json(report)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
