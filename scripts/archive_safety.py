from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass


@dataclass(frozen=True)
class ArchiveLimits:
    max_member_count: int = 4096
    max_member_bytes: int = 64 * 1024 * 1024
    max_total_uncompressed_bytes: int = 512 * 1024 * 1024
    max_compression_ratio: float = 100.0


class ArchiveBudgetError(ValueError):
    pass


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
