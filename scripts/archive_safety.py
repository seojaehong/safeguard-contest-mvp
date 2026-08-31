from __future__ import annotations

import io
import zipfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Iterator


EOCD_SIGNATURE = b"PK\x05\x06"
CENTRAL_DIRECTORY_SIGNATURE = b"PK\x01\x02"
CENTRAL_DIRECTORY_DIGITAL_SIGNATURE = b"PK\x05\x05"
MAX_EOCD_SEARCH_BYTES = 65_557


@dataclass(frozen=True)
class ArchiveLimits:
    max_member_count: int = 4096
    max_member_bytes: int = 64 * 1024 * 1024
    max_total_uncompressed_bytes: int = 512 * 1024 * 1024
    max_compression_ratio: float = 100.0
    max_central_directory_bytes: int = 64 * 1024 * 1024


class ArchiveBudgetError(ValueError):
    pass


def _uint16(value: bytes, offset: int) -> int:
    end = offset + 2
    if end > len(value):
        raise ArchiveBudgetError("truncated ZIP central directory")
    return int.from_bytes(value[offset:end], "little")


def _uint32(value: bytes, offset: int) -> int:
    end = offset + 4
    if end > len(value):
        raise ArchiveBudgetError("truncated ZIP central directory")
    return int.from_bytes(value[offset:end], "little")


def preflight_zip_central_directory(
    archive_path: Path,
    limits: ArchiveLimits | None = None,
) -> int:
    with archive_path.open("rb") as archive_file:
        return preflight_open_zip_central_directory(
            archive_file,
            archive_path.name,
            limits,
        )


def preflight_open_zip_central_directory(
    archive_file: BinaryIO,
    archive_name: str,
    limits: ArchiveLimits | None = None,
) -> int:
    effective_limits = limits or ArchiveLimits()
    archive_file.seek(0, 2)
    file_size = archive_file.tell()
    tail_size = min(file_size, MAX_EOCD_SEARCH_BYTES)
    archive_file.seek(file_size - tail_size)
    tail = archive_file.read(tail_size)
    eocd_index = -1
    search_end = len(tail)
    while search_end > 0:
        candidate_index = tail.rfind(EOCD_SIGNATURE, 0, search_end)
        if candidate_index < 0:
            break
        if candidate_index + 22 <= len(tail):
            candidate_comment_length = _uint16(tail, candidate_index + 20)
            if candidate_index + 22 + candidate_comment_length == len(tail):
                eocd_index = candidate_index
                break
        search_end = candidate_index
    if eocd_index < 0:
        raise ArchiveBudgetError(f"ZIP end-of-central-directory is missing: {archive_name}")
    disk_number = _uint16(tail, eocd_index + 4)
    central_directory_disk = _uint16(tail, eocd_index + 6)
    disk_entry_count = _uint16(tail, eocd_index + 8)
    declared_entry_count = _uint16(tail, eocd_index + 10)
    central_directory_size = _uint32(tail, eocd_index + 12)
    central_directory_offset = _uint32(tail, eocd_index + 16)
    comment_length = _uint16(tail, eocd_index + 20)
    eocd_absolute_offset = file_size - tail_size + eocd_index
    if eocd_absolute_offset + 22 + comment_length != file_size:
        raise ArchiveBudgetError(f"ZIP end-of-central-directory length mismatch: {archive_name}")
    if disk_number != 0 or central_directory_disk != 0 or disk_entry_count != declared_entry_count:
        raise ArchiveBudgetError(f"multi-disk ZIP archives are not supported: {archive_name}")
    if (
        declared_entry_count == 0xFFFF
        or central_directory_size == 0xFFFFFFFF
        or central_directory_offset == 0xFFFFFFFF
    ):
        raise ArchiveBudgetError(f"ZIP64 central directories are not supported: {archive_name}")
    if declared_entry_count > effective_limits.max_member_count:
        raise ArchiveBudgetError(
            f"ZIP member count exceeds limit: "
            f"{declared_entry_count}/{effective_limits.max_member_count}"
        )
    if central_directory_size > effective_limits.max_central_directory_bytes:
        raise ArchiveBudgetError(
            f"archive central directory exceeds limit: "
            f"{central_directory_size}/{effective_limits.max_central_directory_bytes}"
        )
    central_directory_end = central_directory_offset + central_directory_size
    if central_directory_end > eocd_absolute_offset:
        raise ArchiveBudgetError(f"ZIP central directory bounds are invalid: {archive_name}")
    archive_file.seek(central_directory_offset)
    central_directory = archive_file.read(central_directory_size)
    if len(central_directory) != central_directory_size:
        raise ArchiveBudgetError(f"ZIP central directory is truncated: {archive_name}")

    offset = 0
    actual_entry_count = 0
    while offset < len(central_directory):
        signature = central_directory[offset:offset + 4]
        if signature == CENTRAL_DIRECTORY_DIGITAL_SIGNATURE:
            signature_size = _uint16(central_directory, offset + 4)
            offset += 6 + signature_size
            continue
        if signature != CENTRAL_DIRECTORY_SIGNATURE or offset + 46 > len(central_directory):
            raise ArchiveBudgetError(f"ZIP central directory entry is invalid: {archive_name}")
        flags = _uint16(central_directory, offset + 8)
        compressed_size = _uint32(central_directory, offset + 20)
        uncompressed_size = _uint32(central_directory, offset + 24)
        file_name_length = _uint16(central_directory, offset + 28)
        extra_length = _uint16(central_directory, offset + 30)
        entry_comment_length = _uint16(central_directory, offset + 32)
        if flags & 0x1:
            raise ArchiveBudgetError(f"encrypted ZIP members are not allowed: {archive_name}")
        if compressed_size == 0xFFFFFFFF or uncompressed_size == 0xFFFFFFFF:
            raise ArchiveBudgetError(f"ZIP64 members are not supported: {archive_name}")
        next_offset = offset + 46 + file_name_length + extra_length + entry_comment_length
        if next_offset > len(central_directory):
            raise ArchiveBudgetError(f"ZIP central directory entry is truncated: {archive_name}")
        actual_entry_count += 1
        if actual_entry_count > effective_limits.max_member_count:
            raise ArchiveBudgetError(
                f"ZIP member count exceeds limit: "
                f"{actual_entry_count}/{effective_limits.max_member_count}"
            )
        offset = next_offset
    if offset != len(central_directory) or actual_entry_count != declared_entry_count:
        raise ArchiveBudgetError(
            f"ZIP central directory count mismatch: "
            f"{actual_entry_count}/{declared_entry_count}"
        )
    return actual_entry_count


@contextmanager
def open_preflighted_zip(
    archive_path: Path,
    limits: ArchiveLimits | None = None,
) -> Iterator[tuple[zipfile.ZipFile, int]]:
    with archive_path.open("rb") as archive_file:
        declared_member_count = preflight_open_zip_central_directory(
            archive_file,
            archive_path.name,
            limits,
        )
        archive_file.seek(0)
        with zipfile.ZipFile(archive_file) as archive:
            yield archive, declared_member_count


def _compression_ratio(info: zipfile.ZipInfo) -> float:
    if info.file_size == 0:
        return 1.0
    if info.compress_size <= 0:
        return float("inf")
    return info.file_size / info.compress_size


class BoundedZipReader:
    def __init__(self, archive: zipfile.ZipFile, limits: ArchiveLimits | None = None) -> None:
        self.archive = archive
        self.limits = limits or ArchiveLimits()
        self.infos = tuple(archive.infolist())
        self._total_read_bytes = 0
        self._validate_directory()

    def _validate_directory(self) -> None:
        if len(self.infos) > self.limits.max_member_count:
            raise ArchiveBudgetError(
                f"archive member count exceeds limit: {len(self.infos)}/{self.limits.max_member_count}"
            )
        total_uncompressed = 0
        for info in self.infos:
            if info.flag_bits & 0x1:
                raise ArchiveBudgetError(f"encrypted archive member is not allowed: {info.filename}")
            if info.file_size > self.limits.max_member_bytes:
                raise ArchiveBudgetError(
                    f"archive member size exceeds limit: {info.filename} "
                    f"({info.file_size}/{self.limits.max_member_bytes})"
                )
            ratio = _compression_ratio(info)
            if ratio > self.limits.max_compression_ratio:
                raise ArchiveBudgetError(
                    f"archive member compression ratio exceeds limit: {info.filename} "
                    f"({ratio:.3f}/{self.limits.max_compression_ratio:.3f})"
                )
            total_uncompressed += info.file_size
            if total_uncompressed > self.limits.max_total_uncompressed_bytes:
                raise ArchiveBudgetError(
                    "archive total uncompressed bytes exceed limit: "
                    f"{total_uncompressed}/{self.limits.max_total_uncompressed_bytes}"
                )

    def read(self, info: zipfile.ZipInfo) -> bytes:
        output = io.BytesIO()
        member_bytes = 0
        with self.archive.open(info, "r") as stream:
            while chunk := stream.read(1024 * 1024):
                member_bytes += len(chunk)
                self._total_read_bytes += len(chunk)
                if member_bytes > self.limits.max_member_bytes:
                    raise ArchiveBudgetError(
                        f"archive member streamed bytes exceed limit: {info.filename}"
                    )
                if self._total_read_bytes > self.limits.max_total_uncompressed_bytes:
                    raise ArchiveBudgetError("archive streamed bytes exceed total limit")
                output.write(chunk)
        if member_bytes != info.file_size:
            raise ArchiveBudgetError(
                f"archive member size mismatch: {info.filename} ({member_bytes}/{info.file_size})"
            )
        return output.getvalue()
