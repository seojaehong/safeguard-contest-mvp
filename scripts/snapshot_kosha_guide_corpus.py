from __future__ import annotations

import argparse
import contextlib
import io
import json
import os
import re
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


def validate_parse_accounting(
    stats: dict[str, object],
    expected_pdf_rows: int,
) -> dict[str, object]:
    rows_returned = int(stats["rowsReturned"])
    attempted = int(stats["parseAttemptedCount"])
    succeeded = int(stats["parseSuccessCount"])
    failed = int(stats["parseFailureCount"])
    outcomes = stats["outcomes"]
    if not isinstance(outcomes, list):
        raise TypeError("parse outcomes must be a list")
    mismatches: list[str] = []
    if rows_returned != expected_pdf_rows:
        mismatches.append(f"rows-returned:{rows_returned}/{expected_pdf_rows}")
    if succeeded + failed != attempted:
        mismatches.append(f"parse-outcomes:{succeeded + failed}/{attempted}")
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
        else:
            status = "success"
        outcomes.append({"internalPath": internal_path, "status": status})
    outcomes.sort(key=lambda outcome: outcome["internalPath"])
    parse_stats = validate_parse_accounting(
        {
            "rowsReturned": len(items),
            "parseAttemptedCount": sum(outcome["status"] != "not-attempted" for outcome in outcomes),
            "parseSuccessCount": sum(outcome["status"] == "success" for outcome in outcomes),
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
