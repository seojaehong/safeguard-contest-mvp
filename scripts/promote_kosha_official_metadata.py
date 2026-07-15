from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Protocol
from urllib import error, request
from urllib.parse import quote


JsonObject = dict[str, Any]
OFFICIAL_API_URL = "https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList"
OFFICIAL_DOWNLOAD_BASE = "https://portal.kosha.or.kr/openapi/v1/file/down"
DEFAULT_CATEGORIES = ("A", "B", "C", "D", "E")
DEFAULT_EXPECTED_CANDIDATES = 234
DEFAULT_SOURCE_SNAPSHOT_ID = "976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282"


class PromotionError(RuntimeError):
    pass


class PromotionTransport(Protocol):
    def fetch_page(self, category: str, page: int, rows_per_page: int) -> JsonObject: ...

    def fetch_bytes(self, url: str) -> bytes: ...


@dataclass(frozen=True)
class PromotionConfig:
    source_root: Path
    output_root: Path
    categories: tuple[str, ...] = DEFAULT_CATEGORIES
    rows_per_page: int = 100
    expected_candidate_count: int = DEFAULT_EXPECTED_CANDIDATES
    expected_source_snapshot_id: str = DEFAULT_SOURCE_SNAPSHOT_ID
    timeout_seconds: float = 20.0
    retries: int = 1
    reuse_page_cache: bool = False
    cache_max_age_seconds: float = 0.0


@dataclass(frozen=True)
class SourceSnapshot:
    snapshot_id: str
    candidates: list[JsonObject]


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def normalize_identity_value(value: object) -> object:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [normalize_identity_value(item) for item in value]
    if isinstance(value, dict):
        return {
            key: normalize_identity_value(nested)
            for key, nested in value.items()
            if isinstance(key, str)
        }
    return value


def identity_sha256(value: object) -> str:
    return sha256_bytes(canonical_json(normalize_identity_value(value)).encode("utf-8"))


def canonical_jsonl(rows: list[JsonObject]) -> str:
    return "".join(f"{canonical_json(row)}\n" for row in rows)


def read_object(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise PromotionError(f"invalid-object:{path}")
    return value


def resolve_beneath(root: Path, relative: object) -> Path:
    if not isinstance(relative, str) or not relative:
        raise PromotionError("invalid-relative-path")
    target = (root / Path(*relative.replace("\\", "/").split("/"))).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise PromotionError(f"path-escape:{relative}") from exc
    return target


def load_jsonl(path: Path) -> list[JsonObject]:
    rows: list[JsonObject] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").split("\n"), start=1):
        if not line.strip():
            continue
        value = json.loads(line)
        if not isinstance(value, dict):
            raise PromotionError(f"invalid-jsonl-object:{path}:{line_number}")
        rows.append(value)
    return rows


def load_source_snapshot(root: Path, expected_snapshot_id: str) -> SourceSnapshot:
    current = read_object(root / "current.json")
    snapshot_id = current.get("snapshot_id")
    if snapshot_id != expected_snapshot_id:
        raise PromotionError(f"source-snapshot-mismatch:{snapshot_id}")
    manifest_descriptor = current.get("manifest")
    if not isinstance(manifest_descriptor, dict):
        raise PromotionError("source-manifest-descriptor-missing")
    manifest_path = resolve_beneath(root, manifest_descriptor.get("path"))
    manifest_bytes = manifest_path.read_bytes()
    if sha256_bytes(manifest_bytes) != manifest_descriptor.get("sha256"):
        raise PromotionError("source-manifest-hash-mismatch")
    if len(manifest_bytes) != manifest_descriptor.get("size_bytes"):
        raise PromotionError("source-manifest-size-mismatch")
    manifest = read_object(manifest_path)
    if manifest.get("snapshot_id") != expected_snapshot_id:
        raise PromotionError("source-manifest-snapshot-mismatch")
    if manifest.get("reproducibility_hash") != expected_snapshot_id:
        raise PromotionError("source-reproducibility-hash-mismatch")
    source_identity = manifest.get("source_identity")
    if not isinstance(source_identity, dict):
        raise PromotionError("source-identity-missing")
    source_identity_material = {
        key: value for key, value in source_identity.items() if key != "identity_sha256"
    }
    source_identity_sha256 = identity_sha256(source_identity_material)
    if source_identity.get("identity_sha256") != source_identity_sha256:
        raise PromotionError("source-identity-hash-mismatch")
    generation_policy = manifest.get("generation_policy")
    generation_policy_sha256 = manifest.get("generation_policy_sha256")
    if not isinstance(generation_policy, dict) or generation_policy_sha256 != identity_sha256(
        generation_policy
    ):
        raise PromotionError("source-generation-policy-hash-mismatch")
    snapshot_path = resolve_beneath(root, current.get("snapshot_path"))
    if snapshot_path.name != expected_snapshot_id:
        raise PromotionError("source-snapshot-path-mismatch")
    output_hashes = manifest.get("output_hashes")
    if not isinstance(output_hashes, dict):
        raise PromotionError("source-output-hashes-missing")
    required_artifacts = {
        "items.jsonl": "items",
        "chunks.jsonl": "chunks",
        "failures.jsonl": "failures",
    }
    if not required_artifacts.keys() <= output_hashes.keys():
        raise PromotionError("source-required-output-hashes-missing")
    for artifact_name, expected_hash in output_hashes.items():
        if not isinstance(artifact_name, str) or Path(artifact_name).name != artifact_name:
            raise PromotionError("source-output-name-invalid")
        if not isinstance(expected_hash, str):
            raise PromotionError(f"source-output-hash-invalid:{artifact_name}")
        artifact_path = snapshot_path / artifact_name
        error_label = required_artifacts.get(artifact_name, artifact_name)
        if not artifact_path.is_file() or sha256_bytes(artifact_path.read_bytes()) != expected_hash:
            raise PromotionError(f"source-{error_label}-hash-mismatch")
    reproducibility_hash = sha256_bytes(canonical_json({
        "schema_version": manifest.get("schema_version"),
        "source_identity_sha256": source_identity_sha256,
        "generation_policy_sha256": generation_policy_sha256,
        "output_hashes": output_hashes,
    }).encode("utf-8"))
    if reproducibility_hash != expected_snapshot_id:
        raise PromotionError("source-reproducibility-identity-mismatch")
    items_path = snapshot_path / "items.jsonl"
    items = load_jsonl(items_path)
    candidates = [
        item for item in items
        if item.get("item_type") == "technical-support-regulation"
        and item.get("state") == "current-unverified"
        and item.get("extraction_status") == "success"
        and item.get("body_origin") in (None, "native")
    ]
    return SourceSnapshot(snapshot_id=expected_snapshot_id, candidates=candidates)


def normalize_version(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace("–", "-").replace("—", "-").replace("−", "-")
    parts = normalized.split("-")
    if len(parts) < 3 or not parts[-1].isdigit():
        return None
    return "-".join(part.upper() if part.isalpha() else str(int(part)) for part in parts)


def stable_key(version: str) -> str:
    return version.rsplit("-", 1)[0]


def normalize_date(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    digits = "".join(character for character in value if character.isdigit())
    if len(digits) != 8:
        return None
    try:
        return datetime.strptime(digits, "%Y%m%d").date().isoformat()
    except ValueError:
        return None


def normalize_official_row(value: object) -> JsonObject | None:
    if not isinstance(value, dict):
        return None
    version = normalize_version(value.get("techGdlnNo"))
    file_id = value.get("techGdlnOrgnlAtcflNo")
    raw_sequence = value.get("techGdlnOrgnlAtcflNoSeq")
    publication_date = normalize_date(value.get("techGdlnOfancYmd"))
    category = value.get("techGdlnCtgryCd")
    try:
        file_sequence = int(raw_sequence)
    except (TypeError, ValueError):
        return None
    if (
        not version
        or not isinstance(file_id, str)
        or not file_id.strip()
        or file_sequence < 0
        or not publication_date
        or not isinstance(category, str)
        or not category.strip()
    ):
        return None
    official_url = f"{OFFICIAL_DOWNLOAD_BASE}/{quote(file_id.strip(), safe='')}/{file_sequence}"
    return {
        "stable_key": stable_key(version),
        "official_version": version,
        "official_status": "current",
        "official_url": official_url,
        "official_file_id": file_id.strip(),
        "official_file_sequence": file_sequence,
        "publication_date": publication_date,
        "official_category": category.strip().upper(),
    }


def fetch_cached_page(
    config: PromotionConfig,
    transport: PromotionTransport,
    category: str,
    page: int,
) -> tuple[JsonObject, JsonObject]:
    request_identity = {
        "api_url": OFFICIAL_API_URL,
        "category": category,
        "current": True,
        "page": page,
        "rows_per_page": config.rows_per_page,
    }
    cache_key = sha256_bytes(canonical_json(request_identity).encode("utf-8"))
    cache_path = config.output_root / "page-cache" / f"{cache_key}.json"
    if config.reuse_page_cache and cache_path.exists():
        envelope = read_object(cache_path)
        response = envelope.get("response")
        if envelope.get("request") != request_identity or not isinstance(response, dict):
            raise PromotionError(f"page-cache-identity-mismatch:{category}:{page}")
        if envelope.get("response_sha256") != sha256_bytes(canonical_json(response).encode("utf-8")):
            raise PromotionError(f"page-cache-hash-mismatch:{category}:{page}")
        fetched_at = envelope.get("fetched_at")
        try:
            fetched_at_value = datetime.fromisoformat(str(fetched_at))
            if fetched_at_value.tzinfo is None:
                raise ValueError("timezone required")
            cache_deadline = fetched_at_value + timedelta(seconds=config.cache_max_age_seconds)
        except (TypeError, ValueError):
            cache_deadline = datetime.min.replace(tzinfo=timezone.utc)
        if config.cache_max_age_seconds > 0 and datetime.now(timezone.utc) <= cache_deadline:
            return response, {
                "category": category,
                "page": page,
                "request_sha256": cache_key,
                "response_sha256": envelope["response_sha256"],
            }
    response = transport.fetch_page(category, page, config.rows_per_page)
    envelope = {
        "request": request_identity,
        "response": response,
        "response_sha256": sha256_bytes(canonical_json(response).encode("utf-8")),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(canonical_json(envelope), encoding="utf-8", newline="\n")
    return response, {
        "category": category,
        "page": page,
        "request_sha256": cache_key,
        "response_sha256": envelope["response_sha256"],
    }


def collect_current_rows(
    config: PromotionConfig,
    transport: PromotionTransport,
) -> tuple[list[JsonObject], list[JsonObject], list[JsonObject], list[JsonObject]]:
    records: list[JsonObject] = []
    failures: list[JsonObject] = []
    page_shards: list[JsonObject] = []
    category_reconciliations: list[JsonObject] = []
    for category in config.categories:
        try:
            first, first_shard = fetch_cached_page(config, transport, category, 1)
            page_shards.append(first_shard)
        except (OSError, PromotionError) as exc:
            failures.append({
                "code": "official-page-fetch-failed",
                "category": category,
                "page": 1,
                "error_type": type(exc).__name__,
                "message": str(exc),
            })
            continue
        payload = first.get("payload") if first.get("result") == "success" else None
        if not isinstance(payload, dict):
            failures.append({"code": "official-page-invalid", "category": category, "page": 1})
            continue
        total_count = payload.get("totalCount")
        try:
            expected_total_count = int(total_count)
            if expected_total_count < 0:
                raise ValueError("negative totalCount")
            page_count = max(1, math.ceil(expected_total_count / config.rows_per_page))
        except (TypeError, ValueError):
            failures.append({"code": "official-total-invalid", "category": category, "page": 1})
            continue
        raw_row_count = 0
        category_records: list[JsonObject] = []
        for page in range(1, page_count + 1):
            try:
                if page == 1:
                    page_response = first
                else:
                    page_response, page_shard = fetch_cached_page(config, transport, category, page)
                    page_shards.append(page_shard)
            except (OSError, PromotionError) as exc:
                failures.append({
                    "code": "official-page-fetch-failed",
                    "category": category,
                    "page": page,
                    "error_type": type(exc).__name__,
                    "message": str(exc),
                })
                continue
            page_payload = page_response.get("payload") if page_response.get("result") == "success" else None
            page_rows = page_payload.get("list") if isinstance(page_payload, dict) else None
            page_total_count = page_payload.get("totalCount") if isinstance(page_payload, dict) else None
            try:
                page_total_matches = int(page_total_count) == expected_total_count
            except (TypeError, ValueError):
                page_total_matches = False
            if not page_total_matches:
                failures.append({
                    "code": "official-page-total-mismatch",
                    "category": category,
                    "page": page,
                    "expected_total_count": expected_total_count,
                    "page_total_count": page_total_count,
                })
            if not isinstance(page_rows, list) or not page_rows:
                failures.append({"code": "official-page-empty", "category": category, "page": page})
                continue
            raw_row_count += len(page_rows)
            for row in page_rows:
                normalized = normalize_official_row(row)
                if normalized is None:
                    failures.append({"code": "official-row-invalid", "category": category, "page": page})
                elif normalized["official_category"] != category:
                    failures.append({
                        "code": "official-row-category-mismatch",
                        "category": category,
                        "page": page,
                        "row_category": normalized["official_category"],
                        "stable_key": normalized["stable_key"],
                    })
                else:
                    category_records.append(normalized)
                    records.append(normalized)
        normalized_row_count = len(category_records)
        unique_row_count = len({str(row["stable_key"]) for row in category_records})
        duplicate_count = normalized_row_count - unique_row_count
        matches_total_count = not (
            raw_row_count != expected_total_count
            or normalized_row_count != expected_total_count
            or unique_row_count != expected_total_count
        )
        reconciliation = {
            "category": category,
            "expected_total_count": expected_total_count,
            "raw_row_count": raw_row_count,
            "normalized_row_count": normalized_row_count,
            "unique_row_count": unique_row_count,
            "duplicate_count": duplicate_count,
            "matches_total_count": matches_total_count,
        }
        category_reconciliations.append(reconciliation)
        if not matches_total_count:
            failures.append({
                "code": "official-category-count-mismatch",
                **{key: value for key, value in reconciliation.items() if key != "matches_total_count"},
            })
    page_shards.sort(key=lambda shard: (str(shard["category"]), int(shard["page"])))
    category_reconciliations.sort(key=lambda item: str(item["category"]))
    return records, failures, page_shards, category_reconciliations


def write_immutable_snapshot(snapshot_dir: Path, artifacts: dict[str, str]) -> None:
    if snapshot_dir.exists():
        for name, text in artifacts.items():
            path = snapshot_dir / name
            if not path.exists() or path.read_bytes() != text.encode("utf-8"):
                raise PromotionError(f"snapshot-output-mismatch:{name}")
        return
    snapshot_dir.mkdir(parents=True, exist_ok=False)
    for name, text in artifacts.items():
        (snapshot_dir / name).write_text(text, encoding="utf-8", newline="\n")


def run_promotion(config: PromotionConfig, transport: PromotionTransport) -> JsonObject:
    started_at = datetime.now(timezone.utc)
    source = load_source_snapshot(config.source_root, config.expected_source_snapshot_id)
    failures: list[JsonObject] = []
    if len(source.candidates) != config.expected_candidate_count:
        raise PromotionError(f"candidate-count-mismatch:{len(source.candidates)}")
    official_rows, collection_failures, page_shards, category_reconciliations = collect_current_rows(
        config,
        transport,
    )
    failures.extend(collection_failures)
    official_by_key: dict[str, JsonObject] = {}
    for row in official_rows:
        key = str(row["stable_key"])
        if key in official_by_key:
            failures.append({"code": "official-stable-key-duplicate", "stable_key": key})
            continue
        official_by_key[key] = row

    verified: list[JsonObject] = []
    for item in sorted(source.candidates, key=lambda value: str(value.get("stable_key"))):
        key = item.get("stable_key")
        version = item.get("version_key")
        if not isinstance(key, str) or not isinstance(version, str):
            failures.append({"code": "candidate-identity-invalid", "item_id": item.get("item_id")})
            continue
        official = official_by_key.get(key)
        if official is None:
            failures.append({"code": "official-row-missing", "stable_key": key, "version": version})
            continue
        if official["official_version"] != version:
            failures.append({
                "code": "official-version-mismatch",
                "stable_key": key,
                "candidate_version": version,
                "official_version": official["official_version"],
            })
            continue
        try:
            pdf_bytes = transport.fetch_bytes(str(official["official_url"]))
        except (OSError, PromotionError) as exc:
            failures.append({
                "code": "official-download-failed",
                "stable_key": key,
                "error_type": type(exc).__name__,
                "message": str(exc),
            })
            continue
        if not pdf_bytes:
            failures.append({"code": "official-download-empty", "stable_key": key})
            continue
        pdf_sha256 = sha256_bytes(pdf_bytes)
        if pdf_sha256 != item.get("raw_sha256"):
            failures.append({
                "code": "official-pdf-hash-mismatch",
                "stable_key": key,
                "expected_sha256": item.get("raw_sha256"),
                "actual_sha256": pdf_sha256,
            })
            continue
        body = item.get("body")
        body_sha256 = item.get("normalized_text_sha256")
        normalized_body = " ".join(body.split()) if isinstance(body, str) else ""
        if not normalized_body or sha256_bytes(normalized_body.encode("utf-8")) != body_sha256:
            failures.append({"code": "candidate-body-hash-mismatch", "stable_key": key})
            continue
        verified.append({
            **official,
            "pdf_sha256": pdf_sha256,
            "body_sha256": body_sha256,
        })

    verified.sort(key=lambda row: (str(row["stable_key"]), str(row["official_version"])))
    failures.sort(key=canonical_json)
    ledger_text = canonical_jsonl(verified)
    failures_text = canonical_jsonl(failures)
    output_hashes = {
        "official-metadata.jsonl": sha256_bytes(ledger_text.encode("utf-8")),
        "failures.jsonl": sha256_bytes(failures_text.encode("utf-8")),
    }
    collection_hash = sha256_bytes(canonical_json(official_rows).encode("utf-8"))
    generator_sha256 = sha256_bytes(Path(__file__).read_bytes())
    launch_ready = len(verified) == config.expected_candidate_count and not failures
    identity = {
        "generator_source_sha256": generator_sha256,
        "source_snapshot_id": source.snapshot_id,
        "expected_candidate_count": config.expected_candidate_count,
        "categories": list(config.categories),
        "rows_per_page": config.rows_per_page,
        "network_policy": {
            "timeout_seconds": config.timeout_seconds,
            "retries": config.retries,
        },
        "official_collection_sha256": collection_hash,
        "page_shards": page_shards,
        "category_reconciliations": category_reconciliations,
        "output_hashes": output_hashes,
    }
    snapshot_id = sha256_bytes(canonical_json(identity).encode("utf-8"))
    snapshot_path = Path("snapshots") / snapshot_id
    manifest: JsonObject = {
        "schema_version": "safeclaw-kosha-official-metadata-promotion/v1",
        "snapshot_id": snapshot_id,
        "source_snapshot_id": source.snapshot_id,
        "read_only_source": True,
        "db_mutation_performed": False,
        "schema_mutation_performed": False,
        "environment_changed": False,
        "network_calls_performed": True,
        "network_policy": identity["network_policy"],
        "launch_ready": launch_ready,
        "trusted_registry_populated": False,
        "counts": {
            "candidates": len(source.candidates),
            "official_rows": len(official_rows),
            "verified": len(verified),
            "failures": len(failures),
        },
        "identity": identity,
        "reproducibility_hash": snapshot_id,
    }
    manifest_text = canonical_json(manifest)
    write_immutable_snapshot(config.output_root / snapshot_path, {
        "official-metadata.jsonl": ledger_text,
        "failures.jsonl": failures_text,
        "manifest.json": manifest_text,
    })
    current: JsonObject = {
        "schema_version": "safeclaw-kosha-official-metadata-current/v1",
        "snapshot_id": snapshot_id,
        "snapshot_path": snapshot_path.as_posix(),
        "manifest": {
            "path": f"{snapshot_path.as_posix()}/manifest.json",
            "sha256": sha256_bytes(manifest_text.encode("utf-8")),
            "size_bytes": len(manifest_text.encode("utf-8")),
        },
    }
    config.output_root.mkdir(parents=True, exist_ok=True)
    (config.output_root / "current.json").write_text(canonical_json(current), encoding="utf-8", newline="\n")
    elapsed = round((datetime.now(timezone.utc) - started_at).total_seconds(), 3)
    failure_counts: dict[str, int] = {}
    for failure in failures:
        code = str(failure.get("code") or "unknown")
        failure_counts[code] = failure_counts.get(code, 0) + 1
    blockers = [] if launch_ready else [
        "verified-count-incomplete" if len(verified) != config.expected_candidate_count else "",
        "failure-ledger-not-empty" if failures else "",
    ]
    blockers = [blocker for blocker in blockers if blocker]
    report: JsonObject = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_snapshot_id": source.snapshot_id,
        "snapshot_id": snapshot_id,
        "item_count": len(source.candidates),
        "success_count": len(verified),
        "candidate_count": len(source.candidates),
        "official_row_count": len(official_rows),
        "verified_count": len(verified),
        "failure_count": len(failures),
        "failure_counts": failure_counts,
        "blockers": blockers,
        "page_shard_count": len(page_shards),
        "category_reconciliations": category_reconciliations,
        "launch_ready": launch_ready,
        "trusted_registry_populated": False,
        "official_metadata_sha256": output_hashes["official-metadata.jsonl"] if launch_ready else None,
        "output_hashes": output_hashes,
        "elapsed_seconds": elapsed,
    }
    (config.output_root / "report.json").write_text(
        f"{json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
        newline="\n",
    )
    failure_summary = ", ".join(
        f"{code}={count}" for code, count in sorted(failure_counts.items())
    ) or "none"
    category_summary = ", ".join(
        f"{item['category']}={item['unique_row_count']}/{item['expected_total_count']}"
        f" duplicates={item['duplicate_count']}"
        for item in category_reconciliations
    ) or "none"
    markdown = (
        "# KOSHA Official Metadata Promotion\n\n"
        f"- Source snapshot: `{source.snapshot_id}`\n"
        f"- Promotion snapshot: `{snapshot_id}`\n"
        f"- Candidates: `{len(source.candidates)}`\n"
        f"- Official rows collected: `{len(official_rows)}`\n"
        f"- Verified: `{len(verified)}`\n"
        f"- Failures: `{len(failures)}`\n"
        f"- Failure codes: `{failure_summary}`\n"
        f"- Category reconciliation: `{category_summary}`\n"
        f"- Page shards: `{len(page_shards)}`\n"
        f"- Launch ready: `{str(launch_ready).lower()}`\n"
        "- Trusted production registry populated: `false`\n"
        f"- Blockers: `{', '.join(blockers) if blockers else 'none'}`\n"
    )
    (config.output_root / "report.md").write_text(markdown, encoding="utf-8", newline="\n")
    log_lines = [
        f"generated_at={report['generated_at']}",
        f"source_snapshot_id={source.snapshot_id}",
        f"snapshot_id={snapshot_id}",
        f"network_timeout_seconds={config.timeout_seconds}",
        f"network_retries={config.retries}",
        f"candidates={len(source.candidates)}",
        f"official_rows={len(official_rows)}",
        f"verified={len(verified)}",
        f"failures={len(failures)}",
        f"failure_counts={failure_summary}",
        f"category_reconciliation={category_summary}",
        f"page_shards={len(page_shards)}",
        f"launch_ready={str(launch_ready).lower()}",
        "trusted_registry_populated=false",
    ]
    (config.output_root / "promotion.log").write_text(
        f"{'\n'.join(log_lines)}\n",
        encoding="utf-8",
        newline="\n",
    )
    return report


class UrlLibTransport:
    def __init__(self, timeout_seconds: float = 20.0, retries: int = 1) -> None:
        self.timeout_seconds = timeout_seconds
        self.retries = retries

    def _request(self, req: request.Request) -> bytes:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with request.urlopen(req, timeout=self.timeout_seconds) as response:
                    return response.read()
            except (error.HTTPError, error.URLError, TimeoutError) as exc:
                last_error = exc
                retryable = not isinstance(exc, error.HTTPError) or exc.code == 429 or exc.code >= 500
                if not retryable or attempt >= self.retries:
                    break
        raise PromotionError(f"network-request-failed:{last_error}") from last_error

    def fetch_page(self, category: str, page: int, rows_per_page: int) -> JsonObject:
        body = canonical_json({
            "techGdlnCtgryCd": category,
            "techGdlnSttsSeCdIng": "1",
            "techGdlnSttsSeCdDel": "0",
            "startDt": None,
            "endDt": None,
            "searchType": "all",
            "searchVal": None,
            "page": page,
            "rowsPerPage": str(rows_per_page),
        }).encode("utf-8")
        req = request.Request(
            OFFICIAL_API_URL,
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        response_bytes = self._request(req)
        if not response_bytes:
            raise PromotionError("official-response-empty")
        try:
            value = json.loads(response_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PromotionError("official-response-invalid-json") from exc
        if not isinstance(value, dict):
            raise PromotionError("official-response-not-object")
        return value

    def fetch_bytes(self, url: str) -> bytes:
        return self._request(request.Request(url, method="GET"))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a fail-closed KOSHA official metadata promotion artifact.")
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--timeout-seconds", type=float, default=20.0)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--rows-per-page", type=int, default=100)
    parser.add_argument("--reuse-page-cache", action="store_true")
    parser.add_argument("--cache-max-age-seconds", type=float, default=0.0)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        report = run_promotion(
            PromotionConfig(
                source_root=args.source_root,
                output_root=args.output_root,
                rows_per_page=args.rows_per_page,
                timeout_seconds=args.timeout_seconds,
                retries=args.retries,
                reuse_page_cache=args.reuse_page_cache,
                cache_max_age_seconds=args.cache_max_age_seconds,
            ),
            UrlLibTransport(timeout_seconds=args.timeout_seconds, retries=args.retries),
        )
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if report["launch_ready"] else 2
    except (OSError, ValueError, PromotionError) as exc:
        print(f"promote_kosha_official_metadata failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
