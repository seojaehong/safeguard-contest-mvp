from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import kosha_evidence_portability


JsonObject = dict[str, object]


def read_object(path: Path) -> JsonObject:
    if not path.is_file():
        raise kosha_evidence_portability.PortabilityError(f"object-missing:{path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise kosha_evidence_portability.PortabilityError(
            f"object-unreadable:{path.name}:{type(exc).__name__}"
        ) from exc
    if not isinstance(value, dict):
        raise kosha_evidence_portability.PortabilityError(f"object-required:{path.name}")
    return value


def resolve_beneath(root: Path, relative: object) -> Path:
    if not isinstance(relative, str) or not relative:
        raise kosha_evidence_portability.PortabilityError("relative-path-invalid")
    target = (root.resolve() / Path(*relative.replace("\\", "/").split("/"))).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise kosha_evidence_portability.PortabilityError("relative-path-escape") from exc
    return target


def load_manifest(root: Path) -> tuple[JsonObject, JsonObject, str]:
    current = read_object(root / "current.json")
    descriptor = current.get("manifest")
    if not isinstance(descriptor, dict):
        raise kosha_evidence_portability.PortabilityError("manifest-descriptor-missing")
    manifest_path = resolve_beneath(root, descriptor.get("path"))
    if not manifest_path.is_file():
        raise kosha_evidence_portability.PortabilityError("manifest-missing")
    manifest_sha256 = kosha_evidence_portability.sha256_file(manifest_path)
    if manifest_sha256 != descriptor.get("sha256"):
        raise kosha_evidence_portability.PortabilityError("manifest-sha256-mismatch")
    if manifest_path.stat().st_size != descriptor.get("size_bytes"):
        raise kosha_evidence_portability.PortabilityError("manifest-size-mismatch")
    manifest = read_object(manifest_path)
    if manifest.get("snapshot_id") != current.get("snapshot_id"):
        raise kosha_evidence_portability.PortabilityError("manifest-snapshot-mismatch")
    if manifest.get("reproducibility_hash") != current.get("snapshot_id"):
        raise kosha_evidence_portability.PortabilityError("manifest-reproducibility-mismatch")
    return current, manifest, manifest_sha256


def canonical_identities(corpus_root: Path, promotion_root: Path) -> JsonObject:
    corpus_current, corpus_manifest, corpus_manifest_sha256 = load_manifest(corpus_root)
    corpus_source_identity = corpus_manifest.get("source_identity")
    corpus_output_hashes = corpus_manifest.get("output_hashes")
    if not isinstance(corpus_source_identity, dict) or not isinstance(corpus_output_hashes, dict):
        raise kosha_evidence_portability.PortabilityError("corpus-identity-incomplete")
    promotion_current, promotion_manifest, promotion_manifest_sha256 = load_manifest(
        promotion_root
    )
    promotion_identity = promotion_manifest.get("identity")
    promotion_counts = promotion_manifest.get("counts")
    if not isinstance(promotion_identity, dict) or not isinstance(promotion_counts, dict):
        raise kosha_evidence_portability.PortabilityError("promotion-identity-incomplete")
    promotion_output_hashes = promotion_identity.get("output_hashes")
    if not isinstance(promotion_output_hashes, dict):
        raise kosha_evidence_portability.PortabilityError("promotion-output-hashes-missing")
    return {
        "corpus": {
            "snapshot_id": corpus_current["snapshot_id"],
            "manifest_sha256": corpus_manifest_sha256,
            "source_identity_sha256": corpus_source_identity.get("identity_sha256"),
            "generation_policy_sha256": corpus_manifest.get("generation_policy_sha256"),
            "output_hashes": corpus_output_hashes,
        },
        "promotion": {
            "snapshot_id": promotion_current["snapshot_id"],
            "manifest_sha256": promotion_manifest_sha256,
            "official_collection_sha256": promotion_identity.get(
                "official_collection_sha256"
            ),
            "official_metadata_sha256": promotion_output_hashes.get(
                "official-metadata.jsonl"
            ),
            "failures_sha256": promotion_output_hashes.get("failures.jsonl"),
            "verified_count": promotion_counts.get("verified"),
            "failure_count": promotion_counts.get("failures"),
            "launch_ready": promotion_manifest.get("launch_ready"),
        },
    }


def _copy_blob(source: Path, destination: Path, expected_sha256: str) -> None:
    if kosha_evidence_portability.sha256_file(source) != expected_sha256:
        raise kosha_evidence_portability.PortabilityError(
            f"download-sha256-mismatch:{source.name}"
        )
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
    if kosha_evidence_portability.sha256_file(destination) != expected_sha256:
        raise kosha_evidence_portability.PortabilityError(
            f"bundle-blob-sha256-mismatch:{source.name}"
        )


def build_ledger_artifacts(
    *,
    failure_map_path: Path,
    repack_manifest_path: Path,
    corpus_root: Path,
    promotion_root: Path,
    downloads_root: Path,
    bundle_root: Path,
    ledger_path: Path,
) -> JsonObject:
    failure_map = read_object(failure_map_path)
    source_records = failure_map.get("records")
    if not isinstance(source_records, list):
        raise kosha_evidence_portability.PortabilityError("failure-map-records-missing")
    repack_manifest = read_object(repack_manifest_path)
    archives = repack_manifest.get("archives")
    if not isinstance(archives, list):
        raise kosha_evidence_portability.PortabilityError("repack-archives-missing")
    source_zip_sha256: dict[str, str] = {}
    for archive in archives:
        if not isinstance(archive, dict):
            raise kosha_evidence_portability.PortabilityError("repack-archive-invalid")
        name = archive.get("source_zip")
        digest = archive.get("output_zip_sha256")
        if not isinstance(name, str) or not isinstance(digest, str):
            raise kosha_evidence_portability.PortabilityError("repack-archive-identity-invalid")
        source_zip_sha256[name] = digest
    records: list[JsonObject] = []
    for source in source_records:
        if not isinstance(source, dict):
            raise kosha_evidence_portability.PortabilityError("failure-map-record-invalid")
        source_zip = source.get("source_zip")
        official_sha256 = source.get("actual_sha256")
        if not isinstance(source_zip, str) or source_zip not in source_zip_sha256:
            raise kosha_evidence_portability.PortabilityError("source-zip-hash-missing")
        if not isinstance(official_sha256, str):
            raise kosha_evidence_portability.PortabilityError("official-sha256-missing")
        records.append(
            {
                "stable_key": source.get("stable_key"),
                "version": source.get("version"),
                "source_zip": source_zip,
                "source_member": source.get("source_member"),
                "source_zip_sha256": source_zip_sha256[source_zip],
                "official_url": source.get("official_url"),
                "expected_sha256": official_sha256,
            }
        )
    ledger = kosha_evidence_portability.create_ledger(
        records, canonical_identities(corpus_root, promotion_root)
    )
    if bundle_root.exists() and any(bundle_root.iterdir()):
        raise kosha_evidence_portability.PortabilityError(
            f"bundle-root-not-empty:{bundle_root}"
        )
    for record in ledger["records"]:
        if not isinstance(record, dict):
            raise kosha_evidence_portability.PortabilityError("ledger-record-invalid")
        source = downloads_root / f"{record['stable_key']}.pdf"
        if not source.is_file():
            raise kosha_evidence_portability.PortabilityError(
                f"official-download-missing:{record['stable_key']}"
            )
        destination = resolve_beneath(bundle_root, record["relative_locator"])
        _copy_blob(source, destination, str(record["expected_sha256"]))
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    ledger_path.write_text(
        f"{kosha_evidence_portability.canonical_json(ledger)}\n",
        encoding="utf-8",
        newline="\n",
    )
    verification = kosha_evidence_portability.verify_ledger_bundle(
        ledger_path, bundle_root
    )
    return {
        **verification,
        "bundle_blob_count": verification["verified_blob_count"],
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a path-free KOSHA evidence ledger and external blob bundle."
    )
    parser.add_argument("--failure-map", type=Path, required=True)
    parser.add_argument("--repack-manifest", type=Path, required=True)
    parser.add_argument("--corpus-root", type=Path, required=True)
    parser.add_argument("--promotion-root", type=Path, required=True)
    parser.add_argument("--downloads-root", type=Path, required=True)
    parser.add_argument("--bundle-root", type=Path, required=True)
    parser.add_argument("--ledger", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        summary = build_ledger_artifacts(
            failure_map_path=args.failure_map,
            repack_manifest_path=args.repack_manifest,
            corpus_root=args.corpus_root,
            promotion_root=args.promotion_root,
            downloads_root=args.downloads_root,
            bundle_root=args.bundle_root,
            ledger_path=args.ledger,
        )
        print(kosha_evidence_portability.canonical_json(summary))
        return 0
    except Exception as exc:
        print(f"KOSHA evidence ledger build failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
