from __future__ import annotations

import argparse
import hashlib
import json
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse


JsonObject = dict[str, Any]
SHA256_PATTERN_LENGTH = 64
PINNED_SOURCE_SNAPSHOT_ID = "935340ef3f74078c36168666650164c43511daced84efa3eda849833ad8d6844"
PINNED_SCOPE_ID = "technical-support-regulation-current-native"
PINNED_SELECTION = "technical-support-regulation+current-unverified+success+native"
PINNED_SOURCE_INVENTORY_COUNT = 1040
PINNED_CANDIDATE_COUNT = 234
PINNED_OUT_OF_SCOPE_COUNT = 806
PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256: frozenset[str] = frozenset({
    "1c03af6776158ba21650325ea7b31f2a661d0adea9441d29aacf977e0c815a5f",
})


class SubsetBuildError(RuntimeError):
    pass


@dataclass(frozen=True)
class SourceSnapshot:
    snapshot_id: str
    source_identity_sha256: str
    generation_policy_sha256: str
    items: list[JsonObject]
    chunks: list[JsonObject]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def is_sha256(value: object) -> bool:
    return (
        isinstance(value, str)
        and len(value) == SHA256_PATTERN_LENGTH
        and all(char in "0123456789abcdef" for char in value)
    )


def normalize_body(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    return " ".join(normalized.split())


def read_json(path: Path) -> JsonObject:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SubsetBuildError(f"invalid-json:{path}") from error
    if not isinstance(value, dict):
        raise SubsetBuildError(f"invalid-object:{path}")
    return value


def read_jsonl(path: Path) -> list[JsonObject]:
    try:
        lines = path.read_text(encoding="utf-8").split("\n")
    except OSError as error:
        raise SubsetBuildError(f"read-failed:{path}") from error
    rows: list[JsonObject] = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise SubsetBuildError(f"invalid-jsonl:{path}:{line_number}") from error
        if not isinstance(value, dict):
            raise SubsetBuildError(f"invalid-jsonl-object:{path}:{line_number}")
        rows.append(value)
    return rows


def resolve_relative_path(root: Path, relative_value: object) -> Path:
    if not isinstance(relative_value, str) or not relative_value:
        raise SubsetBuildError("invalid-relative-path")
    normalized = Path(*relative_value.replace("\\", "/").split("/"))
    target = (root / normalized).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as error:
        raise SubsetBuildError(f"path-escape:{relative_value}") from error
    return target


def require_string(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise SubsetBuildError(f"invalid-string:{label}")
    return value


def load_source_snapshot(source_root: Path) -> SourceSnapshot:
    current = read_json(source_root / "current.json")
    manifest_descriptor = current.get("manifest")
    if not isinstance(manifest_descriptor, dict):
        raise SubsetBuildError("invalid-current-manifest")
    manifest_path = resolve_relative_path(source_root, manifest_descriptor.get("path"))
    manifest_bytes = manifest_path.read_bytes()
    if sha256_bytes(manifest_bytes) != manifest_descriptor.get("sha256"):
        raise SubsetBuildError("source-manifest-hash-mismatch")
    if len(manifest_bytes) != manifest_descriptor.get("size_bytes"):
        raise SubsetBuildError("source-manifest-size-mismatch")
    manifest = read_json(manifest_path)
    snapshot_path = resolve_relative_path(source_root, current.get("snapshot_path"))
    output_hashes = manifest.get("output_hashes")
    if not isinstance(output_hashes, dict):
        raise SubsetBuildError("source-output-hashes-missing")
    loaded_rows: dict[str, list[JsonObject]] = {}
    for name in ("items.jsonl", "chunks.jsonl", "failures.jsonl"):
        artifact_path = snapshot_path / name
        artifact_bytes = artifact_path.read_bytes()
        if sha256_bytes(artifact_bytes) != output_hashes.get(name):
            raise SubsetBuildError(f"source-output-hash-mismatch:{name}")
        loaded_rows[name] = read_jsonl(artifact_path)
    snapshot_id = require_string(current.get("snapshot_id"), "snapshot_id")
    if manifest.get("snapshot_id") != snapshot_id:
        raise SubsetBuildError("source-snapshot-id-mismatch")
    source_identity = manifest.get("source_identity")
    if not isinstance(source_identity, dict):
        raise SubsetBuildError("source-identity-missing")
    source_identity_sha256 = require_string(source_identity.get("identity_sha256"), "source_identity_sha256")
    generation_policy_sha256 = require_string(
        manifest.get("generation_policy_sha256"),
        "generation_policy_sha256",
    )
    return SourceSnapshot(
        snapshot_id=snapshot_id,
        source_identity_sha256=source_identity_sha256,
        generation_policy_sha256=generation_policy_sha256,
        items=loaded_rows["items.jsonl"],
        chunks=loaded_rows["chunks.jsonl"],
    )


def official_metadata_index(path: Path | None) -> tuple[dict[str, JsonObject], str | None]:
    if path is None:
        return {}, None
    rows = read_jsonl(path)
    index: dict[str, JsonObject] = {}
    for row in rows:
        stable_key = require_string(row.get("stable_key"), "official.stable_key")
        if stable_key in index:
            raise SubsetBuildError(f"duplicate-official-metadata:{stable_key}")
        index[stable_key] = row
    return index, sha256_bytes(path.read_bytes())


def is_official_url(value: object) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and (hostname == "kosha.or.kr" or hostname.endswith(".kosha.or.kr"))


def is_iso_date(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def candidate_rejection(
    item: JsonObject,
    official: JsonObject | None,
    *,
    metadata_trusted: bool,
) -> str | None:
    body = item.get("body")
    body_hash = item.get("normalized_text_sha256")
    raw_hash = item.get("raw_sha256")
    version = item.get("version_key")
    if item.get("body_origin") not in (None, "native"):
        return "body-not-native"
    if not isinstance(body, str) or not normalize_body(body):
        return "body-empty"
    if not is_sha256(body_hash) or sha256_text(normalize_body(body)) != body_hash:
        return "body-hash-mismatch"
    if not is_sha256(raw_hash):
        return "pdf-hash-missing"
    if official is None:
        return "official-metadata-missing"
    if not metadata_trusted:
        return "official-metadata-untrusted"
    required = (
        is_official_url(official.get("official_url")),
        isinstance(official.get("official_file_id"), str) and bool(official["official_file_id"].strip()),
        is_iso_date(official.get("publication_date")),
        official.get("official_status") == "current",
        isinstance(version, str) and official.get("official_version") == version,
        official.get("pdf_sha256") == raw_hash,
        official.get("body_sha256") == body_hash,
    )
    if not all(required):
        return "official-provenance-incomplete-or-mismatched"
    return None


def is_candidate(item: JsonObject) -> bool:
    return (
        item.get("item_type") == "technical-support-regulation"
        and item.get("state") == "current-unverified"
        and item.get("extraction_status") == "success"
        and item.get("body_origin") in (None, "native")
    )


def jsonl_text(rows: Iterable[JsonObject]) -> str:
    return "".join(
        f"{json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))}\n"
        for row in rows
    )


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def generator_source_sha256() -> str:
    return sha256_bytes(Path(__file__).read_bytes())


def registry_sha256(values: frozenset[str]) -> str:
    canonical = json.dumps(sorted(values), separators=(",", ":"))
    return sha256_text(canonical)


def write_immutable_snapshot(snapshot_dir: Path, artifacts: dict[str, str]) -> None:
    if snapshot_dir.exists():
        for name, expected_text in artifacts.items():
            path = snapshot_dir / name
            try:
                actual_bytes = path.read_bytes()
            except OSError as error:
                raise SubsetBuildError(f"snapshot-output-missing:{name}") from error
            if actual_bytes != expected_text.encode("utf-8"):
                raise SubsetBuildError(f"snapshot-output-mismatch:{name}")
        return
    snapshot_dir.mkdir(parents=True, exist_ok=False)
    for name, text in artifacts.items():
        write_text(snapshot_dir / name, text)


def build_verified_subset(
    *,
    source_root: Path,
    output_root: Path,
    _test_only_official_metadata_path: Path | None = None,
    _test_only_trusted_official_metadata_sha256: frozenset[str] | None = None,
) -> JsonObject:
    started_at = datetime.now(timezone.utc)
    source = load_source_snapshot(source_root)
    metadata, metadata_sha256 = official_metadata_index(_test_only_official_metadata_path)
    trusted_metadata_sha256 = (
        _test_only_trusted_official_metadata_sha256
        if _test_only_trusted_official_metadata_sha256 is not None
        else PRODUCTION_TRUSTED_OFFICIAL_METADATA_SHA256
    )
    if not all(is_sha256(value) for value in trusted_metadata_sha256):
        raise SubsetBuildError("invalid-trusted-metadata-registry")
    metadata_trusted = metadata_sha256 is not None and metadata_sha256 in trusted_metadata_sha256
    chunks_by_item: dict[str, list[JsonObject]] = {}
    for chunk in source.chunks:
        item_id = chunk.get("item_id")
        if not isinstance(item_id, str):
            raise SubsetBuildError("chunk-item-id-missing")
        if not isinstance(chunk.get("text"), str) or sha256_text(chunk["text"]) != chunk.get("chunk_sha256"):
            raise SubsetBuildError(f"chunk-hash-mismatch:{item_id}")
        chunks_by_item.setdefault(item_id, []).append(chunk)

    candidates = [item for item in source.items if is_candidate(item)]
    if (
        source.snapshot_id != PINNED_SOURCE_SNAPSHOT_ID
        or len(source.items) != PINNED_SOURCE_INVENTORY_COUNT
        or len(candidates) != PINNED_CANDIDATE_COUNT
        or len(source.items) - len(candidates) != PINNED_OUT_OF_SCOPE_COUNT
    ):
        raise SubsetBuildError("source-contract-mismatch")
    accepted: list[JsonObject] = []
    accepted_ids: set[str] = set()
    rejects: list[JsonObject] = []
    for item in candidates:
        item_id = require_string(item.get("item_id"), "item_id")
        stable_key = require_string(item.get("stable_key"), f"stable_key:{item_id}")
        official = metadata.get(stable_key)
        rejection = candidate_rejection(item, official, metadata_trusted=metadata_trusted)
        if rejection is not None:
            rejects.append({
                "schema_version": "safeclaw-kosha-body-corpus/v2",
                "item_id": item_id,
                "source_key": str(item.get("source_key") or "unknown"),
                "source_zip": item.get("source_zip"),
                "source_member": str(item.get("source_member") or item_id),
                "raw_sha256": item.get("raw_sha256"),
                "error_code": rejection,
                "error_type": "verified-subset-rejection",
                "message": f"Rejected from verified subset: {rejection}",
            })
            continue
        if official is None:
            raise SubsetBuildError(f"unreachable-metadata:{item_id}")
        accepted_item = dict(item)
        accepted_item["state"] = "current"
        accepted_item["version_lineage"] = {
            "state": "current",
            "official_version_key": official["official_version"],
            "local_version_key": item["version_key"],
        }
        accepted_item["official_provenance"] = {
            "official_url": official["official_url"],
            "official_file_id": official["official_file_id"],
            "publication_date": official["publication_date"],
            "official_version": official["official_version"],
            "official_status": "current",
            "pdf_sha256": official["pdf_sha256"],
            "body_sha256": official["body_sha256"],
        }
        accepted.append(accepted_item)
        accepted_ids.add(item_id)

    accepted_chunks = [
        chunk
        for item_id in sorted(accepted_ids)
        for chunk in chunks_by_item.get(item_id, [])
    ]
    for item_id in accepted_ids:
        if not chunks_by_item.get(item_id):
            raise SubsetBuildError(f"accepted-item-without-chunks:{item_id}")

    items_text = jsonl_text(accepted)
    chunks_text = jsonl_text(accepted_chunks)
    failures_text = jsonl_text(rejects)
    output_hashes = {
        "items.jsonl": sha256_text(items_text),
        "chunks.jsonl": sha256_text(chunks_text),
        "failures.jsonl": sha256_text(failures_text),
    }
    source_inventory_count = len(source.items)
    candidate_count = len(candidates)
    accepted_count = len(accepted)
    rejected_count = len(rejects)
    out_of_scope_count = source_inventory_count - candidate_count
    complete = accepted_count == candidate_count and rejected_count == 0
    launch_ready = complete and accepted_count > 0
    blockers: list[str] = []
    if accepted_count == 0:
        blockers.append("verified-subset-empty")
    if rejected_count > 0:
        blockers.append("failure-ledger-not-empty")
    if not complete:
        blockers.append("partial-coverage")
    if metadata_sha256 is None:
        blockers.append("official-metadata-artifact-missing")
    elif not metadata_trusted:
        blockers.append("official-metadata-untrusted")

    generator_sha256 = generator_source_sha256()
    trusted_registry_sha256 = registry_sha256(trusted_metadata_sha256)
    generation_policy = {
        "schema_version": "safeclaw-kosha-verified-subset-policy/v1",
        "source_snapshot_id": source.snapshot_id,
        "official_metadata_sha256": metadata_sha256,
        "trusted_metadata_registry_sha256": trusted_registry_sha256,
        "generator_source_sha256": generator_sha256,
        "selection": PINNED_SELECTION,
        "required_provenance": [
            "official_url",
            "official_file_id",
            "publication_date",
            "official_version",
            "official_status=current",
            "pdf_sha256",
            "body_sha256",
        ],
    }
    generation_policy_sha256 = sha256_text(
        json.dumps(generation_policy, sort_keys=True, separators=(",", ":"))
    )
    identity_payload = {
        "generator_source_sha256": generator_sha256,
        "generation_policy_sha256": generation_policy_sha256,
        "source_snapshot_id": source.snapshot_id,
        "source_identity_sha256": source.source_identity_sha256,
        "trusted_metadata_registry_sha256": trusted_registry_sha256,
        "official_metadata_sha256": metadata_sha256,
        "output_hashes": output_hashes,
    }
    snapshot_id = sha256_text(json.dumps(identity_payload, sort_keys=True, separators=(",", ":")))
    snapshot_path = Path("snapshots") / snapshot_id
    snapshot_dir = output_root / snapshot_path
    manifest: JsonObject = {
        "schema_version": "safeclaw-kosha-verified-subset/v1",
        "snapshot_id": snapshot_id,
        "read_only_source": True,
        "offline": True,
        "db_mutation_performed": False,
        "network_calls_performed": False,
        "ocr_performed": False,
        "source_identity": {
            "identity_sha256": source.source_identity_sha256,
            "parent_snapshot_id": source.snapshot_id,
        },
        "generation_policy": generation_policy,
        "generation_policy_sha256": generation_policy_sha256,
        "launch_gate": {
            "launch_ready": launch_ready,
            "failure_count": rejected_count,
            "partial_coverage": not complete,
            "provenance_complete": complete and accepted_count > 0,
            "blockers": blockers,
        },
        "coverage_scope": {
            "scope_id": PINNED_SCOPE_ID,
            "source_inventory_count": source_inventory_count,
            "candidate_count": candidate_count,
            "accepted_count": accepted_count,
            "rejected_count": rejected_count,
            "out_of_scope_count": out_of_scope_count,
            "item_types": ["technical-support-regulation"],
            "official_statuses": ["current"],
            "body_kinds": ["native"],
            "complete": complete,
        },
        "counts": {
            "inventory": candidate_count,
            "completed": candidate_count,
            "success": accepted_count,
            "boundary": 0,
            "failure": rejected_count,
            "chunks": len(accepted_chunks),
            "ocr_candidate_items": 0,
            "ocr_candidate_pages": 0,
            "raw_duplicate_rows": 0,
            "text_duplicate_rows": 0,
            "failure_ledger": rejected_count,
        },
        "output_hashes": output_hashes,
        "reproducibility": {
            "algorithm": "sha256",
            "canonical_source": "source snapshot, official metadata, coverage scope, and output hashes",
            "authoritative_field": "manifest.json#/reproducibility_hash",
        },
        "reproducibility_hash": snapshot_id,
    }
    manifest_text = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    write_immutable_snapshot(snapshot_dir, {
        "items.jsonl": items_text,
        "chunks.jsonl": chunks_text,
        "failures.jsonl": failures_text,
        "manifest.json": manifest_text,
    })
    current: JsonObject = {
        "schema_version": "safeclaw-kosha-body-current/v1",
        "snapshot_path": snapshot_path.as_posix(),
        "snapshot_id": snapshot_id,
        "source_identity_sha256": source.source_identity_sha256,
        "generation_policy_sha256": generation_policy_sha256,
        "reproducibility_hash": snapshot_id,
        "manifest": {
            "path": f"{snapshot_path.as_posix()}/manifest.json",
            "size_bytes": len(manifest_text.encode("utf-8")),
            "sha256": sha256_text(manifest_text),
        },
    }
    write_text(output_root / "current.json", json.dumps(current, sort_keys=True, separators=(",", ":")))
    elapsed_seconds = round((datetime.now(timezone.utc) - started_at).total_seconds(), 3)
    return {
        "source_snapshot_id": source.snapshot_id,
        "subset_snapshot_id": snapshot_id,
        "source_inventory_count": source_inventory_count,
        "candidate_count": candidate_count,
        "accepted_count": accepted_count,
        "rejected_count": rejected_count,
        "out_of_scope_count": out_of_scope_count,
        "launch_ready": launch_ready,
        "blockers": blockers,
        "official_metadata_sha256": metadata_sha256,
        "output_hashes": output_hashes,
        "elapsed_seconds": elapsed_seconds,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an immutable fail-closed KOSHA verified subset.",
    )
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--official-metadata", type=Path)
    parser.add_argument("--report", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = build_verified_subset(
            source_root=args.source_root,
            output_root=args.output_root,
            _test_only_official_metadata_path=args.official_metadata,
        )
        report_text = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
        if args.report is not None:
            write_text(args.report, report_text)
        print(report_text)
        return 0
    except (OSError, SubsetBuildError) as error:
        print(f"build_kosha_verified_subset failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
