from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
from importlib.metadata import version as package_version
import json
import os
import re
import shutil
import sys
import tempfile
import time
import unicodedata
import uuid
import zipfile
from dataclasses import asdict, dataclass
from itertools import islice
from pathlib import Path
from typing import Callable, Iterable, Iterator, Protocol, Sequence

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import recover_kosha_ocr_boundary
from scripts.archive_safety import ArchiveLimits, open_preflighted_zip
from scripts.pdf_parser_worker import (
    PdfWorkerLimitError,
    hash_pdf_bytes_bounded,
    hash_pdf_file_bounded,
    parse_pdf_bytes_bounded,
)
from scripts.ingest_safety_reference_catalog import (
    ReferenceItem,
    ReferenceSource,
    decode_zip_name,
    parse_technical_support_zips,
)

PYPDF_VERSION = package_version("pypdf")


TechnicalParser = Callable[[Path, int, bool], tuple[ReferenceSource, list[ReferenceItem]]]

CORPUS_SCHEMA_VERSION = "safeclaw-kosha-body-corpus/v2"
EXTRACTOR_VERSION = "safeclaw-kosha-native-pdf/v2"
CURRENT_SCHEMA_VERSION = "safeclaw-kosha-body-current/v1"
CHECKPOINT_SCHEMA_VERSION = "safeclaw-kosha-body-checkpoint/v2"
PAGE_OCR_CHAR_THRESHOLD = 80
DOCUMENT_OCR_CHAR_THRESHOLD = 500
OFFICIAL_LIST_URL = "https://portal.kosha.or.kr/archive/resources/tech-support/search/all?page=1&rowsPerPage=10"
OFFICIAL_API_URL = "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList"
DATA_FILES = ("items.jsonl", "chunks.jsonl", "failures.jsonl")
OUTPUT_FILES = (*DATA_FILES, "checkpoint.json")
OCR_REVIEW_HMAC_KEY_ENV = "KOSHA_OCR_REVIEW_HMAC_KEY"
MAX_KOSHA_CENTRAL_DIRECTORY_BYTES = 64 * 1024 * 1024


class HashDigest(Protocol):
    def update(self, value: bytes) -> None: ...

    def hexdigest(self) -> str: ...


class ResourceLimitError(ValueError):
    pass


@dataclass(frozen=True)
class ResourceLimits:
    max_member_count: int = 10_000
    max_member_bytes: int = 64 * 1024 * 1024
    max_compression_ratio: float = 100.0
    max_total_uncompressed_bytes: int = 1024 * 1024 * 1024
    max_pages_per_pdf: int = 2000
    max_normalized_chars_per_pdf: int = 2_000_000

    def as_policy(self) -> dict[str, object]:
        return {
            "max_member_count": self.max_member_count,
            "max_member_bytes": self.max_member_bytes,
            "max_compression_ratio": self.max_compression_ratio,
            "max_total_uncompressed_bytes": self.max_total_uncompressed_bytes,
            "max_pages_per_pdf": self.max_pages_per_pdf,
            "max_normalized_chars_per_pdf": self.max_normalized_chars_per_pdf,
        }

    def validate(self) -> None:
        if self.max_member_count <= 0:
            raise ValueError("max_member_count must be greater than zero")
        if self.max_member_bytes <= 0:
            raise ValueError("max_member_bytes must be greater than zero")
        if self.max_compression_ratio <= 0:
            raise ValueError("max_compression_ratio must be greater than zero")
        if self.max_total_uncompressed_bytes <= 0:
            raise ValueError("max_total_uncompressed_bytes must be greater than zero")
        if self.max_pages_per_pdf <= 0:
            raise ValueError("max_pages_per_pdf must be greater than zero")
        if self.max_normalized_chars_per_pdf <= 0:
            raise ValueError("max_normalized_chars_per_pdf must be greater than zero")


@dataclass(frozen=True)
class SourceScanStats:
    source_member_count: int
    total_uncompressed_bytes: int
    max_member_bytes: int
    max_compression_ratio: float


@dataclass
class StageFileState:
    path: Path
    digest: HashDigest
    size_bytes: int = 0
    line_count: int = 0

    def descriptor(self) -> dict[str, object]:
        return {
            "size_bytes": self.size_bytes,
            "line_count": self.line_count,
            "sha256": self.digest.hexdigest(),
        }


@dataclass(frozen=True)
class LocalPdfEntry:
    archive_path: Path | None
    archive_name: str | None
    member_name: str
    category: str | None
    file_size: int
    compressed_size: int
    crc32: str | None
    zip_member_name: str | None = None
    direct_path: Path | None = None
    source_file_size: int | None = None
    source_file_sha256: str | None = None

    @property
    def key(self) -> str:
        return f"{self.archive_name or '<direct>'}::{self.member_name}"


@dataclass(frozen=True)
class ReviewedOcrCandidate:
    file_sha256: str
    attestation_sha256: str
    payload: dict[str, object]
    item_id: str


class SourceIdentityError(RuntimeError):
    """Raised when bytes no longer match the captured source identity."""


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _file_descriptor(path: Path) -> dict[str, object]:
    resolved = path.resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"expected output file does not exist: {resolved}")
    return {
        "path": str(resolved),
        "size_bytes": resolved.stat().st_size,
        "sha256": _sha256_file(resolved),
    }


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _normalize_identity_value(value: object) -> object:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [_normalize_identity_value(item) for item in value]
    if isinstance(value, dict):
        normalized: dict[str, object] = {}
        for key, nested in value.items():
            if not isinstance(key, str):
                raise TypeError("identity material keys must be strings")
            normalized[key] = _normalize_identity_value(nested)
        return normalized
    return value


def _identity_sha256(value: object) -> str:
    canonical = _canonical_json(_normalize_identity_value(value))
    return _sha256_bytes(canonical.encode("utf-8"))


def _atomic_write_bytes(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}")
    try:
        with temporary.open("xb") as file:
            file.write(value)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _write_json(path: Path, value: object) -> None:
    _atomic_write_bytes(path, f"{_canonical_json(value)}\n".encode("utf-8"))


def _write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as file:
        for row in rows:
            file.write(f"{_canonical_json(row)}\n".encode("utf-8"))
        file.flush()
        os.fsync(file.fileno())


def _iter_jsonl(path: Path) -> Iterator[dict[str, object]]:
    if not path.exists():
        return
    with path.open("r", encoding="utf-8", newline="\n") as file:
        for line_number, line in enumerate(file, start=1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path.name}:{line_number} must contain a JSON object")
            yield value


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    return list(_iter_jsonl(path))


def _normalize_page_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).replace("\r\n", "\n").replace("\r", "\n")
    lines = [re.sub(r"[\t \u00a0]+", " ", line).strip() for line in normalized.split("\n")]
    compacted: list[str] = []
    for line in lines:
        if line or (compacted and compacted[-1]):
            compacted.append(line)
    return "\n".join(compacted).strip()


def _normalized_for_hash(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def _normalized_char_count(value: str) -> int:
    return len(_normalized_for_hash(value))


def _item_id(entry: LocalPdfEntry) -> str:
    return f"kosha-{_sha256_bytes(entry.key.encode('utf-8'))[:24]}"


def _load_reviewed_ocr_candidates(
    paths: Sequence[Path] | None,
) -> dict[str, ReviewedOcrCandidate]:
    declared_paths = list(paths or ())
    candidates: dict[str, ReviewedOcrCandidate] = {}
    attestation_items: dict[str, str] = {}
    for declared_path in declared_paths:
        path = declared_path.resolve()
        if not path.is_file():
            raise RuntimeError(f"reviewed OCR candidate does not exist: {path}")
        candidate_bytes = path.read_bytes()
        try:
            payload = json.loads(candidate_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"reviewed OCR candidate is not valid UTF-8 JSON: {path}") from exc
        if not isinstance(payload, dict):
            raise RuntimeError(f"reviewed OCR candidate must be a JSON object: {path}")
        source = payload.get("source")
        item_id = source.get("item_id") if isinstance(source, dict) else None
        if not isinstance(item_id, str) or not item_id.strip():
            raise RuntimeError(f"reviewed OCR candidate item_id is missing: {path}")
        if item_id in candidates:
            raise RuntimeError(f"duplicate reviewed OCR candidate for item: {item_id}")
        review = payload.get("review")
        if not isinstance(review, dict):
            raise RuntimeError(f"reviewed OCR candidate review is missing: {item_id}")
        attestation_sha256 = _sha256_bytes(_canonical_json(review).encode("utf-8"))
        duplicate_item_id = attestation_items.get(attestation_sha256)
        if duplicate_item_id is not None:
            raise RuntimeError(
                "duplicate reviewed OCR candidate attestation: "
                f"{duplicate_item_id}/{item_id}"
            )
        candidates[item_id] = ReviewedOcrCandidate(
            file_sha256=_sha256_bytes(candidate_bytes),
            attestation_sha256=attestation_sha256,
            payload=payload,
            item_id=item_id,
        )
        attestation_items[attestation_sha256] = item_id
    return candidates


def _apply_reviewed_ocr_candidate(
    item: dict[str, object],
    pdf_bytes: bytes,
    candidate: ReviewedOcrCandidate,
    *,
    trusted_reviewer_ids: set[str] | None,
    review_hmac_key: bytes | None,
    expected_generator_sha256: str | None,
) -> dict[str, object]:
    reasons = item.get("ocr_candidate_reasons")
    if (
        item.get("extraction_status") != "boundary"
        or not isinstance(reasons, list)
        or "empty-native-text" not in reasons
        or item.get("normalized_char_count") != 0
        or item.get("normalized_text_sha256") != _sha256_bytes(b"")
        or "body" in item
    ):
        raise RuntimeError(
            f"reviewed OCR candidate cannot overwrite native extraction: {candidate.item_id}"
        )
    raw_sha256 = item.get("raw_sha256")
    if not isinstance(raw_sha256, str):
        raise RuntimeError(f"reviewed OCR target raw hash is missing: {candidate.item_id}")
    with tempfile.TemporaryDirectory(prefix="safeclaw-kosha-reviewed-ocr-") as temp_dir:
        source_pdf = Path(temp_dir) / "source.pdf"
        _atomic_write_bytes(source_pdf, pdf_bytes)
        reviewed = recover_kosha_ocr_boundary.validate_reviewed_candidate(
            candidate.payload,
            expected_item_id=candidate.item_id,
            expected_raw_sha256=raw_sha256,
            source_pdf=source_pdf,
            trusted_reviewer_ids=trusted_reviewer_ids,
            review_hmac_key=review_hmac_key,
            expected_generator_sha256=expected_generator_sha256,
        )

    body = reviewed.get("body")
    candidate_pages = reviewed.get("pages")
    native_pages = item.get("pages")
    review = reviewed.get("review")
    generator = reviewed.get("generator")
    if (
        not isinstance(body, str)
        or not isinstance(candidate_pages, list)
        or not isinstance(native_pages, list)
        or not isinstance(review, dict)
        or not isinstance(generator, dict)
    ):
        raise RuntimeError(
            f"validated reviewed OCR candidate has invalid shape: {candidate.item_id}"
        )

    page_rows: list[dict[str, object]] = []
    page_provenance: list[dict[str, object]] = []
    canonical_page_texts: list[str] = []
    body_offset = 0
    for page_index, (candidate_page, native_page) in enumerate(
        zip(candidate_pages, native_pages, strict=True),
        start=1,
    ):
        if not isinstance(candidate_page, dict) or not isinstance(native_page, dict):
            raise RuntimeError(
                f"validated reviewed OCR page has invalid shape: "
                f"{candidate.item_id}:{page_index}"
            )
        candidate_text = candidate_page.get("text")
        if not isinstance(candidate_text, str):
            raise RuntimeError(
                f"validated reviewed OCR page text is missing: "
                f"{candidate.item_id}:{page_index}"
            )
        text = recover_kosha_ocr_boundary._normalize_text(candidate_text)
        canonical_page_texts.append(text)
        text_sha256 = _sha256_bytes(text.encode("utf-8"))
        page_start = body_offset
        page_end = page_start + len(text)
        page_rows.append(
            {
                "page_number": page_index,
                "char_count": len(text),
                "normalized_char_count": _normalized_char_count(text),
                "normalized_text_sha256": _sha256_bytes(
                    _normalized_for_hash(text).encode("utf-8")
                ),
                "has_image": native_page.get("has_image") is True,
                "ocr_candidate": False,
                "body_char_start": page_start,
                "body_char_end": page_end,
                "extraction_status": "success",
            }
        )
        page_provenance.append(
            {
                "page_number": page_index,
                "image_sha256": candidate_page.get("image_sha256"),
                "text_sha256": text_sha256,
                "response_id": candidate_page.get("response_id"),
                "model": candidate_page.get("model"),
            }
        )
        body_offset = page_end + (1 if page_index < len(candidate_pages) else 0)

    if "\n".join(canonical_page_texts) != body:
        raise RuntimeError(
            f"validated reviewed OCR pages do not rejoin body: {candidate.item_id}"
        )
    normalized_body = _normalized_for_hash(body)
    return {
        **item,
        "extraction_status": "success",
        "pages": page_rows,
        "body": body,
        "body_origin": "human-reviewed-ocr",
        "normalized_char_count": len(normalized_body),
        "normalized_text_sha256": _sha256_bytes(normalized_body.encode("utf-8")),
        "ocr_candidate": False,
        "ocr_candidate_reasons": [],
        "reviewed_ocr_provenance": {
            "candidate_sha256": candidate.file_sha256,
            "content_sha256": review.get("content_sha256"),
            "attestation_sha256": _sha256_bytes(
                _canonical_json(review).encode("utf-8")
            ),
            "attestation_schema": review.get("attestation_schema"),
            "reviewed_by": review.get("reviewed_by"),
            "reviewed_at": review.get("reviewed_at"),
            "generator_script_sha256": generator.get("script_sha256"),
            "pages": page_provenance,
        },
    }


def _normalize_version_code(value: str) -> str | None:
    normalized = re.sub(r"[-\u2013\u2014\u2212]\s+", "-", value.strip().replace("–", "-").replace("—", "-").replace("−", "-"))
    match = re.match(r"^([A-Z](?:-[A-Z])?-\d+(?:-\d{4})?)(?=\b|[_\s.])", normalized, flags=re.IGNORECASE)
    if not match:
        return None
    parts = [str(int(part)) if part.isdigit() else part.upper() for part in match.group(1).split("-")]
    return "-".join(parts)


def _stable_key(version_key: str | None) -> str | None:
    if not version_key:
        return None
    parts = version_key.split("-")
    if len(parts[-1]) == 4 and parts[-1].isdigit():
        parts.pop()
    return "-".join(parts)


def _category_from_archive(path: Path) -> str:
    name = path.stem
    match = re.search(r"\(([^)]+)\)$", name)
    return match.group(1) if match else name


def _validate_archive_entry_bounds(
    archive_name: str,
    member_name: str,
    file_size: int,
    compressed_size: int,
    limits: ResourceLimits,
) -> None:
    if file_size > limits.max_member_bytes:
        raise ResourceLimitError(
            f"ZIP member exceeds max member bytes: {archive_name}::{member_name} "
            f"({file_size}/{limits.max_member_bytes})"
        )
    ratio = file_size / max(compressed_size, 1)
    if ratio > limits.max_compression_ratio:
        raise ResourceLimitError(
            f"ZIP member compression ratio exceeds limit: {archive_name}::{member_name} "
            f"({ratio:.3f}/{limits.max_compression_ratio:.3f})"
        )


def _discover_entries(
    source: Path,
    limits: ResourceLimits | None = None,
    *,
    include_direct_pdfs: bool = True,
) -> tuple[list[LocalPdfEntry], list[Path], SourceScanStats]:
    effective_limits = limits or ResourceLimits()
    effective_limits.validate()
    if not source.exists():
        raise FileNotFoundError(f"local source does not exist: {source}")
    if source.is_dir():
        archives = sorted(
            islice(source.glob("*.zip"), effective_limits.max_member_count + 1),
            key=lambda path: path.name,
        )
        direct_pdfs = (
            sorted(
                islice(source.glob("*.pdf"), effective_limits.max_member_count + 1),
                key=lambda path: path.name,
            )
            if include_direct_pdfs
            else []
        )
        if not archives and not direct_pdfs:
            raise ValueError(f"local source contains no ZIP or PDF files: {source}")
    elif source.suffix.lower() == ".zip":
        archives = [source]
        direct_pdfs = []
    elif source.suffix.lower() == ".pdf":
        archives = []
        direct_pdfs = [source]
    else:
        raise ValueError(f"local source must be a directory, ZIP, or PDF: {source}")
    source_file_count = len(archives) + len(direct_pdfs)
    if source_file_count > effective_limits.max_member_count:
        raise ResourceLimitError(
            f"source file count exceeds limit: "
            f"{source_file_count}/{effective_limits.max_member_count}"
        )

    entries: list[LocalPdfEntry] = []
    total_member_count = 0
    total_uncompressed = 0
    max_member_bytes = 0
    max_compression_ratio = 0.0
    for archive_path in archives:
        try:
            archive_limits = ArchiveLimits(
                max_member_count=effective_limits.max_member_count - total_member_count,
                max_member_bytes=effective_limits.max_member_bytes,
                max_total_uncompressed_bytes=effective_limits.max_total_uncompressed_bytes - total_uncompressed,
                max_compression_ratio=effective_limits.max_compression_ratio,
                max_central_directory_bytes=MAX_KOSHA_CENTRAL_DIRECTORY_BYTES,
            )
            with open_preflighted_zip(archive_path, archive_limits) as (
                archive,
                declared_member_count,
            ):
                archive_infos = archive.infolist()
                if len(archive_infos) != declared_member_count:
                    raise ResourceLimitError(
                        f"ZIP member count changed after preflight: "
                        f"{len(archive_infos)}/{declared_member_count}"
                    )
                normalized_member_paths: set[str] = set()
                for info in archive_infos:
                    total_member_count += 1
                    if total_member_count > effective_limits.max_member_count:
                        raise ResourceLimitError(
                            f"ZIP member count exceeds limit: "
                            f"{total_member_count}/{effective_limits.max_member_count}"
                        )
                    member_name = decode_zip_name(info.filename).replace("\\", "/")
                    if member_name in normalized_member_paths:
                        raise ResourceLimitError(
                            f"duplicate normalized ZIP member path: "
                            f"{archive_path.name}::{member_name}"
                        )
                    normalized_member_paths.add(member_name)
                    _validate_archive_entry_bounds(
                        archive_path.name,
                        member_name,
                        info.file_size,
                        info.compress_size,
                        effective_limits,
                    )
                    total_uncompressed += info.file_size
                    max_member_bytes = max(max_member_bytes, info.file_size)
                    max_compression_ratio = max(
                        max_compression_ratio,
                        info.file_size / max(info.compress_size, 1),
                    )
                    if total_uncompressed > effective_limits.max_total_uncompressed_bytes:
                        raise ResourceLimitError(
                            f"total uncompressed ZIP member bytes exceed limit: "
                            f"{total_uncompressed}/{effective_limits.max_total_uncompressed_bytes}"
                        )
                    if info.is_dir():
                        continue
                    if not member_name.lower().endswith(".pdf"):
                        continue
                    entries.append(
                        LocalPdfEntry(
                            archive_path=archive_path,
                            archive_name=archive_path.name,
                            member_name=member_name,
                            category=_category_from_archive(archive_path),
                            file_size=info.file_size,
                            compressed_size=info.compress_size,
                            crc32=f"{info.CRC:08x}",
                            zip_member_name=info.filename,
                        )
                    )
        except zipfile.BadZipFile as exc:
            raise ValueError(f"bad ZIP source: {archive_path.name}: {exc}") from exc
    for pdf_path in direct_pdfs:
        direct_size = pdf_path.stat().st_size
        total_member_count += 1
        if total_member_count > effective_limits.max_member_count:
            raise ResourceLimitError(
                f"source member count exceeds limit: "
                f"{total_member_count}/{effective_limits.max_member_count}"
            )
        _validate_archive_entry_bounds(
            "<direct>",
            pdf_path.name,
            direct_size,
            direct_size,
            effective_limits,
        )
        total_uncompressed += direct_size
        max_member_bytes = max(max_member_bytes, direct_size)
        max_compression_ratio = max(max_compression_ratio, 1.0)
        if total_uncompressed > effective_limits.max_total_uncompressed_bytes:
            raise ResourceLimitError(
                f"total uncompressed source bytes exceed limit: "
                f"{total_uncompressed}/{effective_limits.max_total_uncompressed_bytes}"
            )
        entries.append(
            LocalPdfEntry(
                archive_path=None,
                archive_name=None,
                member_name=pdf_path.name,
                category=None,
                file_size=direct_size,
                compressed_size=direct_size,
                crc32=None,
                direct_path=pdf_path,
            )
        )
    entries.sort(key=lambda entry: (entry.archive_name or "", entry.member_name))
    return (
        entries,
        archives + direct_pdfs,
        SourceScanStats(
            source_member_count=total_member_count,
            total_uncompressed_bytes=total_uncompressed,
            max_member_bytes=max_member_bytes,
            max_compression_ratio=max_compression_ratio,
        ),
    )


def _inventory_payload(
    source: Path,
    entries: Sequence[LocalPdfEntry],
    source_identity: dict[str, object],
    limits: ResourceLimits,
) -> dict[str, object]:
    archive_entries: list[dict[str, object]] = []
    for entry in entries:
        if entry.archive_name is None:
            continue
        archive_entries.append(
            {
                "zipFile": entry.archive_name,
                "internalPath": entry.member_name,
                "crc32": str(int(entry.crc32, 16)) if entry.crc32 is not None else "0",
                "compressedSize": entry.compressed_size,
                "fileSize": entry.file_size,
                "itemType": (
                    "technical-support-regulation"
                    if "기술지원규정" in entry.member_name
                    else "technical-guideline"
                ),
            }
        )
    return {
        "ok": True,
        "source": str(source.resolve()),
        "resourcePolicy": {
            **limits.as_policy(),
            "max_central_directory_bytes": MAX_KOSHA_CENTRAL_DIRECTORY_BYTES,
        },
        "sourceIdentity": source_identity,
        "entries": archive_entries,
    }


def _bind_entries_to_source_identity(
    entries: Sequence[LocalPdfEntry],
    source_identity: dict[str, object],
) -> list[LocalPdfEntry]:
    file_rows = source_identity.get("files")
    if not isinstance(file_rows, list):
        raise SourceIdentityError("source identity files are missing")
    identities: dict[str, tuple[int, str]] = {}
    for row in file_rows:
        if not isinstance(row, dict):
            raise SourceIdentityError("source identity file row is invalid")
        name = row.get("name")
        size = row.get("size")
        digest = row.get("sha256")
        if not isinstance(name, str) or not isinstance(size, int) or not isinstance(digest, str):
            raise SourceIdentityError("source identity file descriptor is invalid")
        identities[name] = (size, digest)

    bound: list[LocalPdfEntry] = []
    for entry in entries:
        source_name = entry.archive_name or (entry.direct_path.name if entry.direct_path else None)
        identity = identities.get(source_name or "")
        if identity is None:
            raise SourceIdentityError(f"source identity is missing for entry: {entry.key}")
        bound.append(
            LocalPdfEntry(
                archive_path=entry.archive_path,
                archive_name=entry.archive_name,
                member_name=entry.member_name,
                category=entry.category,
                file_size=entry.file_size,
                compressed_size=entry.compressed_size,
                crc32=entry.crc32,
                zip_member_name=entry.zip_member_name,
                direct_path=entry.direct_path,
                source_file_size=identity[0],
                source_file_sha256=identity[1],
            )
        )
    return bound


@contextlib.contextmanager
def _open_identity_bound_archive(entry: LocalPdfEntry) -> Iterator[zipfile.ZipFile]:
    if entry.archive_path is None:
        raise SourceIdentityError(f"entry has no archive source: {entry.key}")
    if entry.source_file_size is None or entry.source_file_sha256 is None:
        raise SourceIdentityError(f"entry has no bound source identity: {entry.key}")

    digest = hashlib.sha256()
    copied = 0
    with entry.archive_path.open("rb") as source_file:
        with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b") as snapshot:
            for block in iter(lambda: source_file.read(1024 * 1024), b""):
                copied += len(block)
                if copied > entry.source_file_size:
                    raise SourceIdentityError(f"source archive size changed: {entry.archive_name}")
                digest.update(block)
                snapshot.write(block)
            if copied != entry.source_file_size or digest.hexdigest() != entry.source_file_sha256:
                raise SourceIdentityError(f"source archive identity changed: {entry.archive_name}")
            snapshot.seek(0)
            with zipfile.ZipFile(snapshot) as archive:
                yield archive


def _read_entry_bytes(entry: LocalPdfEntry, archive: zipfile.ZipFile | None = None) -> bytes:
    if entry.direct_path:
        data = entry.direct_path.read_bytes()
        if entry.source_file_size is None or entry.source_file_sha256 is None:
            raise SourceIdentityError(f"entry has no bound source identity: {entry.key}")
        if len(data) != entry.source_file_size or _sha256_bytes(data) != entry.source_file_sha256:
            raise SourceIdentityError(f"source PDF identity changed: {entry.member_name}")
        return data
    if not entry.archive_path:
        raise RuntimeError(f"entry has no readable source: {entry.key}")
    def read_streaming(opened_archive: zipfile.ZipFile) -> bytes:
        if entry.zip_member_name is None:
            raise KeyError(f"ZIP member disappeared after inventory: {entry.key}")
        with opened_archive.open(entry.zip_member_name) as member_file:
            buffer = io.BytesIO()
            while True:
                chunk = member_file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
            return buffer.getvalue()
    if archive is not None and entry.zip_member_name is not None:
        try:
            return archive.read(entry.zip_member_name)
        except MemoryError:
            return read_streaming(archive)
    with zipfile.ZipFile(entry.archive_path) as opened_archive:
        if entry.zip_member_name is not None:
            try:
                return opened_archive.read(entry.zip_member_name)
            except MemoryError:
                return read_streaming(opened_archive)
    raise KeyError(f"ZIP member disappeared after inventory: {entry.key}")


def _load_provenance(path: Path | None) -> dict[str, object]:
    base: dict[str, object] = {
        "official_list_url": OFFICIAL_LIST_URL,
        "official_api_url": OFFICIAL_API_URL,
        "official_snapshot": None,
        "lineage_by_member": {},
    }
    if path is None:
        return {
            **base,
            "identity_sha256": _sha256_bytes(_canonical_json(base).encode("utf-8")),
        }
    if not path.exists():
        raise FileNotFoundError(f"provenance JSON does not exist: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"provenance JSON must be an object: {path}")
    inventory = payload.get("inventory")
    if not isinstance(inventory, dict):
        return {
            **base,
            "provided": payload,
            "identity_sha256": _sha256_file(path),
        }
    official = inventory.get("official")
    comparison = inventory.get("officialComparison")
    lineage_by_member: dict[str, object] = {}
    if isinstance(comparison, dict):
        mismatches = comparison.get("versionMismatches")
        stale_rows = comparison.get("staleLocalRows")
        for row in mismatches if isinstance(mismatches, list) else []:
            if isinstance(row, dict) and isinstance(row.get("internalPath"), str):
                lineage_by_member[str(row["internalPath"])] = {
                    "state": "current-version-mismatch",
                    "official_version_key": row.get("officialCode"),
                    "local_version_key": row.get("localCode"),
                }
        for row in stale_rows if isinstance(stale_rows, list) else []:
            if isinstance(row, dict) and isinstance(row.get("internalPath"), str):
                lineage_by_member[str(row["internalPath"])] = {
                    "state": "retired" if row.get("officialRetired") is True else "unverified-local",
                    "official_version_key": None,
                    "local_version_key": row.get("localCode"),
                }
    list_url = official.get("listUrl") if isinstance(official, dict) else None
    api_url = official.get("apiUrl") if isinstance(official, dict) else None
    return {
        "official_list_url": list_url or OFFICIAL_LIST_URL,
        "official_api_url": api_url or OFFICIAL_API_URL,
        "official_snapshot": official,
        "lineage_by_member": lineage_by_member,
        "identity_sha256": _sha256_file(path),
    }


def _build_generation_policy(
    chunk_chars: int,
    category: str | None,
    state: str | None,
    provenance: dict[str, object],
    resource_limits: ResourceLimits,
    reviewed_ocr_candidates: Sequence[ReviewedOcrCandidate],
) -> tuple[dict[str, object], str]:
    reviewed_candidate_policy: list[dict[str, object]] = []
    for candidate in sorted(
        reviewed_ocr_candidates,
        key=lambda value: (value.item_id, value.file_sha256),
    ):
        review = candidate.payload.get("review")
        if not isinstance(review, dict):
            raise RuntimeError(
                f"validated reviewed OCR candidate review is missing: {candidate.item_id}"
            )
        content_sha256 = review.get("content_sha256")
        if (
            not isinstance(content_sha256, str)
            or not recover_kosha_ocr_boundary.SHA256_PATTERN.fullmatch(content_sha256)
        ):
            raise RuntimeError(
                f"validated reviewed OCR candidate content hash is invalid: "
                f"{candidate.item_id}"
            )
        reviewed_candidate_policy.append(
            {
                "item_id": candidate.item_id,
                "candidate_sha256": candidate.file_sha256,
                "content_sha256": content_sha256,
                "attestation_sha256": candidate.attestation_sha256,
            }
        )
    policy: dict[str, object] = {
        "schema_version": CORPUS_SCHEMA_VERSION,
        "extractor_version": EXTRACTOR_VERSION,
        "pypdf_version": PYPDF_VERSION,
        "chunk_chars": chunk_chars,
        "filters": {"category": category, "state": state},
        "ocr_thresholds": {
            "page_requires_image": True,
            "page_normalized_chars": PAGE_OCR_CHAR_THRESHOLD,
            "document_normalized_chars": DOCUMENT_OCR_CHAR_THRESHOLD,
        },
        "resource_limits": resource_limits.as_policy(),
        **(
            {"reviewed_ocr_candidates": reviewed_candidate_policy}
            if reviewed_candidate_policy
            else {}
        ),
        "provenance_identity_sha256": provenance.get("identity_sha256"),
        "normalization": "NFKC+line-ending+horizontal-whitespace/v1",
        "chunking": "per-page-fixed-character-span/v1",
    }
    return policy, _identity_sha256(policy)


def _staging_key(source_identity_sha256: str, generation_policy_sha256: str) -> str:
    material = f"{source_identity_sha256}\n{generation_policy_sha256}".encode("utf-8")
    return _sha256_bytes(material)


def _chunk_pages(item: dict[str, object], chunk_chars: int) -> list[dict[str, object]]:
    chunks: list[dict[str, object]] = []
    pages = item.get("pages")
    if not isinstance(pages, list):
        return chunks
    item_id = str(item["item_id"])
    body = item.get("body")
    if not isinstance(body, str):
        return chunks
    source_zip = item.get("source_zip")
    source_member = str(item["source_member"])
    for page in pages:
        if not isinstance(page, dict):
            continue
        page_number = page.get("page_number")
        body_start = page.get("body_char_start")
        body_end = page.get("body_char_end")
        if not isinstance(page_number, int) or not isinstance(body_start, int) or not isinstance(body_end, int):
            continue
        text = body[body_start:body_end]
        if not text:
            continue
        for start in range(0, len(text), chunk_chars):
            chunk_text = text[start:start + chunk_chars]
            end = start + len(chunk_text)
            chunk_material = f"{item_id}\n{page_number}\n{start}\n{end}\n{chunk_text}"
            chunks.append(
                {
                    "schema_version": CORPUS_SCHEMA_VERSION,
                    "chunk_id": f"kosha-chunk-{_sha256_bytes(chunk_material.encode('utf-8'))[:24]}",
                    "chunk_sha256": _sha256_bytes(chunk_text.encode("utf-8")),
                    "item_id": item_id,
                    "stable_key": item.get("stable_key"),
                    "version_key": item.get("version_key"),
                    "source_zip": source_zip,
                    "source_member": source_member,
                    "page_start": page_number,
                    "page_end": page_number,
                    "text": chunk_text,
                    "source_spans": [
                        {
                            "page_number": page_number,
                            "char_start": start,
                            "char_end": end,
                        }
                    ],
                }
            )
    return chunks


def _build_item(
    entry: LocalPdfEntry,
    data: bytes,
    provenance: dict[str, object],
    resource_limits: ResourceLimits,
) -> tuple[dict[str, object], dict[str, object] | None]:
    title = Path(entry.member_name).stem
    version_key = _normalize_version_code(title)
    stable_key = _stable_key(version_key)
    raw_sha256 = hash_pdf_bytes_bounded(data)
    item_id = _item_id(entry)
    lineage_map = provenance.get("lineage_by_member")
    lineage = lineage_map.get(entry.member_name) if isinstance(lineage_map, dict) else None
    state = lineage.get("state") if isinstance(lineage, dict) else "current-unverified"
    base: dict[str, object] = {
        "schema_version": CORPUS_SCHEMA_VERSION,
        "item_id": item_id,
        "stable_key": stable_key,
        "version_key": version_key,
        "version_lineage": lineage or {"state": state, "official_version_key": None},
        "title": title,
        "item_type": "technical-support-regulation" if "기술지원규정" in entry.member_name else "technical-guideline",
        "category": entry.category,
        "state": state,
        "source_zip": entry.archive_name,
        "source_member": entry.member_name,
        "source_key": entry.key,
        "source_file_size": entry.file_size,
        "source_compressed_size": entry.compressed_size,
        "source_crc32": entry.crc32,
        "raw_sha256": raw_sha256,
        "provenance": {
            "official_list_url": provenance.get("official_list_url"),
            "official_api_url": provenance.get("official_api_url"),
            "official_download_url": None,
            "official_download_boundary": "item-download-provenance-not-present-in-offline-audit",
        },
    }
    if not data:
        failure = {
            "schema_version": CORPUS_SCHEMA_VERSION,
            "item_id": item_id,
            "source_key": entry.key,
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "raw_sha256": raw_sha256,
            "error_code": "zero-byte-pdf",
            "error_type": "ValueError",
            "message": "PDF member is zero bytes",
        }
        return {**base, "extraction_status": "failure", "page_count": 0, "pages": [], "ocr_candidate": True, "ocr_candidate_reasons": ["zero-byte-pdf"]}, failure
    try:
        parsed = parse_pdf_bytes_bounded(
            data,
            extract_pages=resource_limits.max_pages_per_pdf,
            max_total_pages=resource_limits.max_pages_per_pdf,
            max_text_chars=resource_limits.max_normalized_chars_per_pdf * 8,
            timeout_seconds=30.0,
            include_image_flags=True,
            expected_sha256=raw_sha256,
        )
        page_count = parsed.page_count
        page_rows: list[dict[str, object]] = []
        page_texts: list[str] = []
        body_offset = 0
        extracted_normalized_chars = 0
        for page_number, page in enumerate(parsed.pages, start=1):
            text = _normalize_page_text(page.text)
            normalized_count = _normalized_char_count(text)
            extracted_normalized_chars += normalized_count
            if extracted_normalized_chars > resource_limits.max_normalized_chars_per_pdf:
                failure = {
                    "schema_version": CORPUS_SCHEMA_VERSION,
                    "item_id": item_id,
                    "source_key": entry.key,
                    "source_zip": entry.archive_name,
                    "source_member": entry.member_name,
                    "raw_sha256": raw_sha256,
                    "error_code": "resource-limit-text",
                    "error_type": "ResourceLimitError",
                    "message": (
                        f"PDF normalized character count exceeds limit: "
                        f"{extracted_normalized_chars}/"
                        f"{resource_limits.max_normalized_chars_per_pdf}"
                    ),
                }
                return {
                    **base,
                    "extraction_status": "failure",
                    "page_count": page_count,
                    "pages": [],
                    "ocr_candidate": True,
                    "ocr_candidate_reasons": ["resource-limit-text"],
                }, failure
            has_image = page.has_image
            page_ocr_candidate = has_image and normalized_count < PAGE_OCR_CHAR_THRESHOLD
            page_start = body_offset
            page_end = page_start + len(text)
            page_rows.append(
                {
                    "page_number": page_number,
                    "char_count": len(text),
                    "normalized_char_count": normalized_count,
                    "normalized_text_sha256": _sha256_bytes(_normalized_for_hash(text).encode("utf-8")),
                    "has_image": has_image,
                    "ocr_candidate": page_ocr_candidate,
                    "body_char_start": page_start,
                    "body_char_end": page_end,
                    "extraction_status": "empty" if not text else "success",
                }
            )
            page_texts.append(text)
            body_offset = page_end + (1 if page_number < page_count else 0)
    except PdfWorkerLimitError as exc:
        error_code = (
            "resource-limit-pages"
            if exc.code == "page_count_limit"
            else "resource-limit-text"
            if exc.code in {"text_chars_limit", "output_bytes_limit"}
            else "bad-pdf"
        )
        failure = {
            "schema_version": CORPUS_SCHEMA_VERSION,
            "item_id": item_id,
            "source_key": entry.key,
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "raw_sha256": raw_sha256,
            "error_code": error_code,
            "error_type": type(exc).__name__,
            "message": str(exc),
        }
        return {
            **base,
            "extraction_status": "failure",
            "page_count": exc.page_count or 0,
            "pages": [],
            "ocr_candidate": True,
            "ocr_candidate_reasons": [error_code],
        }, failure
    except Exception as exc:
        failure = {
            "schema_version": CORPUS_SCHEMA_VERSION,
            "item_id": item_id,
            "source_key": entry.key,
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "raw_sha256": raw_sha256,
            "error_code": "bad-pdf",
            "error_type": type(exc).__name__,
            "message": str(exc),
        }
        return {**base, "extraction_status": "failure", "page_count": 0, "pages": [], "ocr_candidate": True, "ocr_candidate_reasons": ["bad-pdf"]}, failure

    body = "\n".join(page_texts)
    normalized_body = _normalized_for_hash(body)
    normalized_count = len(normalized_body)
    reasons: list[str] = []
    if any(page["ocr_candidate"] is True for page in page_rows):
        reasons.append("image-low-text-page")
    if normalized_count < DOCUMENT_OCR_CHAR_THRESHOLD:
        reasons.append("document-below-500-normalized-chars")
    if not normalized_body:
        reasons.append("empty-native-text")
        failure = {
            "schema_version": CORPUS_SCHEMA_VERSION,
            "item_id": item_id,
            "source_key": entry.key,
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "raw_sha256": raw_sha256,
            "error_code": "empty-body",
            "error_type": "EmptyNativeText",
            "message": "all PDF pages produced empty native text",
        }
        return {
            **base,
            "extraction_status": "boundary",
            "page_count": len(page_rows),
            "pages": page_rows,
            "normalized_char_count": 0,
            "normalized_text_sha256": _sha256_bytes(b""),
            "ocr_candidate": True,
            "ocr_candidate_reasons": reasons,
        }, failure
    return {
        **base,
        "extraction_status": "success",
        "page_count": len(page_rows),
        "pages": page_rows,
        "body": body,
        "normalized_char_count": normalized_count,
        "normalized_text_sha256": _sha256_bytes(normalized_body.encode("utf-8")),
        "ocr_candidate": bool(reasons),
        "ocr_candidate_reasons": reasons,
    }, None


def _prepare_reviewed_ocr_items(
    entries: Sequence[LocalPdfEntry],
    candidates: dict[str, ReviewedOcrCandidate],
    provenance: dict[str, object],
    resource_limits: ResourceLimits,
    *,
    trusted_reviewer_ids: set[str] | None,
    review_hmac_key: bytes | None,
    expected_generator_sha256: str | None,
) -> dict[str, dict[str, object]]:
    if not candidates:
        return {}
    entries_by_item_id = {_item_id(entry): entry for entry in entries}
    prepared: dict[str, dict[str, object]] = {}
    open_archives: dict[Path, zipfile.ZipFile] = {}
    with contextlib.ExitStack() as archive_stack:
        for item_id in sorted(candidates):
            candidate = candidates[item_id]
            entry = entries_by_item_id[item_id]
            archive = None
            if entry.archive_path:
                archive = open_archives.get(entry.archive_path)
                if archive is None:
                    archive = archive_stack.enter_context(_open_identity_bound_archive(entry))
                    open_archives[entry.archive_path] = archive
            pdf_bytes = _read_entry_bytes(entry, archive)
            native_item, _native_failure = _build_item(
                entry,
                pdf_bytes,
                provenance,
                resource_limits,
            )
            prepared[entry.key] = _apply_reviewed_ocr_candidate(
                native_item,
                pdf_bytes,
                candidate,
                trusted_reviewer_ids=trusted_reviewer_ids,
                review_hmac_key=review_hmac_key,
                expected_generator_sha256=expected_generator_sha256,
            )
    return prepared


def _source_identity(
    files: Sequence[Path],
    entries: Sequence[LocalPdfEntry],
    scan_stats: SourceScanStats,
) -> dict[str, object]:
    file_rows = []
    for path in sorted(files, key=lambda value: value.name):
        size = path.stat().st_size
        digest = (
            hash_pdf_file_bounded(path, max_input_bytes=size)
            if path.suffix.lower() == ".pdf"
            else _sha256_file(path)
        )
        file_rows.append({"name": path.name, "size": size, "sha256": digest})
    inventory_rows = [
        {
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "file_size": entry.file_size,
            "compressed_size": entry.compressed_size,
            "crc32": entry.crc32,
        }
        for entry in entries
    ]
    source_identity = {
        "files": file_rows,
        "source_member_count": scan_stats.source_member_count,
        "pdf_entry_count": len(entries),
        "total_uncompressed_bytes": scan_stats.total_uncompressed_bytes,
        "max_member_bytes": scan_stats.max_member_bytes,
        "max_compression_ratio": scan_stats.max_compression_ratio,
        "entry_manifest_sha256": _sha256_bytes(_canonical_json(inventory_rows).encode("utf-8")),
    }
    identity_hash = _identity_sha256(source_identity)
    return {
        "identity_sha256": identity_hash,
        **source_identity,
    }


def _hash_file_state(path: Path, byte_limit: int | None = None) -> StageFileState:
    digest = hashlib.sha256()
    size_bytes = 0
    line_count = 0
    remaining = byte_limit
    with path.open("rb") as file:
        while remaining is None or remaining > 0:
            read_size = 1024 * 1024 if remaining is None else min(1024 * 1024, remaining)
            block = file.read(read_size)
            if not block:
                break
            digest.update(block)
            size_bytes += len(block)
            line_count += block.count(b"\n")
            if remaining is not None:
                remaining -= len(block)
    if byte_limit is not None and size_bytes != byte_limit:
        raise RuntimeError(f"staging file is shorter than checkpoint: {path} ({size_bytes}/{byte_limit})")
    return StageFileState(
        path=path,
        digest=digest,
        size_bytes=size_bytes,
        line_count=line_count,
    )


def _append_jsonl_rows(
    state: StageFileState,
    rows: Iterable[dict[str, object]],
) -> int:
    appended = 0
    with state.path.open("ab") as file:
        for row in rows:
            encoded = f"{_canonical_json(row)}\n".encode("utf-8")
            file.write(encoded)
            state.digest.update(encoded)
            state.size_bytes += len(encoded)
            state.line_count += 1
            appended += 1
        file.flush()
        os.fsync(file.fileno())
    return appended


def _initial_counts(inventory: int) -> dict[str, int]:
    return {
        "inventory": inventory,
        "completed": 0,
        "success": 0,
        "boundary": 0,
        "failure": 0,
        "failure_ledger": 0,
        "ocr_candidate_items": 0,
        "ocr_candidate_pages": 0,
        "chunks": 0,
        "raw_duplicate_rows": 0,
        "text_duplicate_rows": 0,
    }


def _derive_counts(
    items_path: Path,
    chunks_path: Path,
    failures_path: Path,
    inventory: int,
) -> dict[str, int]:
    counts = _initial_counts(inventory)
    for item in _iter_jsonl(items_path):
        counts["completed"] += 1
        status = item.get("extraction_status")
        if status in {"success", "boundary", "failure"}:
            counts[str(status)] += 1
        else:
            raise RuntimeError(f"invalid item extraction status in staged corpus: {status}")
        if item.get("ocr_candidate") is True:
            counts["ocr_candidate_items"] += 1
        pages = item.get("pages")
        if not isinstance(pages, list):
            raise RuntimeError(f"item pages must be a list: {item.get('item_id')}")
        counts["ocr_candidate_pages"] += sum(
            isinstance(page, dict) and page.get("ocr_candidate") is True
            for page in pages
        )
        if item.get("raw_duplicate_of") is not None:
            counts["raw_duplicate_rows"] += 1
        if item.get("text_duplicate_of") is not None:
            counts["text_duplicate_rows"] += 1
    counts["chunks"] = sum(1 for _ in _iter_jsonl(chunks_path))
    counts["failure_ledger"] = sum(1 for _ in _iter_jsonl(failures_path))
    return counts


def _checkpoint_payload(
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
    completed_source_keys: Sequence[str],
    counts: dict[str, int],
    file_states: dict[str, StageFileState],
    stage_state: str,
) -> dict[str, object]:
    return {
        "schema_version": CHECKPOINT_SCHEMA_VERSION,
        "stage_state": stage_state,
        "source_identity": source_identity,
        "source_identity_sha256": source_identity["identity_sha256"],
        "generation_policy": generation_policy,
        "generation_policy_sha256": generation_policy_sha256,
        "completed_count": len(completed_source_keys),
        "completed_source_keys": list(completed_source_keys),
        "counts": counts,
        "files": {
            name: file_states[name].descriptor()
            for name in DATA_FILES
        },
    }


def _read_checkpoint(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise RuntimeError(f"staging checkpoint is missing: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"staging checkpoint is unreadable: {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"staging checkpoint must be an object: {path}")
    return value


def _restore_stage_file_states(
    stage_dir: Path,
    checkpoint: dict[str, object],
) -> dict[str, StageFileState]:
    file_descriptors = checkpoint.get("files")
    if not isinstance(file_descriptors, dict):
        raise RuntimeError("staging checkpoint files must be an object")
    states: dict[str, StageFileState] = {}
    for name in DATA_FILES:
        descriptor = file_descriptors.get(name)
        if not isinstance(descriptor, dict):
            raise RuntimeError(f"staging checkpoint file descriptor is missing: {name}")
        expected_size = descriptor.get("size_bytes")
        expected_lines = descriptor.get("line_count")
        expected_hash = descriptor.get("sha256")
        if not isinstance(expected_size, int) or expected_size < 0:
            raise RuntimeError(f"invalid checkpoint size for {name}: {expected_size}")
        if not isinstance(expected_lines, int) or expected_lines < 0:
            raise RuntimeError(f"invalid checkpoint line count for {name}: {expected_lines}")
        if not isinstance(expected_hash, str):
            raise RuntimeError(f"invalid checkpoint hash for {name}: {expected_hash}")
        path = stage_dir / name
        if not path.is_file():
            raise RuntimeError(f"staging file is missing: {path}")
        actual_size = path.stat().st_size
        if actual_size < expected_size:
            raise RuntimeError(
                f"staging file is shorter than checkpoint: {name} ({actual_size}/{expected_size})"
            )
        state = _hash_file_state(path, expected_size)
        if state.line_count != expected_lines or state.digest.hexdigest() != expected_hash:
            raise RuntimeError(f"staging file prefix identity mismatch: {name}")
        if actual_size > expected_size:
            with path.open("r+b") as file:
                file.truncate(expected_size)
                file.flush()
                os.fsync(file.fileno())
        states[name] = state
    return states


def _initialize_stage(
    stage_dir: Path,
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
    inventory: int,
) -> tuple[dict[str, StageFileState], dict[str, int], list[str]]:
    stage_dir.mkdir(parents=True, exist_ok=False)
    file_states: dict[str, StageFileState] = {}
    for name in DATA_FILES:
        path = stage_dir / name
        _write_jsonl(path, ())
        file_states[name] = _hash_file_state(path)
    counts = _initial_counts(inventory)
    completed_source_keys: list[str] = []
    checkpoint = _checkpoint_payload(
        source_identity,
        generation_policy,
        generation_policy_sha256,
        completed_source_keys,
        counts,
        file_states,
        "in-progress",
    )
    _write_json(stage_dir / "checkpoint.json", checkpoint)
    return file_states, counts, completed_source_keys


def _validate_checkpoint_identity(
    checkpoint: dict[str, object],
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
) -> None:
    source_identity_material = {
        key: value
        for key, value in source_identity.items()
        if key != "identity_sha256"
    }
    if source_identity.get("identity_sha256") != _identity_sha256(
        source_identity_material
    ):
        raise RuntimeError("source identity canonical hash mismatch")
    if generation_policy_sha256 != _identity_sha256(generation_policy):
        raise RuntimeError("generation policy canonical hash mismatch")
    if checkpoint.get("source_identity_sha256") != source_identity["identity_sha256"]:
        raise RuntimeError("resume source identity mismatch")
    if checkpoint.get("source_identity") != source_identity:
        raise RuntimeError("resume exact source identity mismatch")
    if checkpoint.get("generation_policy_sha256") != generation_policy_sha256:
        raise RuntimeError("resume generation policy identity mismatch")
    if checkpoint.get("generation_policy") != generation_policy:
        raise RuntimeError("resume exact generation policy mismatch")


def _resume_stage(
    stage_dir: Path,
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
    selected_entries: Sequence[LocalPdfEntry],
) -> tuple[dict[str, StageFileState], dict[str, int], list[str], str]:
    checkpoint = _read_checkpoint(stage_dir / "checkpoint.json")
    _validate_checkpoint_identity(
        checkpoint,
        source_identity,
        generation_policy,
        generation_policy_sha256,
    )
    completed = checkpoint.get("completed_source_keys")
    counts = checkpoint.get("counts")
    stage_state = checkpoint.get("stage_state")
    if not isinstance(completed, list) or not all(isinstance(key, str) for key in completed):
        raise RuntimeError("checkpoint completed_source_keys must be strings")
    if not isinstance(counts, dict) or not all(isinstance(value, int) for value in counts.values()):
        raise RuntimeError("checkpoint counts must be integer values")
    if stage_state not in {"in-progress", "complete"}:
        raise RuntimeError(f"invalid checkpoint stage state: {stage_state}")
    expected_prefix = [entry.key for entry in selected_entries[:len(completed)]]
    if completed != expected_prefix:
        raise RuntimeError("checkpoint completed source keys do not match selected source prefix")
    file_states = _restore_stage_file_states(stage_dir, checkpoint)
    derived = _derive_counts(
        stage_dir / "items.jsonl",
        stage_dir / "chunks.jsonl",
        stage_dir / "failures.jsonl",
        len(selected_entries),
    )
    typed_counts = {str(key): int(value) for key, value in counts.items()}
    if derived != typed_counts:
        raise RuntimeError(f"checkpoint corpus counts mismatch: {typed_counts}/{derived}")
    if typed_counts["completed"] != len(completed):
        raise RuntimeError("checkpoint completed count does not match item ledger")
    return file_states, typed_counts, list(completed), str(stage_state)


def _load_dedupe_maps(items_path: Path) -> tuple[dict[str, str], dict[str, str]]:
    raw_first: dict[str, str] = {}
    text_first: dict[str, str] = {}
    for item in _iter_jsonl(items_path):
        item_id = str(item.get("item_id"))
        raw_hash = item.get("raw_sha256")
        text_hash = item.get("normalized_text_sha256")
        if raw_hash and str(raw_hash) not in raw_first:
            raw_first[str(raw_hash)] = item_id
        if text_hash and item.get("extraction_status") == "success" and str(text_hash) not in text_first:
            text_first[str(text_hash)] = item_id
    return raw_first, text_first


def _apply_item_dedupe(
    item: dict[str, object],
    raw_first: dict[str, str],
    text_first: dict[str, str],
) -> None:
    item_id = str(item["item_id"])
    raw_hash = item.get("raw_sha256")
    text_hash = item.get("normalized_text_sha256")
    item["raw_duplicate_of"] = raw_first.get(str(raw_hash)) if raw_hash else None
    if raw_hash and str(raw_hash) not in raw_first:
        raw_first[str(raw_hash)] = item_id
    item["text_duplicate_of"] = (
        text_first.get(str(text_hash))
        if text_hash and item.get("extraction_status") == "success"
        else None
    )
    if text_hash and item.get("extraction_status") == "success" and str(text_hash) not in text_first:
        text_first[str(text_hash)] = item_id


def _update_counts_for_item(
    counts: dict[str, int],
    item: dict[str, object],
    chunk_count: int,
    has_failure: bool,
) -> None:
    counts["completed"] += 1
    status = str(item["extraction_status"])
    counts[status] += 1
    counts["chunks"] += chunk_count
    if has_failure:
        counts["failure_ledger"] += 1
    if item.get("ocr_candidate") is True:
        counts["ocr_candidate_items"] += 1
    pages = item.get("pages")
    if isinstance(pages, list):
        counts["ocr_candidate_pages"] += sum(
            isinstance(page, dict) and page.get("ocr_candidate") is True
            for page in pages
        )
    if item.get("raw_duplicate_of") is not None:
        counts["raw_duplicate_rows"] += 1
    if item.get("text_duplicate_of") is not None:
        counts["text_duplicate_rows"] += 1


def _reproducibility_hash(
    source_identity_sha256: str,
    generation_policy_sha256: str,
    output_hashes: dict[str, str],
) -> str:
    return _sha256_bytes(
        _canonical_json(
            {
                "schema_version": CORPUS_SCHEMA_VERSION,
                "source_identity_sha256": source_identity_sha256,
                "generation_policy_sha256": generation_policy_sha256,
                "output_hashes": output_hashes,
            }
        ).encode("utf-8")
    )


def _copy_file_streaming(source: Path, target: Path) -> None:
    with source.open("rb") as source_file, target.open("xb") as target_file:
        shutil.copyfileobj(source_file, target_file, length=1024 * 1024)
        target_file.flush()
        os.fsync(target_file.fileno())


def _safe_relative_path(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    resolved_root = root.resolve()
    if not candidate.is_relative_to(resolved_root):
        raise RuntimeError(f"published path escapes output directory: {relative}")
    return candidate


def _remove_tree_within(root: Path, target: Path) -> None:
    resolved_root = root.resolve()
    resolved_target = target.resolve()
    if resolved_target == resolved_root or not resolved_target.is_relative_to(resolved_root):
        raise RuntimeError(f"refusing to remove directory outside bounded root: {resolved_target}")
    shutil.rmtree(resolved_target)


def _validate_snapshot_directory(
    snapshot_dir: Path,
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
) -> dict[str, object]:
    manifest_path = snapshot_dir / "manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"snapshot manifest is missing: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise RuntimeError("snapshot manifest must be an object")
    manifest_source_identity = manifest.get("source_identity")
    if not isinstance(manifest_source_identity, dict):
        raise RuntimeError("snapshot source identity must be an object")
    manifest_source_material = {
        key: value
        for key, value in manifest_source_identity.items()
        if key != "identity_sha256"
    }
    if manifest_source_identity.get("identity_sha256") != _identity_sha256(
        manifest_source_material
    ):
        raise RuntimeError("snapshot source identity canonical hash mismatch")
    manifest_generation_policy = manifest.get("generation_policy")
    if not isinstance(manifest_generation_policy, dict):
        raise RuntimeError("snapshot generation policy must be an object")
    if manifest.get("generation_policy_sha256") != _identity_sha256(
        manifest_generation_policy
    ):
        raise RuntimeError("snapshot generation policy canonical hash mismatch")
    if manifest.get("source_identity") != source_identity:
        raise RuntimeError("snapshot exact source identity mismatch")
    if manifest.get("generation_policy") != generation_policy:
        raise RuntimeError("snapshot exact generation policy mismatch")
    if manifest.get("generation_policy_sha256") != generation_policy_sha256:
        raise RuntimeError("snapshot generation policy identity mismatch")
    output_hashes = manifest.get("output_hashes")
    if not isinstance(output_hashes, dict):
        raise RuntimeError("snapshot output_hashes must be an object")
    actual_hashes: dict[str, str] = {}
    for name in OUTPUT_FILES:
        path = snapshot_dir / name
        if not path.is_file():
            raise RuntimeError(f"snapshot output is missing: {path}")
        actual_hashes[name] = _sha256_file(path)
    if output_hashes != actual_hashes:
        raise RuntimeError(f"snapshot output hash mismatch: {output_hashes}/{actual_hashes}")
    checkpoint = _read_checkpoint(snapshot_dir / "checkpoint.json")
    _validate_checkpoint_identity(
        checkpoint,
        source_identity,
        generation_policy,
        generation_policy_sha256,
    )
    if checkpoint.get("stage_state") != "complete":
        raise RuntimeError("published checkpoint must be complete")
    counts = manifest.get("counts")
    if not isinstance(counts, dict) or not all(isinstance(value, int) for value in counts.values()):
        raise RuntimeError("snapshot manifest counts must be integers")
    derived = _derive_counts(
        snapshot_dir / "items.jsonl",
        snapshot_dir / "chunks.jsonl",
        snapshot_dir / "failures.jsonl",
        int(counts["inventory"]),
    )
    if counts != derived or checkpoint.get("counts") != derived:
        raise RuntimeError(f"snapshot count mismatch: {counts}/{checkpoint.get('counts')}/{derived}")
    reproducibility_hash = _reproducibility_hash(
        str(source_identity["identity_sha256"]),
        generation_policy_sha256,
        actual_hashes,
    )
    if manifest.get("reproducibility_hash") != reproducibility_hash:
        raise RuntimeError("snapshot reproducibility hash mismatch")
    if snapshot_dir.name != reproducibility_hash and not snapshot_dir.name.startswith(".tmp-"):
        raise RuntimeError("immutable snapshot directory name does not match reproducibility hash")
    return manifest


def _validate_current_snapshot(
    output_dir: Path,
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
) -> dict[str, object]:
    current_path = output_dir / "current.json"
    try:
        current = json.loads(current_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"current snapshot pointer is unreadable: {exc}") from exc
    if not isinstance(current, dict):
        raise RuntimeError("current snapshot pointer must be an object")
    if current.get("source_identity_sha256") != source_identity["identity_sha256"]:
        raise RuntimeError("current snapshot source identity mismatch")
    if current.get("generation_policy_sha256") != generation_policy_sha256:
        raise RuntimeError("current snapshot generation policy identity mismatch")
    snapshot_relative = current.get("snapshot_path")
    if not isinstance(snapshot_relative, str):
        raise RuntimeError("current snapshot path is missing")
    snapshot_dir = _safe_relative_path(output_dir, snapshot_relative)
    manifest = _validate_snapshot_directory(
        snapshot_dir,
        source_identity,
        generation_policy,
        generation_policy_sha256,
    )
    manifest_descriptor = current.get("manifest")
    if not isinstance(manifest_descriptor, dict):
        raise RuntimeError("current manifest descriptor is missing")
    manifest_relative = manifest_descriptor.get("path")
    if not isinstance(manifest_relative, str):
        raise RuntimeError("current manifest descriptor path is missing")
    pointed_manifest = _safe_relative_path(output_dir, manifest_relative)
    if pointed_manifest != (snapshot_dir / "manifest.json").resolve():
        raise RuntimeError("current manifest path does not match snapshot path")
    actual_manifest = _file_descriptor(snapshot_dir / "manifest.json")
    expected_manifest = {
        "path": str((snapshot_dir / "manifest.json").resolve()),
        "size_bytes": manifest_descriptor.get("size_bytes"),
        "sha256": manifest_descriptor.get("sha256"),
    }
    if actual_manifest != expected_manifest:
        raise RuntimeError("current manifest descriptor mismatch")
    if current.get("reproducibility_hash") != manifest.get("reproducibility_hash"):
        raise RuntimeError("current pointer reproducibility hash mismatch")
    counts = manifest["counts"]
    return {
        **counts,
        "status": "published",
        "processed_this_run": 0,
        "reproducibility_hash": manifest["reproducibility_hash"],
        "source_identity": source_identity,
        "generation_policy": generation_policy,
        "generation_policy_sha256": generation_policy_sha256,
        "manifest": manifest,
        "manifest_output": actual_manifest,
        "snapshot_dir": str(snapshot_dir),
        "current_output": _file_descriptor(current_path),
    }


def _publish_snapshot(
    output_dir: Path,
    stage_dir: Path,
    source_identity: dict[str, object],
    generation_policy: dict[str, object],
    generation_policy_sha256: str,
    provenance: dict[str, object],
    counts: dict[str, int],
    publication_hook: Callable[[str], None] | None,
    source_identity_validator: Callable[[], None],
) -> dict[str, object]:
    output_hashes = {
        name: _sha256_file(stage_dir / name)
        for name in OUTPUT_FILES
    }
    reproducibility_hash = _reproducibility_hash(
        str(source_identity["identity_sha256"]),
        generation_policy_sha256,
        output_hashes,
    )
    manifest = {
        "schema_version": CORPUS_SCHEMA_VERSION,
        "snapshot_id": reproducibility_hash,
        "read_only_source": True,
        "offline": True,
        "db_mutation_performed": False,
        "network_calls_performed": False,
        "ocr_performed": False,
        "source_identity": source_identity,
        "generation_policy": generation_policy,
        "generation_policy_sha256": generation_policy_sha256,
        "official_provenance": {
            "list_url": provenance.get("official_list_url"),
            "api_url": provenance.get("official_api_url"),
            "snapshot": provenance.get("official_snapshot"),
            "download_boundary": "item download URLs were absent from the offline audit artifact",
        },
        "counts": counts,
        "output_hashes": output_hashes,
        "reproducibility": {
            "algorithm": "sha256",
            "canonical_source": (
                "canonical JSON of schema_version, source_identity_sha256, "
                "generation_policy_sha256, and output_hashes"
            ),
            "authoritative_field": "manifest.json#/reproducibility_hash",
        },
        "reproducibility_hash": reproducibility_hash,
    }
    snapshots_dir = output_dir / "snapshots"
    snapshots_dir.mkdir(parents=True, exist_ok=True)
    final_snapshot = snapshots_dir / reproducibility_hash
    if final_snapshot.exists():
        _validate_snapshot_directory(
            final_snapshot,
            source_identity,
            generation_policy,
            generation_policy_sha256,
        )
    else:
        temporary_snapshot = snapshots_dir / f".tmp-{os.getpid()}-{uuid.uuid4().hex}"
        temporary_snapshot.mkdir()
        try:
            for name in OUTPUT_FILES:
                _copy_file_streaming(stage_dir / name, temporary_snapshot / name)
            _write_json(temporary_snapshot / "manifest.json", manifest)
            _validate_snapshot_directory(
                temporary_snapshot,
                source_identity,
                generation_policy,
                generation_policy_sha256,
            )
            os.replace(temporary_snapshot, final_snapshot)
        finally:
            if temporary_snapshot.exists():
                _remove_tree_within(snapshots_dir, temporary_snapshot)
    if publication_hook:
        publication_hook("snapshot-ready")
    source_identity_validator()
    manifest_output = _file_descriptor(final_snapshot / "manifest.json")
    current = {
        "schema_version": CURRENT_SCHEMA_VERSION,
        "snapshot_path": f"snapshots/{reproducibility_hash}",
        "snapshot_id": reproducibility_hash,
        "source_identity_sha256": source_identity["identity_sha256"],
        "generation_policy_sha256": generation_policy_sha256,
        "reproducibility_hash": reproducibility_hash,
        "manifest": {
            "path": f"snapshots/{reproducibility_hash}/manifest.json",
            "size_bytes": manifest_output["size_bytes"],
            "sha256": manifest_output["sha256"],
        },
    }
    _write_json(output_dir / "current.json", current)
    if publication_hook:
        publication_hook("current-published")
    if stage_dir.exists():
        staging_root = (output_dir / "staging").resolve()
        _remove_tree_within(staging_root, stage_dir)
    return _validate_current_snapshot(
        output_dir,
        source_identity,
        generation_policy,
        generation_policy_sha256,
    )


def recover_corpus(
    source: Path,
    output_dir: Path,
    resume: bool,
    max_files: int | None,
    category: str | None,
    state: str | None,
    chunk_chars: int,
    provenance_path: Path | None,
    progress: Callable[[int, int, str], None] | None = None,
    resource_limits: ResourceLimits | None = None,
    publication_hook: Callable[[str], None] | None = None,
    reviewed_ocr_candidate_paths: Sequence[Path] | None = None,
    trusted_ocr_reviewer_ids: set[str] | None = None,
    ocr_review_hmac_key: bytes | None = None,
    expected_ocr_generator_sha256: str | None = None,
) -> dict[str, object]:
    if max_files is not None and max_files <= 0:
        raise ValueError("max_files must be greater than zero")
    if chunk_chars <= 0:
        raise ValueError("chunk_chars must be greater than zero")
    effective_limits = resource_limits or ResourceLimits()
    effective_limits.validate()
    entries, source_files, scan_stats = _discover_entries(source.resolve(), effective_limits)
    provenance = _load_provenance(provenance_path.resolve() if provenance_path else None)
    source_identity = _source_identity(source_files, entries, scan_stats)
    entries = _bind_entries_to_source_identity(entries, source_identity)
    if category:
        entries = [entry for entry in entries if entry.category == category]
    if state:
        lineage_map = provenance.get("lineage_by_member")
        entries = [
            entry
            for entry in entries
            if isinstance(lineage_map, dict)
            and isinstance(lineage_map.get(entry.member_name), dict)
            and lineage_map[entry.member_name].get("state") == state
        ]
    reviewed_ocr_candidates = _load_reviewed_ocr_candidates(reviewed_ocr_candidate_paths)
    selected_item_ids = {_item_id(entry) for entry in entries}
    unknown_candidate_items = sorted(set(reviewed_ocr_candidates) - selected_item_ids)
    if unknown_candidate_items:
        raise RuntimeError(
            f"reviewed OCR candidate item is not in selected inventory: {unknown_candidate_items}"
        )
    prepared_reviewed_ocr_items = _prepare_reviewed_ocr_items(
        entries,
        reviewed_ocr_candidates,
        provenance,
        effective_limits,
        trusted_reviewer_ids=trusted_ocr_reviewer_ids,
        review_hmac_key=ocr_review_hmac_key,
        expected_generator_sha256=expected_ocr_generator_sha256,
    )
    generation_policy, generation_policy_sha256 = _build_generation_policy(
        chunk_chars,
        category,
        state,
        provenance,
        effective_limits,
        list(reviewed_ocr_candidates.values()),
    )
    run_key = _staging_key(
        str(source_identity["identity_sha256"]),
        generation_policy_sha256,
    )
    output_dir = output_dir.resolve()
    stage_dir = output_dir / "staging" / run_key
    legacy_root_files = [output_dir / name for name in ("manifest.json", *OUTPUT_FILES)]

    if not resume:
        if output_dir.exists() and any(output_dir.iterdir()):
            raise RuntimeError(
                "fresh recovery output directory is not empty; use --resume or select a new output"
            )
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "staging").mkdir()
        file_states, counts, completed_source_keys = _initialize_stage(
            stage_dir,
            source_identity,
            generation_policy,
            generation_policy_sha256,
            len(entries),
        )
        stage_state = "in-progress"
    else:
        if not output_dir.is_dir():
            raise RuntimeError("resume checkpoint is missing because output directory does not exist")
        if any(path.exists() for path in legacy_root_files):
            raise RuntimeError("legacy root corpus exists without an atomic staging checkpoint")
        allowed_names = {"current.json", "snapshots", "staging"}
        unknown = [path.name for path in output_dir.iterdir() if path.name not in allowed_names]
        if unknown:
            raise RuntimeError(f"resume output contains unknown prior artifacts: {sorted(unknown)}")
        staging_root = output_dir / "staging"
        staging_dirs = (
            sorted((path for path in staging_root.iterdir() if path.is_dir()), key=lambda path: path.name)
            if staging_root.is_dir()
            else []
        )
        for existing_stage in staging_dirs:
            if not (existing_stage / "checkpoint.json").is_file():
                raise RuntimeError(f"staging checkpoint is missing: {existing_stage}")
        if (output_dir / "current.json").is_file():
            return _validate_current_snapshot(
                output_dir,
                source_identity,
                generation_policy,
                generation_policy_sha256,
            )
        if not stage_dir.is_dir():
            source_mismatch = False
            policy_mismatch = False
            for existing_stage in staging_dirs:
                checkpoint = _read_checkpoint(existing_stage / "checkpoint.json")
                if checkpoint.get("source_identity_sha256") != source_identity["identity_sha256"]:
                    source_mismatch = True
                elif checkpoint.get("generation_policy_sha256") != generation_policy_sha256:
                    policy_mismatch = True
            if source_mismatch:
                raise RuntimeError("resume source identity mismatch with existing staging")
            if policy_mismatch:
                raise RuntimeError("resume generation policy mismatch with existing staging")
            raise RuntimeError("resume checkpoint is missing for the requested source and generation policy")
        file_states, counts, completed_source_keys, stage_state = _resume_stage(
            stage_dir,
            source_identity,
            generation_policy,
            generation_policy_sha256,
            entries,
        )

    if stage_state == "complete" and len(completed_source_keys) != len(entries):
        raise RuntimeError("complete staging checkpoint does not cover the selected inventory")
    pending = list(entries[len(completed_source_keys):])
    if max_files is not None:
        pending = pending[:max_files]
    raw_first, text_first = _load_dedupe_maps(stage_dir / "items.jsonl")
    processed_this_run = 0
    open_archives: dict[Path, zipfile.ZipFile] = {}
    with contextlib.ExitStack() as archive_stack:
        for pending_index, entry in enumerate(pending, start=1):
            prepared_item = prepared_reviewed_ocr_items.get(entry.key)
            if prepared_item is not None:
                item = prepared_item
                failure = None
            else:
                try:
                    archive = None
                    if entry.archive_path:
                        archive = open_archives.get(entry.archive_path)
                        if archive is None:
                            archive = archive_stack.enter_context(_open_identity_bound_archive(entry))
                            open_archives[entry.archive_path] = archive
                    data = _read_entry_bytes(entry, archive)
                    item, failure = _build_item(entry, data, provenance, effective_limits)
                except SourceIdentityError:
                    raise
                except Exception as exc:
                    item_id = _item_id(entry)
                    item = {
                        "schema_version": CORPUS_SCHEMA_VERSION,
                        "item_id": item_id,
                        "stable_key": _stable_key(_normalize_version_code(Path(entry.member_name).stem)),
                        "version_key": _normalize_version_code(Path(entry.member_name).stem),
                        "title": Path(entry.member_name).stem,
                        "item_type": "technical-support-regulation" if "기술지원규정" in entry.member_name else "technical-guideline",
                        "category": entry.category,
                        "state": "current-unverified",
                        "source_zip": entry.archive_name,
                        "source_member": entry.member_name,
                        "source_key": entry.key,
                        "source_file_size": entry.file_size,
                        "source_compressed_size": entry.compressed_size,
                        "source_crc32": entry.crc32,
                        "extraction_status": "failure",
                        "page_count": 0,
                        "pages": [],
                        "ocr_candidate": True,
                        "ocr_candidate_reasons": ["source-read-failure"],
                    }
                    failure = {
                        "schema_version": CORPUS_SCHEMA_VERSION,
                        "item_id": item_id,
                        "source_key": entry.key,
                        "source_zip": entry.archive_name,
                        "source_member": entry.member_name,
                        "error_code": "source-read-failure",
                        "error_type": type(exc).__name__,
                        "message": str(exc),
                    }
            _apply_item_dedupe(item, raw_first, text_first)
            chunks = _chunk_pages(item, chunk_chars) if item.get("extraction_status") == "success" else []
            _append_jsonl_rows(file_states["items.jsonl"], (item,))
            chunk_count = _append_jsonl_rows(file_states["chunks.jsonl"], chunks)
            if failure:
                _append_jsonl_rows(file_states["failures.jsonl"], (failure,))
            completed_source_keys.append(entry.key)
            _update_counts_for_item(counts, item, chunk_count, failure is not None)
            checkpoint = _checkpoint_payload(
                source_identity,
                generation_policy,
                generation_policy_sha256,
                completed_source_keys,
                counts,
                file_states,
                "in-progress",
            )
            _write_json(stage_dir / "checkpoint.json", checkpoint)
            processed_this_run += 1
            if progress:
                progress(pending_index, len(pending), entry.key)
    if len(completed_source_keys) < len(entries):
        checkpoint_output = _file_descriptor(stage_dir / "checkpoint.json")
        return {
            **counts,
            "status": "staged",
            "processed_this_run": processed_this_run,
            "reproducibility_hash": None,
            "source_identity": source_identity,
            "generation_policy": generation_policy,
            "generation_policy_sha256": generation_policy_sha256,
            "manifest": None,
            "manifest_output": None,
            "snapshot_dir": None,
            "staging_dir": str(stage_dir),
            "checkpoint_output": checkpoint_output,
        }

    def validate_source_identity_unchanged() -> None:
        fresh_entries, fresh_source_files, fresh_scan_stats = _discover_entries(
            source.resolve(),
            effective_limits,
        )
        fresh_source_identity = _source_identity(
            fresh_source_files,
            fresh_entries,
            fresh_scan_stats,
        )
        if fresh_source_identity != source_identity:
            raise RuntimeError("source identity changed during PDF extraction")

    validate_source_identity_unchanged()

    final_checkpoint = _checkpoint_payload(
        source_identity,
        generation_policy,
        generation_policy_sha256,
        completed_source_keys,
        counts,
        file_states,
        "complete",
    )
    _write_json(stage_dir / "checkpoint.json", final_checkpoint)
    published = _publish_snapshot(
        output_dir,
        stage_dir,
        source_identity,
        generation_policy,
        generation_policy_sha256,
        provenance,
        counts,
        publication_hook,
        validate_source_identity_unchanged,
    )
    published["processed_this_run"] = processed_this_run
    return published


def validate_parse_accounting(
    stats: dict[str, object],
    expected_pdf_rows: int,
) -> dict[str, object]:
    rows_returned = int(stats["rowsReturned"])
    attempted = int(stats["parseAttemptedCount"])
    succeeded = int(stats["parseSuccessCount"])
    empty_output = int(stats["parseEmptyOutputCount"])
    failed = int(stats["parseFailureCount"])
    outcomes = stats["outcomes"]
    if not isinstance(outcomes, list):
        raise TypeError("parse outcomes must be a list")
    mismatches: list[str] = []
    if rows_returned != expected_pdf_rows:
        mismatches.append(f"rows-returned:{rows_returned}/{expected_pdf_rows}")
    if succeeded + empty_output + failed != attempted:
        mismatches.append(
            f"parse-outcomes:{succeeded + empty_output + failed}/{attempted}"
        )
    if len(outcomes) != rows_returned:
        mismatches.append(f"outcome-rows:{len(outcomes)}/{rows_returned}")
    return {**stats, "accountingMatches": not mismatches, "mismatches": mismatches}


def _parse_failure_paths(notices: list[str]) -> list[str]:
    failure_paths: list[str] = []
    pattern = re.compile(r"^\[warn\] PDF text extraction failed: (.+) \(.+\)$")
    for notice in notices:
        match = pattern.match(notice)
        if match:
            failure_paths.append(match.group(1))
    return sorted(failure_paths)


def _sanitize_source(source: ReferenceSource) -> dict[str, object]:
    value = asdict(source)
    value["source_path"] = "$KOSHA_TECHNICAL_FOLDER"
    metadata = value.get("metadata")
    if isinstance(metadata, dict) and "folder" in metadata:
        metadata["folder"] = "$KOSHA_TECHNICAL_FOLDER"
    return value


def build_snapshot(
    technical_folder: Path,
    max_pdf_pages: int,
    parser: TechnicalParser = parse_technical_support_zips,
) -> dict[str, object]:
    parser_output = io.StringIO()
    with contextlib.redirect_stdout(parser_output):
        source, items = parser(technical_folder, max_pdf_pages, False)
    parser_notices = [line.strip() for line in parser_output.getvalue().splitlines() if line.strip()]
    failure_paths = set(_parse_failure_paths(parser_notices))
    outcomes: list[dict[str, str]] = []
    matched_failure_paths: set[str] = set()
    for item in items:
        payload = item.payload if isinstance(item.payload, dict) else {}
        internal_path = str(payload.get("internalPath") or item.title)
        attempted = payload.get("isPriority") is True or item.item_type == "technical-support-regulation"
        if not attempted:
            status = "not-attempted"
        elif internal_path in failure_paths:
            status = "failure"
            matched_failure_paths.add(internal_path)
        elif not item.body.strip():
            status = "empty_output"
        else:
            status = "success"
        outcomes.append({"internalPath": internal_path, "status": status})
    outcomes.sort(key=lambda outcome: outcome["internalPath"])
    parse_stats = validate_parse_accounting(
        {
            "rowsReturned": len(items),
            "parseAttemptedCount": sum(outcome["status"] != "not-attempted" for outcome in outcomes),
            "parseSuccessCount": sum(outcome["status"] == "success" for outcome in outcomes),
            "parseEmptyOutputCount": sum(outcome["status"] == "empty_output" for outcome in outcomes),
            "parseFailureCount": sum(outcome["status"] == "failure" for outcome in outcomes),
            "parseNotAttemptedCount": sum(outcome["status"] == "not-attempted" for outcome in outcomes),
            "unmatchedFailureNotices": sorted(failure_paths - matched_failure_paths),
            "outcomes": outcomes,
        },
        expected_pdf_rows=len(items),
    )
    if parse_stats["unmatchedFailureNotices"]:
        mismatches = list(parse_stats["mismatches"])
        mismatches.append(
            f"unmatched-failure-notices:{len(parse_stats['unmatchedFailureNotices'])}"
        )
        parse_stats["mismatches"] = mismatches
        parse_stats["accountingMatches"] = False
    return {
        "readOnly": True,
        "dbMutationPerformed": False,
        "source": _sanitize_source(source),
        "itemCount": len(items),
        "items": [asdict(item) for item in items],
        "parserNotices": parser_notices,
        "parseStats": parse_stats,
    }


def _existing_snapshot_elapsed_seconds(
    report_path: Path,
    reproducibility_hash: str,
) -> float | None:
    if not report_path.is_file():
        return None
    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    if payload.get("reproducibility_hash") != reproducibility_hash:
        return None
    if payload.get("elapsed_semantics") not in {
        "snapshot_build_wall_time",
        "preserved_snapshot_build_wall_time",
    }:
        return None
    value = payload.get("snapshot_elapsed_seconds", payload.get("elapsed_seconds"))
    if not isinstance(value, int | float):
        return None
    return round(float(value), 3)


def write_quality_report(
    summary: dict[str, object],
    output_dir: Path,
    report_dir: Path,
    elapsed_seconds: float,
) -> tuple[Path, Path]:
    manifest = summary.get("manifest")
    if not isinstance(manifest, dict):
        raise TypeError("recovery summary manifest must be an object")
    manifest_output = summary.get("manifest_output")
    if not isinstance(manifest_output, dict):
        raise TypeError("recovery summary manifest_output must be an object")
    manifest_path_value = manifest_output.get("path")
    if not isinstance(manifest_path_value, str):
        raise TypeError("recovery manifest output path must be a string")
    actual_manifest_output = _file_descriptor(Path(manifest_path_value))
    if actual_manifest_output != manifest_output:
        raise ValueError(f"manifest output descriptor mismatch: {manifest_output}/{actual_manifest_output}")
    if manifest.get("reproducibility_hash") != summary.get("reproducibility_hash"):
        raise ValueError("summary and manifest reproducibility hashes differ")
    declared_output_hashes = manifest.get("output_hashes")
    if not isinstance(declared_output_hashes, dict):
        raise TypeError("recovery manifest output_hashes must be an object")
    snapshot_dir = Path(manifest_path_value).parent
    actual_output_hashes = {
        name: _sha256_file(snapshot_dir / name)
        for name in OUTPUT_FILES
    }
    if declared_output_hashes != actual_output_hashes:
        raise ValueError(
            f"manifest declared output hashes differ from files: {declared_output_hashes}/{actual_output_hashes}"
        )
    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        raise TypeError("recovery manifest counts must be an object")
    generation_policy = manifest.get("generation_policy")
    if not isinstance(generation_policy, dict):
        raise TypeError("recovery manifest generation_policy must be an object")
    reviewed_ocr_candidates = generation_policy.get("reviewed_ocr_candidates", [])
    if not isinstance(reviewed_ocr_candidates, list):
        raise TypeError("recovery generation policy reviewed_ocr_candidates must be a list")
    reviewed_ocr_import_count = len(reviewed_ocr_candidates)
    body_missing = int(counts.get("boundary", 0)) + int(counts.get("failure", 0))
    completed = int(counts.get("completed", 0))
    inventory = int(counts.get("inventory", 0))
    reproducibility_hash = summary.get("reproducibility_hash")
    if not isinstance(reproducibility_hash, str):
        raise TypeError("recovery summary reproducibility_hash must be a string")
    provenance = manifest.get("official_provenance")
    item_download_boundary = (
        provenance.get("download_boundary")
        if isinstance(provenance, dict)
        else "official provenance unavailable"
    )
    gates = {
        "inventory_complete": completed == inventory,
        "body_missing_zero": body_missing == 0,
        "hard_failure_zero": int(counts.get("failure", 0)) == 0,
        "item_download_provenance_complete": False,
    }
    launch_ready = all(gates.values())
    artifact_sizes = {
        name: (snapshot_dir / name).stat().st_size
        for name in ("manifest.json", *OUTPUT_FILES)
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "report.json"
    markdown_path = report_dir / "report.md"
    invocation_elapsed_seconds = round(elapsed_seconds, 3)
    processed_this_run = summary.get("processed_this_run")
    processed_count = (
        int(processed_this_run)
        if isinstance(processed_this_run, int)
        else None
    )
    existing_snapshot_elapsed_seconds = _existing_snapshot_elapsed_seconds(
        json_path,
        reproducibility_hash,
    )
    if processed_count is not None and processed_count > 0:
        snapshot_elapsed_seconds = invocation_elapsed_seconds
        elapsed_semantics = "snapshot_build_wall_time"
    elif existing_snapshot_elapsed_seconds is not None:
        snapshot_elapsed_seconds = existing_snapshot_elapsed_seconds
        elapsed_semantics = "preserved_snapshot_build_wall_time"
    else:
        snapshot_elapsed_seconds = invocation_elapsed_seconds
        elapsed_semantics = "resume_validation_wall_time_only"
    report = {
        "schema_version": "safeclaw-kosha-body-recovery-report/v2",
        "status": "DONE" if body_missing == 0 and int(counts.get("failure", 0)) == 0 else "DONE_WITH_CONCERNS",
        "launch_ready": launch_ready,
        "launch_readiness_note": (
            "all local body and provenance gates passed"
            if launch_ready
            else f"not launch-ready; body_missing={body_missing}; {item_download_boundary}"
        ),
        "read_only_source": True,
        "offline": True,
        "db_mutation_performed": False,
        "network_calls_performed": False,
        "ocr_performed": False,
        **(
            {"reviewed_ocr_import_count": reviewed_ocr_import_count}
            if reviewed_ocr_import_count
            else {}
        ),
        "elapsed_seconds": snapshot_elapsed_seconds,
        "snapshot_elapsed_seconds": snapshot_elapsed_seconds,
        "invocation_elapsed_seconds": invocation_elapsed_seconds,
        "elapsed_semantics": elapsed_semantics,
        "processed_this_run": processed_count,
        "counts": counts,
        "body_missing": body_missing,
        "failure_ledger_count": sum(1 for _ in _iter_jsonl(snapshot_dir / "failures.jsonl")),
        "gates": gates,
        "reproducibility_hash": reproducibility_hash,
        "manifest": manifest_output,
        "output_hash_validation": {
            "matched": True,
            "hashes": actual_output_hashes,
        },
        "source_identity": summary.get("source_identity"),
        "generation_policy": generation_policy,
        "generation_policy_sha256": manifest.get("generation_policy_sha256"),
        "local_artifacts": {
            "output_dir": str(output_dir.resolve()),
            "snapshot_dir": str(snapshot_dir.resolve()),
            "current": _file_descriptor(output_dir / "current.json"),
            "sizes_bytes": artifact_sizes,
        },
    }
    _write_json(json_path, report)
    invocation_elapsed_line = (
        f"- invocation_elapsed_seconds: {report['invocation_elapsed_seconds']}"
        if report["invocation_elapsed_seconds"] != report["snapshot_elapsed_seconds"]
        or report["elapsed_semantics"] != "snapshot_build_wall_time"
        else None
    )
    markdown = "\n".join(
        [
            "# KOSHA local full-body corpus recovery",
            "",
            f"- status: **{report['status']}**",
            f"- launch-ready: **{str(launch_ready).lower()}**",
            f"- snapshot_elapsed_seconds: {report['snapshot_elapsed_seconds']}",
            *(
                [invocation_elapsed_line]
                if invocation_elapsed_line is not None
                else []
            ),
            f"- elapsed_semantics: `{report['elapsed_semantics']}`",
            f"- source PDF inventory / completed: {inventory} / {completed}",
            (
                f"- body success: {counts.get('success', 0)}"
                if reviewed_ocr_import_count
                else f"- native body success: {counts.get('success', 0)}"
            ),
            *(
                [f"- Human-reviewed OCR imports: {reviewed_ocr_import_count}"]
                if reviewed_ocr_import_count
                else []
            ),
            f"- body missing boundary / hard failure: {counts.get('boundary', 0)} / {counts.get('failure', 0)}",
            f"- OCR candidate items / pages: {counts.get('ocr_candidate_items', 0)} / {counts.get('ocr_candidate_pages', 0)}",
            f"- chunks: {counts.get('chunks', 0)}",
            f"- raw / normalized-text duplicate rows: {counts.get('raw_duplicate_rows', 0)} / {counts.get('text_duplicate_rows', 0)}",
            f"- reproducibility hash: `{summary.get('reproducibility_hash')}`",
            f"- manifest SHA256 / bytes: `{manifest_output.get('sha256')}` / {manifest_output.get('size_bytes')}",
            "- manifest-declared output hashes: matched",
            f"- local snapshot: `{snapshot_dir.resolve()}`",
            "",
            "## Boundaries",
            "",
            "- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.",
            f"- Launch readiness remains false: body_missing={body_missing}; {item_download_boundary}.",
            (
                "- Snapshot generation did not perform OCR; declared human-reviewed OCR "
                "candidates were validated before import."
                if reviewed_ocr_import_count
                else (
                    "- OCR candidates are boundaries only. No OCR result is represented "
                    "as recovered text."
                )
            ),
            "",
            "## Artifact sizes",
            "",
            *[f"- `{name}`: {size} bytes" for name, size in artifact_sizes.items()],
            "",
        ]
    )
    markdown_path.write_text(markdown, encoding="utf-8", newline="\n")
    return json_path, markdown_path


def _stderr_progress(current: int, total: int, key: str) -> None:
    if current % 25 == 0 or current == total:
        print(f"[progress] processed={current}/{total} source={key}", file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Emit a read-only local KOSHA GUIDE corpus snapshot as JSON."
    )
    parser.add_argument(
        "--technical-folder",
        default=os.environ.get(
            "KOSHA_TECHNICAL_FOLDER",
            str(Path.home() / "Downloads" / "기술지원규정"),
        ),
    )
    parser.add_argument("--max-pdf-pages", type=int, default=3)
    parser.add_argument("--source", help="Explicit local directory, ZIP, or PDF source for full-body recovery.")
    parser.add_argument("--output-dir", help="Directory for deterministic corpus output files.")
    parser.add_argument("--resume", action="store_true", help="Resume from an existing checkpoint and ledgers.")
    parser.add_argument("--max-files", type=int, help="Process at most this many pending PDF files.")
    parser.add_argument("--category", help="Process only an exact archive-derived category.")
    parser.add_argument("--state", help="Process only an exact state when provenance metadata permits.")
    parser.add_argument("--chunk-chars", type=int, default=4000)
    parser.add_argument("--max-member-count", type=int, default=ResourceLimits.max_member_count)
    parser.add_argument("--max-member-bytes", type=int, default=ResourceLimits.max_member_bytes)
    parser.add_argument(
        "--max-compression-ratio",
        type=float,
        default=ResourceLimits.max_compression_ratio,
    )
    parser.add_argument(
        "--max-total-uncompressed-bytes",
        type=int,
        default=ResourceLimits.max_total_uncompressed_bytes,
    )
    parser.add_argument(
        "--max-pages-per-pdf",
        type=int,
        default=ResourceLimits.max_pages_per_pdf,
    )
    parser.add_argument(
        "--max-normalized-chars-per-pdf",
        type=int,
        default=ResourceLimits.max_normalized_chars_per_pdf,
    )
    parser.add_argument(
        "--provenance",
        default=str(REPO_ROOT / "evaluation" / "kosha-guide-audit-2026-07-11" / "report.json"),
        help="Optional offline KOSHA audit JSON used only for provenance and version lineage.",
    )
    parser.add_argument(
        "--reviewed-ocr-candidate",
        action="append",
        default=[],
        help=(
            "Reviewed OCR candidate JSON to validate and import; repeat for "
            "distinct corpus items."
        ),
    )
    parser.add_argument(
        "--trusted-ocr-reviewer-id",
        action="append",
        default=[],
        help="Trusted reviewer identity for declared OCR candidates; repeat as needed.",
    )
    parser.add_argument(
        "--expected-ocr-generator-sha256",
        help="Trusted SHA-256 of the OCR candidate generator script.",
    )
    parser.add_argument("--report-dir", help="Optional directory for quality report.json and report.md.")
    parser.add_argument("--preflight", action="store_true", help="Validate and identify the local source without extracting PDFs.")
    parser.add_argument(
        "--inventory-only",
        action="store_true",
        help="Emit bounded archive entry metadata without extracting PDF bodies.",
    )
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        if args.preflight and args.inventory_only:
            raise ValueError("--preflight and --inventory-only are mutually exclusive")
        if args.source:
            source = Path(args.source)
            resource_limits = ResourceLimits(
                max_member_count=args.max_member_count,
                max_member_bytes=args.max_member_bytes,
                max_compression_ratio=args.max_compression_ratio,
                max_total_uncompressed_bytes=args.max_total_uncompressed_bytes,
                max_pages_per_pdf=args.max_pages_per_pdf,
                max_normalized_chars_per_pdf=args.max_normalized_chars_per_pdf,
            )
            entries, source_files, scan_stats = _discover_entries(
                source.resolve(),
                resource_limits,
                include_direct_pdfs=not args.inventory_only,
            )
            source_identity = _source_identity(source_files, entries, scan_stats)
            if args.inventory_only:
                print(_canonical_json(_inventory_payload(source, entries, source_identity, resource_limits)))
                return 0
            if args.preflight:
                print(_canonical_json({"ok": True, "source": str(source.resolve()), "source_identity": source_identity}))
                return 0
            if not args.output_dir:
                raise ValueError("--output-dir is required with --source unless --preflight is used")
            started = time.perf_counter()
            provenance_path = Path(args.provenance) if args.provenance else None
            review_hmac_key_value = os.environ.get(OCR_REVIEW_HMAC_KEY_ENV)
            summary = recover_corpus(
                source=source,
                output_dir=Path(args.output_dir),
                resume=args.resume,
                max_files=args.max_files,
                category=args.category,
                state=args.state,
                chunk_chars=args.chunk_chars,
                provenance_path=provenance_path,
                progress=_stderr_progress,
                resource_limits=resource_limits,
                reviewed_ocr_candidate_paths=[
                    Path(value) for value in args.reviewed_ocr_candidate
                ],
                trusted_ocr_reviewer_ids=set(args.trusted_ocr_reviewer_id),
                ocr_review_hmac_key=(
                    review_hmac_key_value.encode("utf-8")
                    if review_hmac_key_value is not None
                    else None
                ),
                expected_ocr_generator_sha256=args.expected_ocr_generator_sha256,
            )
            elapsed_seconds = time.perf_counter() - started
            report_paths: list[str] = []
            if args.report_dir:
                if summary.get("manifest_output") is None:
                    raise RuntimeError("--report-dir requires a completed published snapshot")
                report_paths = [
                    str(path)
                    for path in write_quality_report(
                        summary,
                        Path(args.output_dir),
                        Path(args.report_dir),
                        elapsed_seconds,
                    )
                ]
            public_summary = {
                key: value
                for key, value in summary.items()
                if key not in {"manifest", "manifest_output"}
            }
            print(
                _canonical_json(
                    {
                        **public_summary,
                        "manifest": summary["manifest_output"],
                        "elapsed_seconds": round(elapsed_seconds, 3),
                        "report_paths": report_paths,
                    }
                )
            )
            return 0
        if args.preflight or args.inventory_only:
            raise ValueError("--preflight and --inventory-only require --source")
        with contextlib.redirect_stdout(sys.stderr):
            snapshot = build_snapshot(Path(args.technical_folder), args.max_pdf_pages)
        print(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as exc:
        print(f"KOSHA GUIDE local snapshot failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
