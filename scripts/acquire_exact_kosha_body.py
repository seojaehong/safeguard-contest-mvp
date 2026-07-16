from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Callable
from urllib import error, request
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import snapshot_kosha_guide_corpus


TARGET_STABLE_KEY = "D-C-7"
TARGET_VERSION = "D-C-7-2026"
TARGET_TITLE = "D-C-7-2026 비계 구조 및 안전작업에 관한 기술지원규정"
TARGET_ITEM_ID = "technical-support-01-0073-d-c-7-2026-비계-구조-및-안전작업에-관한-기술지원규정"
PINNED_LEDGER_SHA256 = "b2ade4323cddecc0a50dab98f944f0781dc09885c8bdece4c1a6c0ea2010d0ef"
PINNED_PDF_SHA256 = "5059f9faefe6f5e1a81fb750a3a96e842508b38c1b420bbda935b698aa864ff3"
PINNED_NORMALIZED_BODY_SHA256 = "97c58f2c39260e9e763bae54748466f0837064ddccfc8e29b77d857c9f390112"
OFFICIAL_HOST = "portal.kosha.or.kr"
DEFAULT_TIMEOUT_SECONDS = 20.0
DEFAULT_RETRIES = 1

JsonObject = dict[str, object]
FetchBytes = Callable[[str], bytes]
ReplaceFile = Callable[[Path, Path], None]
RestoreWrite = Callable[[Path, bytes], None]
PrepareHook = Callable[[str], None]


class AcquisitionError(RuntimeError):
    pass


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _ledger_sha256(ledger: JsonObject) -> str:
    payload = {key: value for key, value in ledger.items() if key != "ledger_sha256"}
    return _sha256_bytes(_canonical_json(payload).encode("utf-8"))


def _write_json(path: Path, value: object) -> None:
    snapshot_kosha_guide_corpus._write_json(path, value)


def _write_bytes(path: Path, value: bytes) -> None:
    snapshot_kosha_guide_corpus._atomic_write_bytes(path, value)


def _validate_official_url(value: object) -> str:
    if not isinstance(value, str):
        raise AcquisitionError("official-url-invalid")
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise AcquisitionError("official-url-invalid") from exc
    if (
        parsed.scheme != "https"
        or parsed.hostname != OFFICIAL_HOST
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
        or not parsed.path.startswith("/openapi/v1/file/down/")
    ):
        raise AcquisitionError("official-url-invalid")
    return value


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
        _validate_official_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_official_pdf(
    url: str,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    retries: int = DEFAULT_RETRIES,
) -> bytes:
    safe_url = _validate_official_url(url)
    opener = request.build_opener(_OfficialRedirectHandler())
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            with opener.open(
                request.Request(safe_url, method="GET"), timeout=timeout_seconds
            ) as response:
                return response.read()
        except (error.HTTPError, error.URLError, TimeoutError) as exc:
            last_error = exc
            retryable = not isinstance(exc, error.HTTPError) or exc.code == 429 or exc.code >= 500
            if not retryable or attempt >= retries:
                break
    raise AcquisitionError(f"official-download-failed:{last_error}") from last_error


def load_target_record(
    ledger_path: Path,
    expected_ledger_sha256: str = PINNED_LEDGER_SHA256,
) -> tuple[JsonObject, str]:
    ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    if not isinstance(ledger, dict):
        raise AcquisitionError("ledger-invalid")
    actual_ledger_sha256 = _ledger_sha256(ledger)
    if ledger.get("ledger_sha256") != actual_ledger_sha256:
        raise AcquisitionError("ledger-self-hash-mismatch")
    if actual_ledger_sha256 != expected_ledger_sha256:
        raise AcquisitionError("ledger-pin-mismatch")
    records = ledger.get("records")
    if not isinstance(records, list):
        raise AcquisitionError("ledger-records-invalid")
    matches = [record for record in records if isinstance(record, dict) and record.get("stable_key") == TARGET_STABLE_KEY]
    if len(matches) != 1:
        raise AcquisitionError(f"target-record-count:{len(matches)}")
    record = matches[0]
    expected_fields = {
        "version": TARGET_VERSION,
        "source_member": f"{TARGET_TITLE}.pdf",
    }
    for field, expected in expected_fields.items():
        if record.get(field) != expected:
            raise AcquisitionError(f"target-{field}-mismatch")
    expected_pdf_sha256 = record.get("expected_sha256")
    if not isinstance(expected_pdf_sha256, str) or re.fullmatch(r"[0-9a-f]{64}", expected_pdf_sha256) is None:
        raise AcquisitionError("target-sha256-invalid")
    if expected_pdf_sha256 != PINNED_PDF_SHA256:
        raise AcquisitionError("target-sha256-pin-mismatch")
    _validate_official_url(record.get("official_url"))
    return record, actual_ledger_sha256


def _extract_asset(record: JsonObject, pdf_bytes: bytes, ledger_sha256: str) -> tuple[JsonObject, JsonObject]:
    expected_pdf_sha256 = str(record["expected_sha256"])
    actual_pdf_sha256 = _sha256_bytes(pdf_bytes)
    if actual_pdf_sha256 != expected_pdf_sha256:
        raise AcquisitionError(f"pdf-sha256-mismatch:{actual_pdf_sha256}")
    member_name = str(record["source_member"])
    entry = snapshot_kosha_guide_corpus.LocalPdfEntry(
        archive_path=None,
        archive_name=str(record["source_zip"]),
        member_name=member_name,
        category="건설안전분야",
        file_size=len(pdf_bytes),
        compressed_size=len(pdf_bytes),
        crc32=None,
    )
    provenance = {
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
        code = failure.get("error_code") if isinstance(failure, dict) else item.get("extraction_status")
        raise AcquisitionError(f"extractor-rejected:{code}")
    if item.get("version_key") != TARGET_VERSION or item.get("stable_key") != TARGET_STABLE_KEY:
        raise AcquisitionError("extracted-version-identity-mismatch")
    if item.get("title") != TARGET_TITLE:
        raise AcquisitionError("extracted-title-identity-mismatch")
    raw_body = item.get("body")
    if not isinstance(raw_body, str):
        raise AcquisitionError("extracted-body-missing")
    body = snapshot_kosha_guide_corpus._normalized_for_hash(raw_body)
    compact_identity = re.sub(r"[^A-Z0-9]", "", body.upper())
    if "KOSHAGUIDEDC72026" not in compact_identity:
        raise AcquisitionError("pdf-internal-identity-mismatch")
    body_sha256 = _sha256_bytes(body.encode("utf-8"))
    if body_sha256 != PINNED_NORMALIZED_BODY_SHA256:
        raise AcquisitionError(f"normalized-body-sha256-mismatch:{body_sha256}")
    official_url = str(record["official_url"])
    official_file_id = urlsplit(official_url).path.split("/")[-2]
    asset: JsonObject = {
        "schemaVersion": "safeclaw-exact-kosha-reference/v1",
        "itemId": TARGET_ITEM_ID,
        "sourceId": "kosha-technical-support-regulations-2025",
        "itemType": "technical-support-regulation",
        "category": "건설안전분야",
        "title": TARGET_TITLE,
        "stableDocumentKey": TARGET_STABLE_KEY,
        "version": TARGET_VERSION,
        "normalizedCharCount": len(body),
        "bodySha256": body_sha256,
        "pdfSha256": actual_pdf_sha256,
        "officialUrl": official_url,
        "officialFileId": official_file_id,
        "extractionSchema": snapshot_kosha_guide_corpus.CORPUS_SCHEMA_VERSION,
        "extractorVersion": snapshot_kosha_guide_corpus.EXTRACTOR_VERSION,
        "extractorDependency": f"pypdf=={snapshot_kosha_guide_corpus.PYPDF_VERSION}",
        "portabilityLedgerSha256": ledger_sha256,
        "body": body,
    }
    receipt: JsonObject = {
        "schemaVersion": "safeclaw-exact-kosha-acquisition-receipt/v1",
        "status": "verified",
        "promoted": True,
        "target": TARGET_VERSION,
        "checks": {
            "ledgerCanonicalSha256": True,
            "ledgerPinnedSha256": True,
            "singleTargetRecord": True,
            "officialUrlPolicy": True,
            "downloadedPdfSha256": True,
            "extractedVersionIdentity": True,
            "extractedTitleIdentity": True,
            "pdfInternalIdentity": True,
            "nativeBodyNonEmpty": True,
            "normalizedBodySha256Pinned": True,
            "promotionPairStaged": True,
            "partialPublishRollback": True,
            "portableTargetIdentityBound": True,
            "backupHashesValidatedBeforeRestore": True,
            "immutableBackupsUntilCompletion": True,
            "restoreRecoveryIdempotent": True,
            "durableCompletionRequired": True,
            "prepublishStagingIsolated": True,
            "preparedJournalAtomicActivation": True,
            "prejournalOrphanConvergence": True,
            "activeJournalRevalidatedBeforePublish": True,
        },
        "portabilityLedgerSha256": ledger_sha256,
        "sourceRecord": {
            "stableId": record.get("stable_id"),
            "sourceZip": record["source_zip"],
            "sourceZipSha256": record.get("source_zip_sha256"),
            "sourceMember": record["source_member"],
            "expectedPdfSha256": expected_pdf_sha256,
        },
        "officialUrl": official_url,
        "pdfSha256": actual_pdf_sha256,
        "pdfSizeBytes": len(pdf_bytes),
        "pageCount": item["page_count"],
        "normalizedCharCount": len(body),
        "bodySha256": body_sha256,
        "extractorVersion": snapshot_kosha_guide_corpus.EXTRACTOR_VERSION,
        "extractorDependency": f"pypdf=={snapshot_kosha_guide_corpus.PYPDF_VERSION}",
        "promotionProtocol": "recoverable-staged-pair/v3",
        "dbMutationPerformed": False,
        "schemaMutationPerformed": False,
        "pdfCommitted": False,
    }
    return asset, receipt


def _transaction_dir(failure_path: Path) -> Path:
    return failure_path.parent / ".d-c-7-promotion-transaction"


def _staging_dir(failure_path: Path) -> Path:
    return failure_path.parent / ".d-c-7-promotion-staging"


def _noop_prepare_hook(phase: str) -> None:
    del phase


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def _absolute_lexical_path(path: Path) -> Path:
    return Path(os.path.abspath(os.fspath(path)))


def _is_symlink_or_junction(path: Path) -> bool:
    if path.is_symlink():
        return True
    is_junction = getattr(path, "is_junction", None)
    return bool(callable(is_junction) and is_junction())


def _first_link_component(path: Path) -> Path | None:
    absolute = _absolute_lexical_path(path)
    for candidate in reversed((absolute, *absolute.parents)):
        if _is_symlink_or_junction(candidate):
            return candidate
    return None


def _path_is_within(path: Path, parent: Path) -> bool:
    normalized_path = os.path.normcase(os.fspath(_absolute_lexical_path(path)))
    normalized_parent = os.path.normcase(os.fspath(_absolute_lexical_path(parent)))
    try:
        return os.path.commonpath((normalized_path, normalized_parent)) == normalized_parent
    except ValueError:
        return False


def _validate_promotion_paths(
    ledger_path: Path,
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
) -> None:
    paths = {
        "ledger": ledger_path,
        "asset": asset_path,
        "receipt": receipt_path,
        "failure": failure_path,
    }
    identities: dict[str, str] = {}
    for name, path in paths.items():
        identity = os.path.normcase(os.fspath(_absolute_lexical_path(path)))
        if identity in identities.values():
            raise AcquisitionError(f"promotion-output-path-alias:{name}")
        identities[name] = identity

    managed_directories = (_transaction_dir(failure_path), _staging_dir(failure_path))
    for name, path in paths.items():
        for managed_directory in managed_directories:
            if _path_is_within(path, managed_directory):
                raise AcquisitionError(f"promotion-output-inside-managed-directory:{name}")

    for name in ("asset", "receipt", "failure"):
        link_component = _first_link_component(paths[name])
        if link_component is not None:
            raise AcquisitionError(f"promotion-output-symlink:{name}")
    for managed_directory in managed_directories:
        link_component = _first_link_component(managed_directory)
        if link_component is not None:
            raise AcquisitionError("promotion-managed-directory-symlink")


def _fsync_directory(path: Path) -> None:
    directory = _absolute_lexical_path(path)
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        create_file = kernel32.CreateFileW
        create_file.argtypes = (
            wintypes.LPCWSTR,
            wintypes.DWORD,
            wintypes.DWORD,
            wintypes.LPVOID,
            wintypes.DWORD,
            wintypes.DWORD,
            wintypes.HANDLE,
        )
        create_file.restype = wintypes.HANDLE
        generic_write = 0x40000000
        share_all = 0x00000001 | 0x00000002 | 0x00000004
        open_existing = 3
        backup_semantics = 0x02000000
        invalid_handle = ctypes.c_void_p(-1).value
        handle = create_file(
            str(directory),
            generic_write,
            share_all,
            None,
            open_existing,
            backup_semantics,
            None,
        )
        if handle == invalid_handle:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            if kernel32.FlushFileBuffers(handle) == 0:
                raise ctypes.WinError(ctypes.get_last_error())
        finally:
            kernel32.CloseHandle(handle)
        return

    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    descriptor = os.open(directory, flags)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _portable_target_identity(
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
) -> JsonObject:
    resolved = {
        "asset": _absolute_lexical_path(asset_path),
        "receipt": _absolute_lexical_path(receipt_path),
        "failure": _absolute_lexical_path(failure_path),
    }
    common_root = Path(os.path.commonpath([str(path) for path in resolved.values()]))
    paths = {
        name: path.relative_to(common_root).as_posix()
        for name, path in resolved.items()
    }
    identity_payload: JsonObject = {
        "scheme": "common-root-relative-posix/v1",
        "paths": paths,
    }
    return {
        **identity_payload,
        "sha256": _sha256_bytes(_canonical_json(identity_payload).encode("utf-8")),
    }


def _read_transaction_journal(transaction_dir: Path) -> JsonObject:
    journal_path = transaction_dir / "journal.json"
    if not journal_path.is_file():
        raise AcquisitionError("promotion-journal-missing")
    journal = json.loads(journal_path.read_text(encoding="utf-8"))
    if not isinstance(journal, dict):
        raise AcquisitionError("promotion-journal-invalid")
    if journal.get("schemaVersion") != "safeclaw-exact-kosha-promotion-transaction/v2":
        raise AcquisitionError("promotion-journal-version-invalid")
    if journal.get("state") not in {"prepared", "committed", "rolled_back"}:
        raise AcquisitionError("promotion-journal-state-invalid")
    return journal


def _validated_transaction_journal(
    transaction_dir: Path,
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
) -> JsonObject:
    journal = _read_transaction_journal(transaction_dir)
    expected_targets = _portable_target_identity(asset_path, receipt_path, failure_path)
    if journal.get("targets") != expected_targets:
        raise AcquisitionError("promotion-target-identity-mismatch")
    backups = journal.get("backups")
    if not isinstance(backups, dict):
        raise AcquisitionError("promotion-backups-invalid")
    for name in ("asset", "receipt"):
        descriptor = backups.get(name)
        if not isinstance(descriptor, dict) or not isinstance(descriptor.get("present"), bool):
            raise AcquisitionError(f"promotion-backup-descriptor-invalid:{name}")
        backup = transaction_dir / f"{name}.backup"
        if descriptor["present"]:
            expected_sha256 = descriptor.get("sha256")
            if not isinstance(expected_sha256, str) or not backup.is_file():
                raise AcquisitionError(f"promotion-backup-missing:{name}")
            if _sha256_file(backup) != expected_sha256:
                raise AcquisitionError(f"promotion-backup-sha256-mismatch:{name}")
        elif backup.exists():
            raise AcquisitionError(f"promotion-unexpected-backup:{name}")
    state = journal["state"]
    if state in {"committed", "rolled_back"}:
        completion = journal.get("completion")
        descriptors_key = "published" if state == "committed" else "backups"
        descriptors = journal.get(descriptors_key)
        expected_completion_sha256 = _sha256_bytes(
            _canonical_json(descriptors).encode("utf-8")
        )
        if (
            not isinstance(completion, dict)
            or completion.get("state") != state
            or completion.get("targetsSha256") != expected_completion_sha256
        ):
            raise AcquisitionError("promotion-completion-invalid")
    return journal


def _validate_target_state(
    paths: tuple[tuple[str, Path], ...],
    descriptors: object,
    error_prefix: str,
) -> None:
    if not isinstance(descriptors, dict):
        raise AcquisitionError(f"{error_prefix}-descriptors-invalid")
    for name, path in paths:
        descriptor = descriptors.get(name)
        if not isinstance(descriptor, dict) or not isinstance(descriptor.get("present"), bool):
            raise AcquisitionError(f"{error_prefix}-descriptor-invalid:{name}")
        if descriptor["present"]:
            expected_sha256 = descriptor.get("sha256")
            if not path.is_file() or _sha256_file(path) != expected_sha256:
                raise AcquisitionError(f"{error_prefix}-sha256-mismatch:{name}")
        elif path.exists():
            raise AcquisitionError(f"{error_prefix}-unexpected-target:{name}")


def _rollback_transaction(
    transaction_dir: Path,
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
    *,
    restore_write: RestoreWrite = _write_bytes,
) -> None:
    journal = _validated_transaction_journal(
        transaction_dir,
        asset_path,
        receipt_path,
        failure_path,
    )
    if journal["state"] == "committed":
        raise AcquisitionError("promotion-committed-rollback-forbidden")
    targets = (
        ("asset", asset_path),
        ("receipt", receipt_path),
    )
    backups = journal["backups"]
    if not isinstance(backups, dict):
        raise AcquisitionError("promotion-backups-invalid")
    for name, destination in targets:
        backup = transaction_dir / f"{name}.backup"
        descriptor = backups[name]
        if not isinstance(descriptor, dict):
            raise AcquisitionError(f"promotion-backup-descriptor-invalid:{name}")
        if descriptor["present"]:
            destination.parent.mkdir(parents=True, exist_ok=True)
            restore_write(destination, backup.read_bytes())
            _fsync_directory(destination.parent)
        elif destination.exists():
            destination.unlink()
            _fsync_directory(destination.parent)
    _validate_target_state(targets, backups, "promotion-rollback")
    journal["state"] = "rolled_back"
    journal["completion"] = {
        "state": "rolled_back",
        "targetsSha256": _sha256_bytes(_canonical_json(backups).encode("utf-8")),
    }
    _write_json(transaction_dir / "journal.json", journal)
    _fsync_directory(transaction_dir)
    shutil.rmtree(transaction_dir)
    _fsync_directory(transaction_dir.parent)


def _recover_incomplete_promotion(
    transaction_dir: Path,
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
) -> None:
    if not transaction_dir.exists():
        return
    journal = _validated_transaction_journal(
        transaction_dir,
        asset_path,
        receipt_path,
        failure_path,
    )
    targets = (("asset", asset_path), ("receipt", receipt_path))
    if journal["state"] == "prepared":
        _rollback_transaction(
            transaction_dir,
            asset_path,
            receipt_path,
            failure_path,
        )
        return
    descriptors_key = "published" if journal["state"] == "committed" else "backups"
    _validate_target_state(
        targets,
        journal.get(descriptors_key),
        f"promotion-{journal['state']}",
    )
    shutil.rmtree(transaction_dir)
    _fsync_directory(transaction_dir.parent)


def _prepare_promotion_transaction(
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
    asset: JsonObject,
    receipt: JsonObject,
    prepare_hook: PrepareHook = _noop_prepare_hook,
) -> Path:
    transaction_dir = _transaction_dir(failure_path)
    staging_dir = _staging_dir(failure_path)
    _recover_incomplete_promotion(
        transaction_dir,
        asset_path,
        receipt_path,
        failure_path,
    )
    if staging_dir.exists():
        if transaction_dir.exists() or not staging_dir.is_dir() or _is_symlink_or_junction(staging_dir):
            raise AcquisitionError("promotion-staging-orphan-unsafe")
        shutil.rmtree(staging_dir)
        _fsync_directory(staging_dir.parent)
    staging_dir.mkdir(parents=True, exist_ok=False)
    _fsync_directory(staging_dir.parent)
    prepare_hook("after-mkdir")
    staged = {
        "asset": staging_dir / "asset.staged.json",
        "receipt": staging_dir / "receipt.staged.json",
    }
    _write_json(staged["asset"], asset)
    _fsync_directory(staging_dir)
    prepare_hook("after-staged-asset")
    _write_json(staged["receipt"], receipt)
    _fsync_directory(staging_dir)
    prepare_hook("after-staged-receipt")
    targets = {
        "asset": asset_path,
        "receipt": receipt_path,
    }
    backups: JsonObject = {}
    published: JsonObject = {}
    for name, destination in targets.items():
        if destination.is_file():
            backup = staging_dir / f"{name}.backup"
            _write_bytes(backup, destination.read_bytes())
            _fsync_directory(staging_dir)
            backups[name] = {"present": True, "sha256": _sha256_file(backup)}
            prepare_hook(f"after-backup-{name}")
        else:
            backups[name] = {"present": False, "sha256": None}
        published[name] = {
            "present": True,
            "sha256": _sha256_file(staged[name]),
        }
    _write_json(
        staging_dir / "journal.json",
        {
            "schemaVersion": "safeclaw-exact-kosha-promotion-transaction/v2",
            "state": "prepared",
            "targets": _portable_target_identity(asset_path, receipt_path, failure_path),
            "backups": backups,
            "published": published,
        },
    )
    _fsync_directory(staging_dir)
    prepare_hook("after-prepared-journal")
    _validated_transaction_journal(
        staging_dir,
        asset_path,
        receipt_path,
        failure_path,
    )
    os.replace(staging_dir, transaction_dir)
    _fsync_directory(transaction_dir.parent)
    prepare_hook("after-activation")
    return transaction_dir


def _publish_promotion_pair(
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
    asset: JsonObject,
    receipt: JsonObject,
    replace_file: ReplaceFile = os.replace,
    prepare_hook: PrepareHook = _noop_prepare_hook,
) -> None:
    transaction_dir = _prepare_promotion_transaction(
        asset_path,
        receipt_path,
        failure_path,
        asset,
        receipt,
        prepare_hook,
    )
    staged_asset = transaction_dir / "asset.staged.json"
    staged_receipt = transaction_dir / "receipt.staged.json"
    try:
        _validated_transaction_journal(
            transaction_dir,
            asset_path,
            receipt_path,
            failure_path,
        )
        asset_path.parent.mkdir(parents=True, exist_ok=True)
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        replace_file(staged_asset, asset_path)
        _fsync_directory(asset_path.parent)
        _fsync_directory(transaction_dir)
        replace_file(staged_receipt, receipt_path)
        _fsync_directory(receipt_path.parent)
        _fsync_directory(transaction_dir)
        journal = _validated_transaction_journal(
            transaction_dir,
            asset_path,
            receipt_path,
            failure_path,
        )
        targets = (("asset", asset_path), ("receipt", receipt_path))
        _validate_target_state(targets, journal.get("published"), "promotion-published")
        journal["state"] = "committed"
        journal["completion"] = {
            "state": "committed",
            "targetsSha256": _sha256_bytes(
                _canonical_json(journal["published"]).encode("utf-8")
            ),
        }
        _write_json(transaction_dir / "journal.json", journal)
        _fsync_directory(transaction_dir)
    except Exception:
        _rollback_transaction(
            transaction_dir,
            asset_path,
            receipt_path,
            failure_path,
        )
        raise
    shutil.rmtree(transaction_dir)
    _fsync_directory(transaction_dir.parent)


def acquire_exact_body(
    ledger_path: Path,
    asset_path: Path,
    receipt_path: Path,
    failure_path: Path,
    *,
    fetch_bytes: FetchBytes = fetch_official_pdf,
    expected_ledger_sha256: str = PINNED_LEDGER_SHA256,
    publish_replace: ReplaceFile = os.replace,
    prepare_hook: PrepareHook = _noop_prepare_hook,
) -> JsonObject:
    _validate_promotion_paths(ledger_path, asset_path, receipt_path, failure_path)
    transaction_dir = _transaction_dir(failure_path)
    _recover_incomplete_promotion(
        transaction_dir,
        asset_path,
        receipt_path,
        failure_path,
    )
    try:
        record, ledger_sha256 = load_target_record(ledger_path, expected_ledger_sha256)
        pdf_bytes = fetch_bytes(str(record["official_url"]))
        asset, receipt = _extract_asset(record, pdf_bytes, ledger_sha256)
        _publish_promotion_pair(
            asset_path,
            receipt_path,
            failure_path,
            asset,
            receipt,
            publish_replace,
            prepare_hook,
        )
        if failure_path.exists():
            failure_path.unlink()
            _fsync_directory(failure_path.parent)
        return receipt
    except Exception as exc:
        failure = {
            "schemaVersion": "safeclaw-exact-kosha-acquisition-evaluation/v1",
            "status": "not-promoted",
            "promoted": False,
            "target": TARGET_VERSION,
            "errorType": type(exc).__name__,
            "error": str(exc),
            "promotionState": {
                "assetPresent": asset_path.is_file(),
                "receiptPresent": receipt_path.is_file(),
                "partialPromotionPresent": asset_path.is_file() != receipt_path.is_file(),
                "transactionPresent": transaction_dir.exists(),
                "stagingPresent": _staging_dir(failure_path).exists(),
            },
            "dbMutationPerformed": False,
            "schemaMutationPerformed": False,
        }
        _write_json(failure_path, failure)
        _fsync_directory(failure_path.parent)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Acquire and verify exact D-C-7-2026 KOSHA body")
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--asset", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--failure-report", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        receipt = acquire_exact_body(args.ledger, args.asset, args.receipt, args.failure_report)
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 2
    print(_canonical_json(receipt))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
