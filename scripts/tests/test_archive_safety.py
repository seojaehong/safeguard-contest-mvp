from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from archive_safety import (
    ArchiveBudgetError,
    ArchiveLimits,
    BoundedZipReader,
    EOCD_SIGNATURE,
    preflight_zip_central_directory,
)


class BoundedZipReaderTest(unittest.TestCase):
    def write_archive(
        self,
        root: Path,
        members: dict[str, bytes],
        compression: int = zipfile.ZIP_STORED,
    ) -> Path:
        archive_path = root / "fixture.zip"
        with zipfile.ZipFile(archive_path, "w", compression=compression) as archive:
            for name, payload in members.items():
                archive.writestr(name, payload)
        return archive_path

    def test_reads_members_within_shared_limits(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            archive_path = self.write_archive(Path(temporary_dir), {"one.xml": b"one", "two.xml": b"two"})
            with zipfile.ZipFile(archive_path) as archive:
                reader = BoundedZipReader(
                    archive,
                    ArchiveLimits(max_member_count=2, max_member_bytes=3, max_total_uncompressed_bytes=6),
                )
                self.assertEqual([reader.read(info) for info in reader.infos], [b"one", b"two"])

    def test_rejects_excess_member_count_and_total_size(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            archive_path = self.write_archive(Path(temporary_dir), {"one": b"1", "two": b"2"})
            with zipfile.ZipFile(archive_path) as archive:
                with self.assertRaisesRegex(ArchiveBudgetError, "member count"):
                    BoundedZipReader(archive, ArchiveLimits(max_member_count=1))
            with zipfile.ZipFile(archive_path) as archive:
                with self.assertRaisesRegex(ArchiveBudgetError, "total uncompressed"):
                    BoundedZipReader(archive, ArchiveLimits(max_total_uncompressed_bytes=1))

    def test_rejects_oversize_and_high_ratio_members_before_read(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            archive_path = self.write_archive(root, {"large.bin": b"x" * 1024})
            with zipfile.ZipFile(archive_path) as archive:
                with self.assertRaisesRegex(ArchiveBudgetError, "member size"):
                    BoundedZipReader(archive, ArchiveLimits(max_member_bytes=100))

            compressed_path = self.write_archive(
                root,
                {"compressed.bin": b"x" * 20_000},
                compression=zipfile.ZIP_DEFLATED,
            )
            with zipfile.ZipFile(compressed_path) as archive:
                with self.assertRaisesRegex(ArchiveBudgetError, "compression ratio"):
                    BoundedZipReader(archive, ArchiveLimits(max_compression_ratio=2.0))

    def test_preflights_central_directory_before_zipfile_materialization(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            archive_path = self.write_archive(Path(temporary_dir), {"one": b"1", "two": b"2"})

            self.assertEqual(
                preflight_zip_central_directory(archive_path, ArchiveLimits(max_member_count=2)),
                2,
            )
            with self.assertRaisesRegex(ArchiveBudgetError, "member count"):
                preflight_zip_central_directory(archive_path, ArchiveLimits(max_member_count=1))
            with self.assertRaisesRegex(ArchiveBudgetError, "central directory exceeds limit"):
                preflight_zip_central_directory(
                    archive_path,
                    ArchiveLimits(max_central_directory_bytes=1),
                )

    def test_preflight_rejects_expansion_and_compression_ratio_before_zipfile(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            root = Path(temporary_dir)
            archive_path = self.write_archive(
                root,
                {"compressed.bin": b"x" * 20_000},
                compression=zipfile.ZIP_DEFLATED,
            )

            with self.assertRaisesRegex(ArchiveBudgetError, "member size"):
                preflight_zip_central_directory(
                    archive_path,
                    ArchiveLimits(max_member_bytes=100),
                )
            with self.assertRaisesRegex(ArchiveBudgetError, "compression ratio"):
                preflight_zip_central_directory(
                    archive_path,
                    ArchiveLimits(max_compression_ratio=2.0),
                )
            with self.assertRaisesRegex(ArchiveBudgetError, "total uncompressed"):
                preflight_zip_central_directory(
                    archive_path,
                    ArchiveLimits(
                        max_total_uncompressed_bytes=100,
                        max_compression_ratio=1_000.0,
                    ),
                )

    def test_rejects_declared_and_actual_central_directory_count_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            archive_path = self.write_archive(Path(temporary_dir), {"one": b"1", "two": b"2"})
            archive_bytes = bytearray(archive_path.read_bytes())
            eocd_offset = archive_bytes.rfind(EOCD_SIGNATURE)
            self.assertGreaterEqual(eocd_offset, 0)
            archive_bytes[eocd_offset + 8:eocd_offset + 10] = (1).to_bytes(2, "little")
            archive_bytes[eocd_offset + 10:eocd_offset + 12] = (1).to_bytes(2, "little")
            archive_path.write_bytes(archive_bytes)

            with self.assertRaisesRegex(ArchiveBudgetError, "count mismatch"):
                preflight_zip_central_directory(archive_path)


if __name__ == "__main__":
    unittest.main()
