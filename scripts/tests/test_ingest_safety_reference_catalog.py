from __future__ import annotations

import csv
import importlib.util
import sys
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType
from unittest.mock import patch

from openpyxl import Workbook

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from parser_safety import ParserBudget, ParserBudgetError, ParserLimits

SCRIPT_PATH = SCRIPTS_DIR / "ingest_safety_reference_catalog.py"


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

    def test_rejects_csv_rows_above_the_cell_budget(self) -> None:
        ingester = load_ingester()
        with TemporaryDirectory() as temporary_directory:
            csv_path = Path(temporary_directory) / "catalog.csv"
            with csv_path.open("w", encoding="utf-8", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(["공정", "위험", "조치"])
                writer.writerow(["굴착", "추락", "난간"])
            budget = ParserBudget(ParserLimits(max_cells_per_row=2))

            with self.assertRaisesRegex(ParserBudgetError, "row cells exceed limit"):
                ingester.read_csv_dicts(csv_path, budget)

    def test_technical_zip_parser_preflights_member_budget_before_pdf_extraction(self) -> None:
        ingester = load_ingester()
        with TemporaryDirectory() as temporary_directory:
            technical_folder = Path(temporary_directory)
            archive_path = technical_folder / "technical-guides.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("A-G-1-2025 기술지원규정.pdf", b"first-invalid-pdf")
                archive.writestr("A-G-2-2025 기술지원규정.pdf", b"second-invalid-pdf")
            strict_limits = ingester.ArchiveLimits(
                max_member_count=1,
                max_member_bytes=1024,
                max_total_uncompressed_bytes=2048,
                max_compression_ratio=100.0,
                max_central_directory_bytes=4096,
            )

            with patch.object(ingester, "TECHNICAL_ARCHIVE_LIMITS", strict_limits):
                with self.assertRaisesRegex(ValueError, "ZIP member count exceeds limit: 2/1"):
                    ingester.parse_technical_support_zips(
                        technical_folder,
                        max_pdf_pages=3,
                        priority_only=False,
                    )


if __name__ == "__main__":
    unittest.main()
