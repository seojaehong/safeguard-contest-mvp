from __future__ import annotations

import hashlib
import io
import sys
import unittest
from pathlib import Path

from openpyxl import Workbook

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from xlsx_parser_worker import (
    XlsxParseResult,
    XlsxWorkerLimitError,
    parse_xlsx_bytes_bounded,
)


def workbook_bytes() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Safety"
    sheet.append(["hazard", "control"])
    sheet.append(["fall", "guardrail"])
    output = io.BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def parse(data: bytes, **overrides: object) -> XlsxParseResult:
    limits: dict[str, object] = {
        "max_rows_per_sheet": 10,
        "max_sheet_count": 4,
        "max_cells_per_row": 16,
        "max_total_rows": 40,
        "max_total_cells": 200,
        "max_text_chars": 10_000,
        "timeout_seconds": 10.0,
        "memory_limit_bytes": 512 * 1024 * 1024,
        "max_output_bytes": 1024 * 1024,
    }
    limits.update(overrides)
    return parse_xlsx_bytes_bounded(data, **limits)  # type: ignore[arg-type]


class XlsxParserWorkerTest(unittest.TestCase):
    def test_parses_workbook_in_disposable_worker(self) -> None:
        data = workbook_bytes()
        result = parse(data, expected_sha256=hashlib.sha256(data).hexdigest())

        self.assertEqual(result.sheet_count, 1)
        self.assertEqual(result.sheets[0].name, "Safety")
        self.assertEqual(result.sheets[0].rows[1], ("fall", "guardrail"))

    def test_rejects_replaced_snapshot_digest(self) -> None:
        with self.assertRaises(XlsxWorkerLimitError) as raised:
            parse(workbook_bytes(), expected_sha256="0" * 64)

        self.assertEqual(raised.exception.code, "input_digest_mismatch")

    def test_enforces_hard_worker_timeout(self) -> None:
        with self.assertRaises(XlsxWorkerLimitError) as raised:
            parse(workbook_bytes(), timeout_seconds=0.1, _test_mode="hang")

        self.assertEqual(raised.exception.code, "timeout")

    def test_rejects_sheet_width_before_row_materialization(self) -> None:
        data = workbook_bytes()
        with self.assertRaises(XlsxWorkerLimitError) as raised:
            parse(data, max_cells_per_row=1)

        self.assertEqual(raised.exception.code, "row_cells_limit")


if __name__ == "__main__":
    unittest.main()
