from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType

from openpyxl import Workbook


SCRIPT_PATH = Path(__file__).parents[1] / "ingest_safety_reference_catalog.py"


def load_ingester() -> ModuleType:
    module_name = "ingest_safety_reference_catalog_for_test"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {SCRIPT_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class ParseSifArchiveTest(unittest.TestCase):
    def test_skips_the_repeated_construction_subheader_without_dropping_a_record(self) -> None:
        ingester = load_ingester()

        with TemporaryDirectory() as temporary_directory:
            archive_path = Path(temporary_directory) / "sif-archive.xlsx"
            workbook = Workbook()
            sheet = workbook.active
            sheet.title = "아카이브(건설업)"
            sheet.append([None, "연번", "고위험작업·상황", None, None, "재해종류", "재해개요", "기인물", "재해유발요인", "위험성 감소대책(예시)"])
            sheet.append([None, None, "공종", "작업명", "단위작업명", None, None, None, None, None])
            sheet.append([None, None, "1. 토공사", "1. 굴착작업", "1.1 굴착면 정리", "추락", "굴착면에서 발생한 사고", "굴착면 추락", "개구부 방호 미흡", "난간과 덮개를 설치"])
            workbook.save(archive_path)

            _, items = ingester.parse_sif_archive(archive_path)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].payload["rowIndex"], 2)
        self.assertIn("굴착면에서 발생한 사고", items[0].body)


if __name__ == "__main__":
    unittest.main()
