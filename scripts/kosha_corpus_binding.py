from __future__ import annotations

import gzip
import hashlib
import json
import re
import unicodedata
from pathlib import Path


JsonObject = dict[str, object]
SCHEMA_VERSION = "safeclaw-kosha-corpus-binding/v1"


class CorpusBindingError(RuntimeError):
    pass


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _canonical_sha256(value: object) -> str:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return _sha256_bytes(canonical.encode("utf-8"))


def _normalized_body_sha256(value: str) -> str:
    normalized = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()
    return _sha256_bytes(normalized.encode("utf-8"))


def _read_object(path: Path) -> JsonObject:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise CorpusBindingError(f"corpus-binding-invalid-object:{path}")
    return value


def _inside(root: Path, relative_path: Path) -> Path:
    resolved_root = root.resolve()
    resolved = (resolved_root / relative_path).resolve()
    if not resolved.is_relative_to(resolved_root):
        raise CorpusBindingError(f"corpus-binding-path-outside-root:{relative_path.as_posix()}")
    return resolved


def _logical_items(snapshot_dir: Path) -> tuple[Path, bytes, str | None]:
    gzip_path = snapshot_dir / "items.jsonl.gz"
    plain_path = snapshot_dir / "items.jsonl"
    if gzip_path.is_file():
        gzip_bytes = gzip_path.read_bytes()
        return gzip_path, gzip.decompress(gzip_bytes), _sha256_bytes(gzip_bytes)
    if plain_path.is_file():
        return plain_path, plain_path.read_bytes(), None
    raise CorpusBindingError("corpus-binding-items-missing")


def build_corpus_binding(
    root_dir: Path,
    current_path: Path,
    body_root: Path,
    candidates: list[JsonObject],
) -> JsonObject:
    root = root_dir.resolve()
    resolved_current = _inside(root, current_path)
    resolved_body_root = _inside(root, body_root)
    current_bytes = resolved_current.read_bytes()
    current = json.loads(current_bytes.decode("utf-8"))
    if not isinstance(current, dict):
        raise CorpusBindingError("corpus-binding-current-invalid")
    snapshot_path = _text(current.get("snapshot_path"))
    snapshot_id = _text(current.get("snapshot_id"))
    if not snapshot_path or not snapshot_id:
        raise CorpusBindingError("corpus-binding-current-identity-missing")
    snapshot_dir = _inside(resolved_body_root, Path(snapshot_path))
    manifest_descriptor = current.get("manifest")
    if not isinstance(manifest_descriptor, dict):
        raise CorpusBindingError("corpus-binding-current-manifest-missing")
    manifest_relative = _text(manifest_descriptor.get("path"))
    declared_manifest_sha256 = _text(manifest_descriptor.get("sha256"))
    if not manifest_relative or not declared_manifest_sha256:
        raise CorpusBindingError("corpus-binding-current-manifest-incomplete")
    manifest_path = _inside(resolved_body_root, Path(manifest_relative))
    manifest_sha256 = sha256_file(manifest_path)
    if manifest_sha256 != declared_manifest_sha256:
        raise CorpusBindingError("corpus-binding-manifest-hash-mismatch")
    manifest = _read_object(manifest_path)
    if _text(manifest.get("snapshot_id")) != snapshot_id or snapshot_dir.name != snapshot_id:
        raise CorpusBindingError("corpus-binding-snapshot-identity-mismatch")
    source_identity = manifest.get("source_identity")
    if not isinstance(source_identity, dict):
        raise CorpusBindingError("corpus-binding-source-identity-missing")
    source_identity_sha256 = _text(source_identity.get("identity_sha256"))
    if not source_identity_sha256 or source_identity_sha256 != _text(current.get("source_identity_sha256")):
        raise CorpusBindingError("corpus-binding-source-identity-mismatch")
    items_path, logical_bytes, gzip_sha256 = _logical_items(snapshot_dir)
    logical_sha256 = _sha256_bytes(logical_bytes)
    output_hashes = manifest.get("output_hashes")
    declared_logical_sha256 = _text(output_hashes.get("items.jsonl")) if isinstance(output_hashes, dict) else ""
    if not declared_logical_sha256 or logical_sha256 != declared_logical_sha256:
        raise CorpusBindingError("corpus-binding-items-logical-hash-mismatch")
    body_rows = [
        value
        for line in logical_bytes.decode("utf-8").splitlines()
        if line.strip()
        for value in [json.loads(line)]
        if isinstance(value, dict)
    ]
    body_by_key = {_text(row.get("stable_key")): row for row in body_rows}
    candidate_pairs: list[JsonObject] = []
    for candidate in candidates:
        stable_key = _text(candidate.get("stableKey"))
        version = _text(candidate.get("version"))
        expected_body_sha256 = _text(candidate.get("bodySha256"))
        packet_recomputed_sha256 = _text(candidate.get("recomputedBodySha256"))
        expected_pdf_sha256 = _text(candidate.get("pdfSha256"))
        body_row = body_by_key.get(stable_key)
        if not stable_key or body_row is None:
            raise CorpusBindingError(f"corpus-binding-candidate-body-missing:{stable_key or 'missing'}")
        if _text(body_row.get("version_key")) != version:
            raise CorpusBindingError(f"corpus-binding-candidate-version-mismatch:{stable_key}")
        recomputed_body_sha256 = _normalized_body_sha256(_text(body_row.get("body")))
        if (
            not expected_body_sha256
            or recomputed_body_sha256 != expected_body_sha256
            or packet_recomputed_sha256 != recomputed_body_sha256
        ):
            raise CorpusBindingError(f"corpus-binding-candidate-body-mismatch:{stable_key}")
        candidate_pairs.append(
            {
                "stableKey": stable_key,
                "version": version,
                "recomputedBodySha256": recomputed_body_sha256,
                "expectedPdfSha256": expected_pdf_sha256,
            }
        )
    candidate_pairs.sort(key=lambda row: _text(row.get("stableKey")))
    candidate_pairs_sha256 = _canonical_sha256(candidate_pairs)
    material: JsonObject = {
        "schemaVersion": SCHEMA_VERSION,
        "snapshotId": snapshot_id,
        "sourceIdentitySha256": source_identity_sha256,
        "current": {
            "path": resolved_current.relative_to(root).as_posix(),
            "sha256": _sha256_bytes(current_bytes),
        },
        "manifest": {
            "path": manifest_path.relative_to(root).as_posix(),
            "sha256": manifest_sha256,
            "declaredSha256": declared_manifest_sha256,
        },
        "items": {
            "path": items_path.relative_to(root).as_posix(),
            "gzipSha256": gzip_sha256,
            "logicalSha256": logical_sha256,
            "declaredLogicalSha256": declared_logical_sha256,
        },
        "candidatePairs": candidate_pairs,
        "candidatePairsSha256": candidate_pairs_sha256,
    }
    return {**material, "bindingSha256": _canonical_sha256(material)}


def require_packet_corpus_binding(packet: JsonObject, computed: JsonObject) -> None:
    declared = packet.get("corpusBinding")
    if not isinstance(declared, dict):
        raise CorpusBindingError("corpus-binding-packet-missing")
    if declared != computed:
        raise CorpusBindingError("corpus-binding-packet-mismatch")
