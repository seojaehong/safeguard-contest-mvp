from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import kosha_evidence_portability


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rehydrate a KOSHA evidence bundle from local blobs or official URLs."
    )
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--source-bundle-root", type=Path, required=True)
    parser.add_argument("--output-bundle-root", type=Path, required=True)
    parser.add_argument("--allow-official-refetch", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        summary = kosha_evidence_portability.rehydrate_bundle(
            args.ledger,
            args.source_bundle_root,
            args.output_bundle_root,
            allow_official_refetch=args.allow_official_refetch,
        )
        print(kosha_evidence_portability.canonical_json(summary))
        return 0
    except Exception as exc:
        print(f"KOSHA evidence rehydration failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
