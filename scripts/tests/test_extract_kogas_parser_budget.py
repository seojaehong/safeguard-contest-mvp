from __future__ import annotations

import importlib.util
import io
import sys
import unittest
from pathlib import Path
from types import ModuleType

from openpyxl import Workbook

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from parser_safety import ParserBudget, ParserBudgetError, ParserLimits

SCRIPT_PATH = SCRIPTS_DIR / "extract_kogas_risk_standard_models.py"


def load_extractor() -> ModuleType:
    module_name = "extract_kogas_risk_standard_models_for_test"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class ExtractKogasParserBudgetTest(unittest.TestCase):
    def test_rejects_xlsx_rows_above_the_cell_budget(self) -> None:
        extractor = load_extractor()
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["공정", "위험", "조치"])
        payload = io.BytesIO()
        workbook.save(payload)
        budget = ParserBudget(ParserLimits(max_cells_per_row=2))

        with self.assertRaisesRegex(ParserBudgetError, "row cells exceed limit"):
            extractor.open_workbook_rows("fixture.xlsx", payload.getvalue(), budget)


if __name__ == "__main__":
    unittest.main()
