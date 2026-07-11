from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import re
import sys
import time
import unicodedata
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Sequence

from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingest_safety_reference_catalog import (
    ReferenceItem,
    ReferenceSource,
    decode_zip_name,
    parse_technical_support_zips,
)


TechnicalParser = Callable[[Path, int, bool], tuple[ReferenceSource, list[ReferenceItem]]]

CORPUS_SCHEMA_VERSION = "safeclaw-kosha-body-corpus/v1"
OFFICIAL_LIST_URL = "https://portal.kosha.or.kr/archive/resources/tech-support/search/all?page=1&rowsPerPage=10"
OFFICIAL_API_URL = "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList"
OUTPUT_FILES = ("items.jsonl", "chunks.jsonl", "failures.jsonl", "checkpoint.json")


@dataclass(frozen=True)
class LocalPdfEntry:
    archive_path: Path | None
    archive_name: str | None
    member_name: str
    category: str | None
    file_size: int
    crc32: str | None
    zip_member_name: str | None = None
    direct_path: Path | None = None

    @property
    def key(self) -> str:
        return f"{self.archive_name or '<direct>'}::{self.member_name}"


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


def _write_json(path: Path, value: object) -> None:
    path.write_text(f"{_canonical_json(value)}\n", encoding="utf-8", newline="\n")


def _write_jsonl(path: Path, rows: Sequence[dict[str, object]]) -> None:
    content = "".join(f"{_canonical_json(row)}\n" for row in rows)
    path.write_text(content, encoding="utf-8", newline="\n")


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    rows: list[dict[str, object]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").split("\n"), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise ValueError(f"{path.name}:{line_number} must contain a JSON object")
        rows.append(value)
    return rows


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


def _discover_entries(source: Path) -> tuple[list[LocalPdfEntry], list[Path]]:
    if not source.exists():
        raise FileNotFoundError(f"local source does not exist: {source}")
    if source.is_dir():
        archives = sorted(source.glob("*.zip"), key=lambda path: path.name)
        direct_pdfs = sorted(source.glob("*.pdf"), key=lambda path: path.name)
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

    entries: list[LocalPdfEntry] = []
    for archive_path in archives:
        try:
            with zipfile.ZipFile(archive_path) as archive:
                for info in archive.infolist():
                    if info.is_dir():
                        continue
                    member_name = decode_zip_name(info.filename).replace("\\", "/")
                    if not member_name.lower().endswith(".pdf"):
                        continue
                    entries.append(
                        LocalPdfEntry(
                            archive_path=archive_path,
                            archive_name=archive_path.name,
                            member_name=member_name,
                            category=_category_from_archive(archive_path),
                            file_size=info.file_size,
                            crc32=f"{info.CRC:08x}",
                            zip_member_name=info.filename,
                        )
                    )
        except zipfile.BadZipFile as exc:
            raise ValueError(f"bad ZIP source: {archive_path.name}: {exc}") from exc
    for pdf_path in direct_pdfs:
        entries.append(
            LocalPdfEntry(
                archive_path=None,
                archive_name=None,
                member_name=pdf_path.name,
                category=None,
                file_size=pdf_path.stat().st_size,
                crc32=None,
                direct_path=pdf_path,
            )
        )
    entries.sort(key=lambda entry: (entry.archive_name or "", entry.member_name))
    return entries, archives + direct_pdfs


def _read_entry_bytes(entry: LocalPdfEntry, archive: zipfile.ZipFile | None = None) -> bytes:
    if entry.direct_path:
        return entry.direct_path.read_bytes()
    if not entry.archive_path:
        raise RuntimeError(f"entry has no readable source: {entry.key}")
    if archive is not None and entry.zip_member_name is not None:
        return archive.read(entry.zip_member_name)
    with zipfile.ZipFile(entry.archive_path) as opened_archive:
        if entry.zip_member_name is not None:
            return opened_archive.read(entry.zip_member_name)
    raise KeyError(f"ZIP member disappeared after inventory: {entry.key}")


def _object_has_image(value: object, seen: set[int]) -> bool:
    if hasattr(value, "get_object"):
        value = value.get_object()
    marker = id(value)
    if marker in seen:
        return False
    seen.add(marker)
    if not hasattr(value, "get"):
        return False
    subtype = value.get("/Subtype")
    if subtype == "/Image":
        return True
    resources = value.get("/Resources")
    if hasattr(resources, "get_object"):
        resources = resources.get_object()
    if resources and hasattr(resources, "get"):
        xobjects = resources.get("/XObject")
        if hasattr(xobjects, "get_object"):
            xobjects = xobjects.get_object()
        if xobjects and hasattr(xobjects, "values"):
            return any(_object_has_image(item, seen) for item in xobjects.values())
    return False


def _page_has_image(page: object) -> bool:
    return _object_has_image(page, set())


def _load_provenance(path: Path | None) -> dict[str, object]:
    base: dict[str, object] = {
        "official_list_url": OFFICIAL_LIST_URL,
        "official_api_url": OFFICIAL_API_URL,
        "official_snapshot": None,
        "lineage_by_member": {},
    }
    if path is None:
        return base
    if not path.exists():
        raise FileNotFoundError(f"provenance JSON does not exist: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"provenance JSON must be an object: {path}")
    inventory = payload.get("inventory")
    if not isinstance(inventory, dict):
        return {**base, "provided": payload}
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
    }


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
) -> tuple[dict[str, object], dict[str, object] | None]:
    title = Path(entry.member_name).stem
    version_key = _normalize_version_code(title)
    stable_key = _stable_key(version_key)
    raw_sha256 = _sha256_bytes(data)
    item_id = f"kosha-{_sha256_bytes(entry.key.encode('utf-8'))[:24]}"
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
        reader = PdfReader(io.BytesIO(data), strict=False)
        page_rows: list[dict[str, object]] = []
        page_texts: list[str] = []
        body_offset = 0
        for page_number, page in enumerate(reader.pages, start=1):
            text = _normalize_page_text(page.extract_text() or "")
            normalized_count = _normalized_char_count(text)
            has_image = _page_has_image(page)
            page_ocr_candidate = has_image and normalized_count < 80
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
            body_offset = page_end + (1 if page_number < len(reader.pages) else 0)
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
    if normalized_count < 500:
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


def _apply_dedupe(items: list[dict[str, object]]) -> None:
    raw_first: dict[str, str] = {}
    text_first: dict[str, str] = {}
    for item in items:
        item_id = str(item["item_id"])
        raw_hash = item.get("raw_sha256")
        text_hash = item.get("normalized_text_sha256")
        item["raw_duplicate_of"] = raw_first.get(str(raw_hash)) if raw_hash else None
        if raw_hash and str(raw_hash) not in raw_first:
            raw_first[str(raw_hash)] = item_id
        item["text_duplicate_of"] = text_first.get(str(text_hash)) if text_hash and item.get("extraction_status") == "success" else None
        if text_hash and item.get("extraction_status") == "success" and str(text_hash) not in text_first:
            text_first[str(text_hash)] = item_id


def _source_identity(files: Sequence[Path], entries: Sequence[LocalPdfEntry]) -> dict[str, object]:
    file_rows = [
        {"name": path.name, "size": path.stat().st_size, "sha256": _sha256_file(path)}
        for path in sorted(files, key=lambda value: value.name)
    ]
    inventory_rows = [
        {
            "source_zip": entry.archive_name,
            "source_member": entry.member_name,
            "file_size": entry.file_size,
            "crc32": entry.crc32,
        }
        for entry in entries
    ]
    identity_hash = _sha256_bytes(_canonical_json({"files": file_rows, "entries": inventory_rows}).encode("utf-8"))
    return {
        "identity_sha256": identity_hash,
        "files": file_rows,
        "pdf_entry_count": len(entries),
        "entry_manifest_sha256": _sha256_bytes(_canonical_json(inventory_rows).encode("utf-8")),
    }


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
) -> dict[str, object]:
    if max_files is not None and max_files <= 0:
        raise ValueError("max_files must be greater than zero")
    if chunk_chars <= 0:
        raise ValueError("chunk_chars must be greater than zero")
    entries, source_files = _discover_entries(source.resolve())
    provenance = _load_provenance(provenance_path.resolve() if provenance_path else None)
    source_identity = _source_identity(source_files, entries)
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
    output_dir.mkdir(parents=True, exist_ok=True)
    existing_items = _read_jsonl(output_dir / "items.jsonl") if resume else []
    existing_failures = _read_jsonl(output_dir / "failures.jsonl") if resume else []
    if resume and (output_dir / "checkpoint.json").exists():
        checkpoint = json.loads((output_dir / "checkpoint.json").read_text(encoding="utf-8"))
        checkpoint_identity = checkpoint.get("source_identity_sha256") if isinstance(checkpoint, dict) else None
        if checkpoint_identity != source_identity["identity_sha256"]:
            raise ValueError(
                f"resume source identity mismatch: {checkpoint_identity}/{source_identity['identity_sha256']}"
            )
    completed = {str(item.get("source_key")) for item in existing_items}
    pending = [entry for entry in entries if entry.key not in completed]
    if max_files is not None:
        pending = pending[:max_files]
    new_items: list[dict[str, object]] = []
    new_failures: list[dict[str, object]] = []
    open_archives: dict[Path, zipfile.ZipFile] = {}
    try:
        for pending_index, entry in enumerate(pending, start=1):
            try:
                archive = None
                if entry.archive_path:
                    archive = open_archives.get(entry.archive_path)
                    if archive is None:
                        archive = zipfile.ZipFile(entry.archive_path)
                        open_archives[entry.archive_path] = archive
                data = _read_entry_bytes(entry, archive)
                item, failure = _build_item(entry, data, provenance)
            except Exception as exc:
                item_id = f"kosha-{_sha256_bytes(entry.key.encode('utf-8'))[:24]}"
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
            new_items.append(item)
            if failure:
                new_failures.append(failure)
            if progress and (pending_index % 25 == 0 or pending_index == len(pending)):
                progress(pending_index, len(pending), entry.key)
    finally:
        for archive in open_archives.values():
            archive.close()

    items = existing_items + new_items
    items.sort(key=lambda item: str(item.get("source_key", "")))
    _apply_dedupe(items)
    failures_by_item = {
        str(row.get("item_id")): row for row in existing_failures + new_failures
    }
    failures = sorted(failures_by_item.values(), key=lambda row: str(row.get("source_key", "")))
    chunks: list[dict[str, object]] = []
    for item in items:
        if item.get("extraction_status") == "success":
            chunks.extend(_chunk_pages(item, chunk_chars))
    chunks.sort(key=lambda chunk: (str(chunk["item_id"]), int(chunk["page_start"]), int(chunk["source_spans"][0]["char_start"])))
    completed_keys = [str(item["source_key"]) for item in items]
    checkpoint = {
        "schema_version": CORPUS_SCHEMA_VERSION,
        "source_identity_sha256": source_identity["identity_sha256"],
        "completed_count": len(completed_keys),
        "completed_source_keys": completed_keys,
    }
    _write_jsonl(output_dir / "items.jsonl", items)
    _write_jsonl(output_dir / "chunks.jsonl", chunks)
    _write_jsonl(output_dir / "failures.jsonl", failures)
    _write_json(output_dir / "checkpoint.json", checkpoint)
    output_hashes = {
        name: _sha256_file(output_dir / name)
        for name in OUTPUT_FILES
    }
    reproducibility_hash = _sha256_bytes(
        _canonical_json(
            {
                "schema_version": CORPUS_SCHEMA_VERSION,
                "source_identity_sha256": source_identity["identity_sha256"],
                "output_hashes": output_hashes,
            }
        ).encode("utf-8")
    )
    counts = {
        "inventory": len(entries),
        "completed": len(items),
        "success": sum(item.get("extraction_status") == "success" for item in items),
        "boundary": sum(item.get("extraction_status") == "boundary" for item in items),
        "failure": sum(item.get("extraction_status") == "failure" for item in items),
        "ocr_candidate_items": sum(item.get("ocr_candidate") is True for item in items),
        "ocr_candidate_pages": sum(
            page.get("ocr_candidate") is True
            for item in items
            for page in item.get("pages", [])
            if isinstance(page, dict)
        ),
        "chunks": len(chunks),
        "raw_duplicate_rows": sum(item.get("raw_duplicate_of") is not None for item in items),
        "text_duplicate_rows": sum(item.get("text_duplicate_of") is not None for item in items),
    }
    manifest = {
        "schema_version": CORPUS_SCHEMA_VERSION,
        "read_only_source": True,
        "offline": True,
        "db_mutation_performed": False,
        "network_calls_performed": False,
        "ocr_performed": False,
        "source_identity": source_identity,
        "filters": {"category": category, "state": state, "max_files": max_files},
        "policies": {
            "page_ocr_candidate": "has_image and normalized_char_count < 80",
            "document_ocr_candidate": "normalized_char_count < 500",
            "unusable_body": "excluded from chunks and retained in items/failures metadata",
            "chunk_chars": chunk_chars,
        },
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
            "canonical_source": "canonical JSON of schema_version, source_identity_sha256, and output_hashes",
            "authoritative_field": "manifest.json#/reproducibility_hash",
        },
        "reproducibility_hash": reproducibility_hash,
    }
    manifest_path = output_dir / "manifest.json"
    _write_json(manifest_path, manifest)
    manifest_output = _file_descriptor(manifest_path)
    return {
        **counts,
        "processed_this_run": len(new_items),
        "reproducibility_hash": reproducibility_hash,
        "source_identity": source_identity,
        "manifest": manifest,
        "manifest_output": manifest_output,
    }


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
    actual_output_hashes = {
        name: _sha256_file(output_dir / name)
        for name in OUTPUT_FILES
    }
    if declared_output_hashes != actual_output_hashes:
        raise ValueError(
            f"manifest declared output hashes differ from files: {declared_output_hashes}/{actual_output_hashes}"
        )
    counts = manifest.get("counts")
    if not isinstance(counts, dict):
        raise TypeError("recovery manifest counts must be an object")
    body_missing = int(counts.get("boundary", 0)) + int(counts.get("failure", 0))
    completed = int(counts.get("completed", 0))
    inventory = int(counts.get("inventory", 0))
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
        name: (output_dir / name).stat().st_size
        for name in ("manifest.json", *OUTPUT_FILES)
    }
    report = {
        "schema_version": "safeclaw-kosha-body-recovery-report/v1",
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
        "elapsed_seconds": round(elapsed_seconds, 3),
        "counts": counts,
        "body_missing": body_missing,
        "failure_ledger_count": len(_read_jsonl(output_dir / "failures.jsonl")),
        "gates": gates,
        "reproducibility_hash": summary.get("reproducibility_hash"),
        "manifest": manifest_output,
        "output_hash_validation": {
            "matched": True,
            "hashes": actual_output_hashes,
        },
        "source_identity": summary.get("source_identity"),
        "local_artifacts": {
            "output_dir": str(output_dir.resolve()),
            "sizes_bytes": artifact_sizes,
        },
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "report.json"
    markdown_path = report_dir / "report.md"
    _write_json(json_path, report)
    markdown = "\n".join(
        [
            "# KOSHA local full-body corpus recovery",
            "",
            f"- status: **{report['status']}**",
            f"- launch-ready: **{str(launch_ready).lower()}**",
            f"- elapsed_seconds: {report['elapsed_seconds']}",
            f"- source PDF inventory / completed: {inventory} / {completed}",
            f"- native body success: {counts.get('success', 0)}",
            f"- body missing boundary / hard failure: {counts.get('boundary', 0)} / {counts.get('failure', 0)}",
            f"- OCR candidate items / pages: {counts.get('ocr_candidate_items', 0)} / {counts.get('ocr_candidate_pages', 0)}",
            f"- chunks: {counts.get('chunks', 0)}",
            f"- raw / normalized-text duplicate rows: {counts.get('raw_duplicate_rows', 0)} / {counts.get('text_duplicate_rows', 0)}",
            f"- reproducibility hash: `{summary.get('reproducibility_hash')}`",
            f"- manifest SHA256 / bytes: `{manifest_output.get('sha256')}` / {manifest_output.get('size_bytes')}",
            "- manifest-declared output hashes: matched",
            f"- local output: `{output_dir.resolve()}`",
            "",
            "## Boundaries",
            "",
            "- Local ZIP/PDF bytes were read only. No DB write, migration, upload, network request, OCR, embedding, or external API call was performed.",
            f"- Launch readiness remains false: body_missing={body_missing}; {item_download_boundary}.",
            "- OCR candidates are boundaries only. No OCR result is represented as recovered text.",
            "",
            "## Artifact sizes",
            "",
            *[f"- `{name}`: {size} bytes" for name, size in artifact_sizes.items()],
            "",
        ]
    )
    markdown_path.write_text(markdown, encoding="utf-8", newline="\n")
    return json_path, markdown_path


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
    parser.add_argument(
        "--provenance",
        default=str(REPO_ROOT / "evaluation" / "kosha-guide-audit-2026-07-11" / "report.json"),
        help="Optional offline KOSHA audit JSON used only for provenance and version lineage.",
    )
    parser.add_argument("--report-dir", help="Optional directory for quality report.json and report.md.")
    parser.add_argument("--preflight", action="store_true", help="Validate and identify the local source without extracting PDFs.")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        if args.source:
            source = Path(args.source)
            entries, source_files = _discover_entries(source.resolve())
            source_identity = _source_identity(source_files, entries)
            if args.preflight:
                print(_canonical_json({"ok": True, "source": str(source.resolve()), "source_identity": source_identity}))
                return 0
            if not args.output_dir:
                raise ValueError("--output-dir is required with --source unless --preflight is used")
            started = time.perf_counter()
            provenance_path = Path(args.provenance) if args.provenance else None
            summary = recover_corpus(
                source=source,
                output_dir=Path(args.output_dir),
                resume=args.resume,
                max_files=args.max_files,
                category=args.category,
                state=args.state,
                chunk_chars=args.chunk_chars,
                provenance_path=provenance_path,
                progress=lambda current, total, key: print(
                    f"[progress] processed={current}/{total} source={key}",
                    file=sys.stderr,
                ),
            )
            elapsed_seconds = time.perf_counter() - started
            report_paths: list[str] = []
            if args.report_dir:
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
        if args.preflight:
            raise ValueError("--preflight requires --source")
        with contextlib.redirect_stdout(sys.stderr):
            snapshot = build_snapshot(Path(args.technical_folder), args.max_pdf_pages)
        print(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as exc:
        print(f"KOSHA GUIDE local snapshot failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
