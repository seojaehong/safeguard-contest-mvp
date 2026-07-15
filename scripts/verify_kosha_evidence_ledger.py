from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import build_kosha_evidence_ledger
from scripts import kosha_evidence_portability


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify a KOSHA portability ledger and its external bundle."
    )
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--bundle-root", type=Path, required=True)
    parser.add_argument("--corpus-root", type=Path)
    parser.add_argument("--promotion-root", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        if (args.corpus_root is None) != (args.promotion_root is None):
            raise kosha_evidence_portability.PortabilityError(
                "corpus-and-promotion-roots-required-together"
            )
        summary = kosha_evidence_portability.verify_ledger_bundle(
            args.ledger, args.bundle_root
        )
        canonical_identity_verified = False
        if args.corpus_root is not None and args.promotion_root is not None:
            ledger = kosha_evidence_portability.load_ledger(args.ledger)
            actual_identity = build_kosha_evidence_ledger.canonical_identities(
                args.corpus_root, args.promotion_root
            )
            if ledger.get("canonical_identity") != actual_identity:
                raise kosha_evidence_portability.PortabilityError(
                    "canonical-identity-mismatch"
                )
            canonical_identity_verified = True
        print(
            kosha_evidence_portability.canonical_json(
                {
                    **summary,
                    "canonical_identity_verified": canonical_identity_verified,
                }
            )
        )
        return 0
    except Exception as exc:
        print(f"KOSHA evidence verification failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
