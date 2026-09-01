from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest import mock


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import scan_industrial_safety_templates as scanner
from pdf_parser_worker import PdfWorkerLimitError


class ScanIndustrialSafetyTemplatesTest(unittest.TestCase):
    def test_pdf_timeout_is_recorded_without_blocking_the_scan(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "timeout.pdf"
            path.write_bytes(b"%PDF-timeout")
            with mock.patch.object(
                scanner,
                "parse_pdf_file_bounded",
                side_effect=PdfWorkerLimitError("timeout", "worker deadline exceeded"),
            ):
                result = scanner.inspect_pdf(
                    path,
                    scanner.ScanLimits(max_elapsed_seconds=30.0),
                    time.perf_counter(),
                )

        self.assertEqual(result["path"], str(path))
        self.assertIn("worker deadline exceeded", result["error"])

    def test_cli_records_limits_and_fails_closed_without_partial_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "source"
            output = root / "output"
            source.mkdir()
            (source / "risk.txt").write_text("위험성평가 작업 전 안전점검", encoding="utf-8")
            common = [
                sys.executable,
                str(SCRIPTS_DIR / "scan_industrial_safety_templates.py"),
                "--source",
                str(source),
                "--max-total-bytes",
                "1024",
                "--max-file-bytes",
                "1024",
                "--max-parser-files",
                "1",
                "--max-elapsed-seconds",
                "30",
            ]
            success = subprocess.run(
                [*common, "--out", str(output), "--max-files", "2"],
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(success.returncode, 0, success.stderr)
            summary = json.loads((output / "summary.json").read_text(encoding="utf-8"))
            self.assertEqual(summary["fileCount"], 1)
            self.assertEqual(summary["parserFileCount"], 0)
            self.assertEqual(summary["limits"]["max_files"], 2)
            self.assertEqual(summary["symlinkPolicy"], "NO_FOLLOW")

            (source / "second.txt").write_text("two", encoding="utf-8")
            blocked_output = root / "blocked"
            blocked = subprocess.run(
                [*common, "--out", str(blocked_output), "--max-files", "1"],
                check=False,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(blocked.returncode, 2)
            self.assertIn("scan-budget-error: file count exceeds limit", blocked.stderr)
            self.assertFalse((blocked_output / "summary.json").exists())

    def test_discovers_bounded_files_without_following_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "nested").mkdir()
            (root / "nested" / "one.txt").write_text("one", encoding="utf-8")
            external = root.parent / f"{root.name}-external.txt"
            external.write_text("external", encoding="utf-8")
            try:
                (root / "linked.txt").symlink_to(external)
            except OSError:
                self.skipTest("symlink creation is unavailable on this Windows host")
            finally:
                if not (root / "linked.txt").exists():
                    external.unlink(missing_ok=True)
            files, total_bytes = scanner.discover_files(
                root,
                scanner.ScanLimits(max_files=2, max_total_bytes=8, max_file_bytes=8),
                time.perf_counter(),
            )
            external.unlink(missing_ok=True)
            self.assertEqual([item.path.name for item in files], ["one.txt"])
            self.assertEqual(total_bytes, 3)

    def test_fails_closed_before_accepting_file_count_over_budget(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "one.txt").write_text("one", encoding="utf-8")
            (root / "two.txt").write_text("two", encoding="utf-8")
            with self.assertRaisesRegex(scanner.ScanBudgetError, "file count exceeds limit"):
                scanner.discover_files(
                    root,
                    scanner.ScanLimits(max_files=1),
                    time.perf_counter(),
                )

    def test_fails_closed_before_accepting_aggregate_bytes_over_budget(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "one.bin").write_bytes(b"1234")
            (root / "two.bin").write_bytes(b"5678")
            with self.assertRaisesRegex(scanner.ScanBudgetError, "aggregate source bytes exceed limit"):
                scanner.discover_files(
                    root,
                    scanner.ScanLimits(max_total_bytes=7),
                    time.perf_counter(),
                )

    def test_fails_closed_before_parser_initialization_for_oversized_zip_member(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            archive_path = Path(temporary_directory) / "oversized.xlsx"
            with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_STORED) as archive:
                archive.writestr("xl/worksheets/sheet1.xml", b"0123456789")
            limits = scanner.ArchiveLimits(
                max_member_count=10,
                max_member_bytes=8,
                max_total_uncompressed_bytes=100,
                max_compression_ratio=100.0,
                max_central_directory_bytes=1024,
            )
            with mock.patch.object(scanner, "STRUCTURED_ARCHIVE_LIMITS", limits):
                with self.assertRaisesRegex(scanner.ScanBudgetError, "archive preflight failed"):
                    scanner.preflight_structured_document(archive_path)

    def test_rejects_image_dimensions_above_pixel_budget(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            image_path = Path(temporary_directory) / "large.png"
            image = scanner.Image.new("RGB", (20, 20))
            image.save(image_path)
            with self.assertRaisesRegex(scanner.ScanBudgetError, "image pixels exceed limit"):
                scanner.inspect_image(image_path, max_image_pixels=399)


if __name__ == "__main__":
    unittest.main()
