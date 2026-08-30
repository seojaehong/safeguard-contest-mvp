from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from parser_safety import ParserBudget, ParserBudgetError, ParserLimits


class ParserBudgetTest(unittest.TestCase):
    def test_rejects_input_above_byte_limit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "large.bin"
            path.write_bytes(b"1234")
            budget = ParserBudget(ParserLimits(max_input_bytes=3))

            with self.assertRaisesRegex(ParserBudgetError, "input bytes exceed limit"):
                budget.assert_input_file(path)

    def test_rejects_in_memory_input_above_byte_limit(self) -> None:
        budget = ParserBudget(ParserLimits(max_input_bytes=3))

        with self.assertRaisesRegex(ParserBudgetError, "input bytes exceed limit"):
            budget.assert_input_bytes(4)

    def test_rejects_extracted_text_above_limit(self) -> None:
        budget = ParserBudget(ParserLimits(max_text_chars=3))
        budget.consume_text("abc")

        with self.assertRaisesRegex(ParserBudgetError, "text chars exceed limit"):
            budget.consume_text("d")

    def test_rejects_sheet_row_and_cell_expansion(self) -> None:
        budget = ParserBudget(ParserLimits(
            max_sheet_count=1,
            max_rows_per_sheet=1,
            max_total_rows=2,
            max_cells_per_row=2,
            max_total_cells=2,
        ))
        budget.start_sheet()
        budget.consume_row(2)

        with self.assertRaisesRegex(ParserBudgetError, "sheet rows exceed limit"):
            budget.consume_row(1)

        with self.assertRaisesRegex(ParserBudgetError, "sheet count exceeds limit"):
            budget.start_sheet()

    def test_rejects_single_rows_above_cell_limit(self) -> None:
        budget = ParserBudget(ParserLimits(max_cells_per_row=2))
        budget.start_sheet()

        with self.assertRaisesRegex(ParserBudgetError, "row cells exceed limit"):
            budget.consume_row(3)

    def test_rejects_elapsed_work(self) -> None:
        budget = ParserBudget(ParserLimits(max_elapsed_seconds=0.0))
        time.sleep(0.001)

        with self.assertRaisesRegex(ParserBudgetError, "elapsed time exceeds limit"):
            budget.start_sheet()


if __name__ == "__main__":
    unittest.main()
