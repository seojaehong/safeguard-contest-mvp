from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.parse import urljoin, urlsplit

import snapshot_kosha_guide_corpus


JsonObject = dict[str, object]
Downloader = Callable[[str, Path, float, int], tuple[int, str, str, int]]

SCHEMA_VERSION = "safeclaw-kosha-exact-official-pdf-audit/v1"
DEFAULT_PACKET_PATH = Path("evaluation/kosha-exact-promotion-packet-2026-07-22/report.json")
DEFAULT_METADATA_PATH = Path(
    "data/safety-knowledge/kosha-official-metadata/official-metadata-2026-07-15.jsonl"
)
DEFAULT_BODY_CURRENT_PATH = Path("data/safety-knowledge/kosha-guide-corpus/current.json")
DEFAULT_BODY_ROOT = Path("data/safety-knowledge/kosha-guide-corpus")
DEFAULT_OUTPUT_DIR = Path("evaluation/kosha-exact-official-pdf-audit-2026-07-25")
OFFICIAL_HOST = "portal.kosha.or.kr"
STABLE_KEY_PATTERN = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)+$")


class AuditError(RuntimeError):
    pass


@dataclass(frozen=True)
class DownloadObservation:
    status: int
    content_type: str
    final_url: str
    content_length: int
    downloaded_bytes: int
    pdf_sha256: str
    pdf_magic: bool


def _read_json(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AuditError(f"invalid-json-object:{path}")
    return value


def _read_jsonl(path: Path) -> list[JsonObject]:
    rows: list[JsonObject] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise AuditError(f"invalid-jsonl-row:{path}:{line_number}")
        rows.append(value)
    return rows


def _read_gzip_jsonl(path: Path) -> list[JsonObject]:
    rows: list[JsonObject] = []
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise AuditError(f"invalid-gzip-jsonl-row:{path}:{line_number}")
            rows.append(value)
    return rows


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _integer(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _git_head(root_dir: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root_dir,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _official_url_matches(url: str, file_id: str) -> bool:
    parsed = urlsplit(url)
    parts = [part for part in parsed.path.split("/") if part]
    try:
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname == OFFICIAL_HOST
        and parsed.username is None
        and parsed.password is None
        and port in (None, 443)
        and not parsed.query
        and not parsed.fragment
        and len(parts) >= 2
        and bool(file_id)
        and parts[-2] == file_id
        and parts[-1].isdigit()
    )


def _official_file_id(url: str) -> str:
    parsed = urlsplit(url)
    parts = [part for part in parsed.path.split("/") if part]
    file_id = parts[-2] if len(parts) >= 2 else ""
    if not _official_url_matches(url, file_id):
        raise AuditError(f"official-url-policy-rejected:{url}")
    return file_id


class _OfficialPdfRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, file_id: str) -> None:
        super().__init__()
        self.file_id = file_id

    def redirect_request(
        self,
        request: urllib.request.Request,
        file_pointer: object,
        code: int,
        message: str,
        headers: object,
        new_url: str,
    ) -> urllib.request.Request | None:
        resolved_url = urljoin(request.full_url, new_url)
        if not _official_url_matches(resolved_url, self.file_id):
            raise AuditError(f"official-redirect-policy-rejected:{resolved_url}")
        return super().redirect_request(request, file_pointer, code, message, headers, resolved_url)


def _candidate_pdf_path(temp_root: Path, stable_key: str) -> Path:
    if STABLE_KEY_PATTERN.fullmatch(stable_key) is None:
        raise AuditError(f"candidate-stable-key-invalid:{stable_key}")
    resolved_root = temp_root.resolve()
    destination = (resolved_root / f"{stable_key}.pdf").resolve()
    if destination.parent != resolved_root:
        raise AuditError(f"candidate-temp-path-escaped:{stable_key}")
    return destination


def _download_pdf(url: str, destination: Path, timeout_seconds: float, retries: int) -> tuple[int, str, str, int]:
    official_file_id = _official_file_id(url)
    opener = urllib.request.build_opener(_OfficialPdfRedirectHandler(official_file_id))
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/pdf",
                "User-Agent": "SafeClaw-KOSHA-Official-PDF-Audit/1.0",
            },
        )
        try:
            with opener.open(request, timeout=timeout_seconds) as response:
                status = int(response.status)
                content_type = response.headers.get("Content-Type", "")
                content_length_header = response.headers.get("Content-Length", "")
                content_length = int(content_length_header) if content_length_header.isdigit() else 0
                final_url = response.geturl()
                if not _official_url_matches(final_url, official_file_id):
                    raise AuditError(f"official-final-url-policy-rejected:{final_url}")
                with destination.open("wb") as output:
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                return status, content_type, final_url, content_length
        except (TimeoutError, urllib.error.URLError, OSError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(0.5)
    raise AuditError(f"official-download-failed:{url}:{last_error}") from last_error


def _load_body_items(root_dir: Path, current_path: Path, body_root: Path) -> dict[str, JsonObject]:
    current = _read_json(root_dir / current_path)
    snapshot_path = _text(current.get("snapshot_path"))
    if not snapshot_path:
        raise AuditError("body-current-snapshot-path-missing")
    items_path = root_dir / body_root / snapshot_path / "items.jsonl.gz"
    rows = _read_gzip_jsonl(items_path)
    result: dict[str, JsonObject] = {}
    for row in rows:
        stable_key = _text(row.get("stable_key"))
        if stable_key:
            result[stable_key] = row
    return result


def _extract_downloaded_pdf(candidate: JsonObject, pdf_path: Path) -> JsonObject:
    title = _text(candidate.get("sourceTitle")) or _text(candidate.get("title"))
    entry = snapshot_kosha_guide_corpus.LocalPdfEntry(
        archive_path=None,
        archive_name="official-live-download",
        member_name=f"{title}.pdf",
        category=_text(candidate.get("category")),
        file_size=pdf_path.stat().st_size,
        compressed_size=pdf_path.stat().st_size,
        crc32=None,
    )
    item, failure = snapshot_kosha_guide_corpus._build_item(
        entry,
        pdf_path.read_bytes(),
        {
            "official_list_url": snapshot_kosha_guide_corpus.OFFICIAL_LIST_URL,
            "official_api_url": snapshot_kosha_guide_corpus.OFFICIAL_API_URL,
        },
        snapshot_kosha_guide_corpus.ResourceLimits(),
    )
    if failure is not None or item.get("extraction_status") != "success":
        error_code = failure.get("error_code") if isinstance(failure, dict) else "unknown"
        raise AuditError(f"pdf-extraction-failed:{_text(candidate.get('stableKey'))}:{error_code}")
    body = item.get("body")
    if not isinstance(body, str):
        raise AuditError(f"pdf-body-missing:{_text(candidate.get('stableKey'))}")
    normalized_body = snapshot_kosha_guide_corpus._normalized_for_hash(body)
    return {
        "stableKey": _text(item.get("stable_key")),
        "version": _text(item.get("version_key")),
        "title": _text(item.get("title")),
        "pageCount": _integer(item.get("page_count")),
        "normalizedCharCount": len(normalized_body),
        "bodySha256": hashlib.sha256(normalized_body.encode("utf-8")).hexdigest(),
        "internalVersionTokenMatched": re.sub(r"[^A-Z0-9]", "", _text(candidate.get("version")).upper())
        in re.sub(r"[^A-Z0-9]", "", normalized_body.upper()),
    }


def evaluate_candidate(
    candidate: JsonObject,
    metadata: JsonObject,
    body_item: JsonObject,
    download: DownloadObservation,
    extracted: JsonObject,
) -> JsonObject:
    stable_key = _text(candidate.get("stableKey"))
    official_file_id = _text(candidate.get("officialFileId"))
    version = _text(candidate.get("version"))
    official_current_title = _text(candidate.get("officialCurrentTitle"))
    source_title = _text(candidate.get("sourceTitle"))
    provenance = body_item.get("official_provenance")
    body_provenance = provenance if isinstance(provenance, dict) else {}
    checks: JsonObject = {
        "officialUrlPolicy": _official_url_matches(_text(candidate.get("officialUrl")), official_file_id),
        "httpStatus200": download.status == 200,
        "contentTypePdf": download.content_type.lower().startswith("application/pdf"),
        "finalUrlOfficial": _official_url_matches(download.final_url, official_file_id),
        "contentLengthMatchesDownloadedBytes": download.content_length in (0, download.downloaded_bytes),
        "nonTrivialPdfSize": download.downloaded_bytes >= 10_000,
        "pdfMagic": download.pdf_magic,
        "pdfSha256MatchesPacket": download.pdf_sha256 == _text(candidate.get("pdfSha256")),
        "metadataStableKeyMatches": _text(metadata.get("stable_key")) == stable_key,
        "metadataVersionMatches": _text(metadata.get("official_version")) == _text(candidate.get("version")),
        "metadataPublicationDateMatches": _text(metadata.get("publication_date"))
        == _text(candidate.get("publishedAt")),
        "metadataOfficialFileIdMatches": _text(metadata.get("official_file_id")) == official_file_id,
        "metadataOfficialUrlMatches": _text(metadata.get("official_url")) == _text(candidate.get("officialUrl")),
        "metadataPdfSha256Matches": _text(metadata.get("pdf_sha256")) == download.pdf_sha256,
        "metadataBodySha256Matches": _text(metadata.get("body_sha256")) == _text(candidate.get("bodySha256")),
        "metadataSnapshotSaysCurrent": _text(metadata.get("official_status")) == "current",
        "packetOfficialCurrentTitlePresent": bool(official_current_title),
        "packetTitleUsesOfficialCurrentTitle": _text(candidate.get("title"))
        == f"{version} {official_current_title}",
        "packetSourceTitlePresent": bool(source_title),
        "bodyCorpusVersionMatches": _text(body_item.get("version_key")) == version,
        "bodyCorpusSourceTitleMatches": _text(body_item.get("title")) == source_title,
        "bodyCorpusBodySha256Matches": _text(body_provenance.get("body_sha256"))
        == _text(candidate.get("bodySha256")),
        "bodyCorpusPdfSha256Matches": _text(body_provenance.get("pdf_sha256"))
        == _text(candidate.get("pdfSha256")),
        "bodyCorpusOfficialFileIdMatches": _text(body_provenance.get("official_file_id"))
        == official_file_id,
        "extractedStableKeyMatches": _text(extracted.get("stableKey")) == stable_key,
        "extractedVersionMatches": _text(extracted.get("version")) == version,
        "extractedSourceTitleMatches": _text(extracted.get("title")) == source_title,
        "extractedPageCountMatches": _integer(extracted.get("pageCount")) == _integer(candidate.get("pageCount")),
        "extractedNormalizedCharCountMatches": _integer(extracted.get("normalizedCharCount"))
        == _integer(candidate.get("normalizedCharCount")),
        "extractedBodySha256Matches": _text(extracted.get("bodySha256"))
        == _text(candidate.get("bodySha256")),
        "pdfInternalVersionTokenMatches": extracted.get("internalVersionTokenMatched") is True,
    }
    failed_checks = [name for name, passed in checks.items() if passed is not True]
    return {
        "stableKey": stable_key,
        "version": _text(candidate.get("version")),
        "title": _text(candidate.get("title")),
        "sourceTitle": source_title,
        "officialCurrentTitle": official_current_title,
        "officialFileId": official_file_id,
        "officialUrl": _text(candidate.get("officialUrl")),
        "httpStatus": download.status,
        "contentType": download.content_type,
        "contentLength": download.content_length,
        "downloadedBytes": download.downloaded_bytes,
        "pdfSha256": download.pdf_sha256,
        "expectedPdfSha256": _text(candidate.get("pdfSha256")),
        "bodySha256": _text(extracted.get("bodySha256")),
        "expectedBodySha256": _text(candidate.get("bodySha256")),
        "pageCount": _integer(extracted.get("pageCount")),
        "normalizedCharCount": _integer(extracted.get("normalizedCharCount")),
        "checks": checks,
        "failedChecks": failed_checks,
        "machineVerificationPassed": len(failed_checks) == 0,
        "humanLifecycleConfirmed": False,
        "humanConfirmed": False,
    }


def build_report(
    root_dir: Path,
    packet_path: Path,
    metadata_path: Path,
    body_current_path: Path,
    body_root: Path,
    timeout_seconds: float,
    retries: int,
    downloader: Downloader = _download_pdf,
) -> JsonObject:
    started = time.perf_counter()
    packet = _read_json(root_dir / packet_path)
    candidates_value = packet.get("candidates")
    if not isinstance(candidates_value, list) or not candidates_value:
        raise AuditError("packet-candidates-missing")
    candidates = [row for row in candidates_value if isinstance(row, dict)]
    if len(candidates) != len(candidates_value):
        raise AuditError("packet-candidate-invalid")
    stable_keys = [_text(row.get("stableKey")) for row in candidates]
    if not all(stable_keys) or len(stable_keys) != len(set(stable_keys)):
        raise AuditError("packet-candidate-set-invalid")

    metadata_rows = _read_jsonl(root_dir / metadata_path)
    metadata_by_key = {_text(row.get("stable_key")): row for row in metadata_rows}
    body_by_key = _load_body_items(root_dir, body_current_path, body_root)

    results: list[JsonObject] = []
    with tempfile.TemporaryDirectory(prefix="safeclaw-kosha-pdf-audit-") as temporary_dir:
        temp_root = Path(temporary_dir)
        for candidate in candidates:
            stable_key = _text(candidate.get("stableKey"))
            official_file_id = _text(candidate.get("officialFileId"))
            official_url = _text(candidate.get("officialUrl"))
            if not _official_url_matches(official_url, official_file_id):
                raise AuditError(f"candidate-official-url-invalid:{stable_key}")
            metadata = metadata_by_key.get(stable_key)
            body_item = body_by_key.get(stable_key)
            if metadata is None:
                raise AuditError(f"metadata-candidate-missing:{stable_key}")
            if body_item is None:
                raise AuditError(f"body-candidate-missing:{stable_key}")
            pdf_path = _candidate_pdf_path(temp_root, stable_key)
            status, content_type, final_url, content_length = downloader(
                official_url,
                pdf_path,
                timeout_seconds,
                retries,
            )
            downloaded_bytes = pdf_path.stat().st_size
            with pdf_path.open("rb") as handle:
                pdf_magic = handle.read(5) == b"%PDF-"
            observation = DownloadObservation(
                status=status,
                content_type=content_type,
                final_url=final_url,
                content_length=content_length,
                downloaded_bytes=downloaded_bytes,
                pdf_sha256=_sha256_file(pdf_path),
                pdf_magic=pdf_magic,
            )
            extracted = _extract_downloaded_pdf(candidate, pdf_path)
            results.append(evaluate_candidate(candidate, metadata, body_item, observation, extracted))
            pdf_path.unlink()

    passed_count = sum(1 for row in results if row.get("machineVerificationPassed") is True)
    total_count = len(results)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceHead": _git_head(root_dir),
        "verdict": (
            "PASS_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_REVIEW_STILL_REQUIRED"
            if passed_count == total_count
            else "RED_OFFICIAL_PDF_AUTHENTICITY_BODY_PAIR_MISMATCH"
        ),
        "scope": "read-only official KOSHA PDF and immutable body-pair verification for the bounded promotion packet",
        "packetPath": packet_path.as_posix(),
        "candidateCount": total_count,
        "machineVerifiedCount": passed_count,
        "failedCount": total_count - passed_count,
        "elapsedMs": round((time.perf_counter() - started) * 1000),
        "temporaryPdfFilesRetained": 0,
        "results": results,
        "reviewChecklistImpact": {
            "officialUrlExpectedFileMachineSupported": passed_count == total_count,
            "officialMetadataAndBodyProvenanceMachineSupported": passed_count == total_count,
            "bodyAndPdfHashMachineRechecked": passed_count == total_count,
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
            "All passing rows re-downloaded the official PDF and matched the packet PDF SHA-256.",
            "All passing rows reproduced the packet normalized body SHA-256 with the pinned native PDF extractor.",
            "The official metadata snapshot and body-corpus provenance match the bounded packet.",
        ],
        "forbiddenClaims": [
            "The operator lifecycle/current-status review is complete.",
            "Human review is complete.",
            "The exact-kosha registry was mutated or promoted.",
            "Machine verification replaces separate exact-trust promotion approval.",
        ],
    }


def render_markdown(report: JsonObject) -> str:
    rows_value = report.get("results")
    rows = rows_value if isinstance(rows_value, list) else []
    table_rows = []
    for value in rows:
        if not isinstance(value, dict):
            continue
        table_rows.append(
            "| {stable} | {status} | {bytes_count} | {pdf} | {body} | {machine} |".format(
                stable=_text(value.get("stableKey")),
                status=_integer(value.get("httpStatus")),
                bytes_count=_integer(value.get("downloadedBytes")),
                pdf="MATCH" if _text(value.get("pdfSha256")) == _text(value.get("expectedPdfSha256")) else "MISMATCH",
                body="MATCH" if _text(value.get("bodySha256")) == _text(value.get("expectedBodySha256")) else "MISMATCH",
                machine="PASS" if value.get("machineVerificationPassed") is True else "RED",
            )
        )
    return f"""# KOSHA Exact Official PDF Audit

- Verdict: `{_text(report.get("verdict"))}`
- Source HEAD: `{_text(report.get("sourceHead"))}`
- Candidates: `{_integer(report.get("candidateCount"))}`
- Machine verified: `{_integer(report.get("machineVerifiedCount"))}`
- Failed: `{_integer(report.get("failedCount"))}`
- Temporary PDFs retained: `{_integer(report.get("temporaryPdfFilesRetained"))}`
- Exact promotion performed: `{str(report.get("exactPromotionPerformed")).lower()}`

| Stable key | HTTP | Bytes | PDF SHA-256 | Body SHA-256 | Machine audit |
| --- | ---: | ---: | --- | --- | --- |
{chr(10).join(table_rows)}

## Review Boundary

This audit re-downloads each official KOSHA PDF, checks the official URL and response,
matches the packet PDF SHA-256, re-extracts the native body, and matches the packet body
SHA-256 plus the immutable metadata/body-corpus provenance.

It does **not** complete the operator lifecycle/current-status judgment, reviewer identity,
reviewedAt, humanConfirmed, or the separate exact-trust promotion approval. No DB, Share,
provider, embedding, vector, or exact-trust registry mutation is performed.
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit official PDFs for the bounded KOSHA exact-promotion packet")
    parser.add_argument("--root-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--packet", type=Path, default=DEFAULT_PACKET_PATH)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA_PATH)
    parser.add_argument("--body-current", type=Path, default=DEFAULT_BODY_CURRENT_PATH)
    parser.add_argument("--body-root", type=Path, default=DEFAULT_BODY_ROOT)
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
        metadata_path=args.metadata,
        body_current_path=args.body_current,
        body_root=args.body_root,
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
                "machineVerifiedCount": report["machineVerifiedCount"],
                "outputDir": args.output_dir.as_posix(),
            },
            ensure_ascii=False,
        )
    )
    return 0 if report["failedCount"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
