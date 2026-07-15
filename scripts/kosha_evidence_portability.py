from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import uuid
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable
from urllib import error, request
from urllib.parse import urlsplit


JsonObject = dict[str, object]
FetchBytes = Callable[[str], bytes]
SCHEMA_VERSION = "safeclaw-kosha-evidence-portability/v1"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_RETRIES = 1
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
WINDOWS_ABSOLUTE_PATH_PATTERN = re.compile(r"^[A-Za-z]:[\\/]")
OFFICIAL_KOSHA_HOSTS = frozenset({"portal.kosha.or.kr"})


class PortabilityError(RuntimeError):
    pass


def _validate_official_refetch_url(url: object) -> str:
    if not isinstance(url, str) or not url:
        raise PortabilityError("official-refetch-url-forbidden")
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as exc:
        raise PortabilityError("official-refetch-url-forbidden") from exc
    if (
        parsed.scheme != "https"
        or parsed.hostname not in OFFICIAL_KOSHA_HOSTS
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
    ):
        raise PortabilityError("official-refetch-url-forbidden")
    return url


class _OfficialRedirectHandler(request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: request.Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> request.Request | None:
        _validate_official_refetch_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _require_sha256(value: object, label: str) -> str:
    if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
        raise PortabilityError(f"{label}-invalid")
    return value


def _record_identity(record: JsonObject) -> JsonObject:
    return {key: value for key, value in record.items() if key != "stable_id"}


def _stable_id(record: JsonObject) -> str:
    digest = sha256_bytes(canonical_json(_record_identity(record)).encode("utf-8"))
    return f"kosha-evidence-sha256:{digest}"


def _ledger_payload(ledger: JsonObject) -> JsonObject:
    return {key: value for key, value in ledger.items() if key != "ledger_sha256"}


def _ledger_sha256(ledger: JsonObject) -> str:
    return sha256_bytes(canonical_json(_ledger_payload(ledger)).encode("utf-8"))


def _validate_relative_locator(value: object, expected_sha256: str) -> str:
    if not isinstance(value, str) or not value:
        raise PortabilityError("relative-locator-invalid")
    locator = PurePosixPath(value)
    expected = PurePosixPath("blobs") / "sha256" / expected_sha256
    if locator.is_absolute() or ".." in locator.parts or locator != expected:
        raise PortabilityError("relative-locator-invalid")
    return locator.as_posix()


def _iter_strings(value: object) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _iter_strings(item)


def _validate_no_absolute_paths(ledger: JsonObject) -> None:
    for value in _iter_strings(ledger):
        if value.startswith(("https://", "http://")):
            continue
        if WINDOWS_ABSOLUTE_PATH_PATTERN.match(value) or value.startswith(("/", "\\\\")):
            raise PortabilityError("absolute-path-forbidden")


def create_ledger(records: list[JsonObject], canonical_identity: JsonObject) -> JsonObject:
    normalized_records: list[JsonObject] = []
    for source in records:
        expected_sha256 = _require_sha256(source.get("expected_sha256"), "expected-sha256")
        source_zip_sha256 = _require_sha256(
            source.get("source_zip_sha256"), "source-zip-sha256"
        )
        required_strings = (
            "stable_key",
            "version",
            "source_zip",
            "source_member",
            "official_url",
        )
        if any(not isinstance(source.get(key), str) or not source.get(key) for key in required_strings):
            raise PortabilityError("record-required-field-missing")
        record: JsonObject = {
            "stable_key": source["stable_key"],
            "version": source["version"],
            "relative_locator": f"blobs/sha256/{expected_sha256}",
            "official_url": source["official_url"],
            "expected_sha256": expected_sha256,
            "source_zip": source["source_zip"],
            "source_zip_sha256": source_zip_sha256,
            "source_member": source["source_member"],
        }
        record["stable_id"] = _stable_id(record)
        normalized_records.append(record)
    normalized_records.sort(key=lambda row: str(row["stable_key"]))
    ledger: JsonObject = {
        "schema_version": SCHEMA_VERSION,
        "bundle_layout": "sha256-blobs/v1",
        "record_count": len(normalized_records),
        "canonical_identity": canonical_identity,
        "records": normalized_records,
    }
    ledger["ledger_sha256"] = _ledger_sha256(ledger)
    validate_ledger(ledger)
    return ledger


def validate_ledger(ledger: JsonObject) -> JsonObject:
    if ledger.get("schema_version") != SCHEMA_VERSION:
        raise PortabilityError("ledger-schema-version-invalid")
    if ledger.get("bundle_layout") != "sha256-blobs/v1":
        raise PortabilityError("bundle-layout-invalid")
    records = ledger.get("records")
    if not isinstance(records, list) or ledger.get("record_count") != len(records):
        raise PortabilityError("ledger-record-count-mismatch")
    expected_ledger_sha256 = _require_sha256(ledger.get("ledger_sha256"), "ledger-sha256")
    canonical_identity = ledger.get("canonical_identity")
    if not isinstance(canonical_identity, dict):
        raise PortabilityError("canonical-identity-missing")
    for name in ("corpus", "promotion"):
        identity = canonical_identity.get(name)
        if not isinstance(identity, dict):
            raise PortabilityError(f"{name}-identity-missing")
        _require_sha256(identity.get("snapshot_id"), f"{name}-snapshot-id")
        _require_sha256(identity.get("manifest_sha256"), f"{name}-manifest-sha256")
    seen_stable_ids: set[str] = set()
    seen_stable_keys: set[str] = set()
    for value in records:
        if not isinstance(value, dict):
            raise PortabilityError("ledger-record-invalid")
        expected_sha256 = _require_sha256(value.get("expected_sha256"), "expected-sha256")
        _require_sha256(value.get("source_zip_sha256"), "source-zip-sha256")
        _validate_relative_locator(value.get("relative_locator"), expected_sha256)
        stable_id = value.get("stable_id")
        if stable_id != _stable_id(value):
            raise PortabilityError("stable-id-mismatch")
        stable_key = value.get("stable_key")
        if not isinstance(stable_id, str) or stable_id in seen_stable_ids:
            raise PortabilityError("stable-id-duplicate")
        if not isinstance(stable_key, str) or stable_key in seen_stable_keys:
            raise PortabilityError("stable-key-duplicate")
        seen_stable_ids.add(stable_id)
        seen_stable_keys.add(stable_key)
    _validate_no_absolute_paths(ledger)
    if _ledger_sha256(ledger) != expected_ledger_sha256:
        raise PortabilityError("ledger-sha256-mismatch")
    return ledger


def load_ledger(path: Path) -> JsonObject:
    if not path.is_file():
        raise PortabilityError(f"ledger-missing:{path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PortabilityError(f"ledger-unreadable:{type(exc).__name__}") from exc
    if not isinstance(value, dict):
        raise PortabilityError("ledger-object-required")
    return validate_ledger(value)


def _resolve_blob(bundle_root: Path, locator: object, expected_sha256: str) -> Path:
    relative_locator = _validate_relative_locator(locator, expected_sha256)
    root = bundle_root.resolve()
    target = (root / Path(*PurePosixPath(relative_locator).parts)).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise PortabilityError("relative-locator-escape") from exc
    return target


def verify_ledger_bundle(ledger_path: Path, bundle_root: Path) -> JsonObject:
    ledger = load_ledger(ledger_path)
    if not bundle_root.is_dir():
        raise PortabilityError(f"bundle-root-missing:{bundle_root}")
    verified = 0
    records = ledger["records"]
    if not isinstance(records, list):
        raise PortabilityError("ledger-records-invalid")
    for record in records:
        if not isinstance(record, dict):
            raise PortabilityError("ledger-record-invalid")
        expected_sha256 = str(record["expected_sha256"])
        blob_path = _resolve_blob(bundle_root, record.get("relative_locator"), expected_sha256)
        if not blob_path.is_file():
            raise PortabilityError(f"bundle-blob-missing:{record.get('stable_key')}")
        actual_sha256 = sha256_file(blob_path)
        if actual_sha256 != expected_sha256:
            raise PortabilityError(f"blob-hash-mismatch:{record.get('stable_key')}")
        verified += 1
    return {
        "valid": True,
        "ledger_sha256": ledger["ledger_sha256"],
        "record_count": len(records),
        "verified_blob_count": verified,
        "failure_count": 0,
    }


def _atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{uuid.uuid4().hex[:8]}.tmp")
    try:
        with source.open("rb") as input_file, temporary.open("xb") as output_file:
            shutil.copyfileobj(input_file, output_file, length=1024 * 1024)
            output_file.flush()
            os.fsync(output_file.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def _atomic_write_bytes(destination: Path, payload: bytes) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f".{uuid.uuid4().hex[:8]}.tmp")
    try:
        with temporary.open("xb") as output_file:
            output_file.write(payload)
            output_file.flush()
            os.fsync(output_file.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink()


class OfficialFetcher:
    def __init__(
        self,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        retries: int = DEFAULT_RETRIES,
    ) -> None:
        if timeout_seconds <= 0 or retries < 0:
            raise ValueError("official fetch policy must be bounded and non-negative")
        self.timeout_seconds = timeout_seconds
        self.retries = retries

    def fetch(self, url: str) -> bytes:
        safe_url = _validate_official_refetch_url(url)
        opener = request.build_opener(_OfficialRedirectHandler())
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                with opener.open(
                    request.Request(safe_url, method="GET"), timeout=self.timeout_seconds
                ) as response:
                    return response.read()
            except (error.HTTPError, error.URLError, TimeoutError) as exc:
                last_error = exc
                retryable = not isinstance(exc, error.HTTPError) or exc.code == 429 or exc.code >= 500
                if not retryable or attempt >= self.retries:
                    break
        raise PortabilityError(f"official-refetch-failed:{last_error}") from last_error


def rehydrate_bundle(
    ledger_path: Path,
    source_bundle_root: Path,
    output_bundle_root: Path,
    *,
    allow_official_refetch: bool = False,
    fetch_bytes: FetchBytes | None = None,
) -> JsonObject:
    ledger = load_ledger(ledger_path)
    source_available = source_bundle_root.is_dir()
    if not source_available and not allow_official_refetch:
        raise PortabilityError(f"bundle-root-missing:{source_bundle_root}")
    if output_bundle_root.exists() and any(output_bundle_root.iterdir()):
        raise PortabilityError(f"output-bundle-not-empty:{output_bundle_root}")
    fetch = fetch_bytes or OfficialFetcher().fetch
    copied_count = 0
    refetched_count = 0
    records = ledger["records"]
    if not isinstance(records, list):
        raise PortabilityError("ledger-records-invalid")
    for record in records:
        if not isinstance(record, dict):
            raise PortabilityError("ledger-record-invalid")
        expected_sha256 = str(record["expected_sha256"])
        destination = _resolve_blob(
            output_bundle_root, record.get("relative_locator"), expected_sha256
        )
        source = _resolve_blob(
            source_bundle_root, record.get("relative_locator"), expected_sha256
        )
        if source_available and source.is_file():
            if sha256_file(source) != expected_sha256:
                raise PortabilityError(f"blob-hash-mismatch:{record.get('stable_key')}")
            _atomic_copy(source, destination)
            copied_count += 1
        elif allow_official_refetch:
            official_url = _validate_official_refetch_url(record.get("official_url"))
            payload = fetch(official_url)
            if sha256_bytes(payload) != expected_sha256:
                raise PortabilityError(f"official-refetch-hash-mismatch:{record.get('stable_key')}")
            _atomic_write_bytes(destination, payload)
            refetched_count += 1
        else:
            raise PortabilityError(f"bundle-blob-missing:{record.get('stable_key')}")
    verification = verify_ledger_bundle(ledger_path, output_bundle_root)
    return {
        **verification,
        "copied_count": copied_count,
        "refetched_count": refetched_count,
        "network_policy": {
            "timeout_seconds": DEFAULT_TIMEOUT_SECONDS,
            "retries": DEFAULT_RETRIES,
        },
    }
