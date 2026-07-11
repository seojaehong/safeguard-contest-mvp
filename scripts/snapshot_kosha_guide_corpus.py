from __future__ import annotations

import argparse
import contextlib
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Callable

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingest_safety_reference_catalog import (
    ReferenceItem,
    ReferenceSource,
    parse_technical_support_zips,
)


TechnicalParser = Callable[[Path, int, bool], tuple[ReferenceSource, list[ReferenceItem]]]


def build_snapshot(
    technical_folder: Path,
    max_pdf_pages: int,
    parser: TechnicalParser = parse_technical_support_zips,
) -> dict[str, object]:
    source, items = parser(technical_folder, max_pdf_pages, False)
    return {
        "readOnly": True,
        "dbMutationPerformed": False,
        "source": asdict(source),
        "itemCount": len(items),
        "items": [asdict(item) for item in items],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Emit a read-only local KOSHA GUIDE corpus snapshot as JSON."
    )
    parser.add_argument(
        "--technical-folder",
        default=r"C:\Users\iceam\Downloads\기술지원규정",
    )
    parser.add_argument("--max-pdf-pages", type=int, default=3)
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            snapshot = build_snapshot(Path(args.technical_folder), args.max_pdf_pages)
        print(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
        return 0
    except Exception as exc:
        print(f"KOSHA GUIDE local snapshot failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
