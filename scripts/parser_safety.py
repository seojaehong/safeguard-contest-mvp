from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ParserLimits:
    max_input_bytes: int = 512 * 1024 * 1024
    max_sheet_count: int = 128
    max_rows_per_sheet: int = 100_000
    max_total_rows: int = 250_000
    max_cells_per_row: int = 512
    max_total_cells: int = 2_000_000
    max_elapsed_seconds: float = 600.0


class ParserBudgetError(ValueError):
    pass


class ParserBudget:
    def __init__(self, limits: ParserLimits | None = None) -> None:
        self.limits = limits or ParserLimits()
        self.started_at = time.monotonic()
        self.sheet_count = 0
        self.sheet_rows = 0
        self.total_rows = 0
        self.total_cells = 0

    def check_elapsed(self) -> None:
        elapsed = time.monotonic() - self.started_at
        if elapsed > self.limits.max_elapsed_seconds:
            raise ParserBudgetError(
                f"parser elapsed time exceeds limit: {elapsed:.3f}/{self.limits.max_elapsed_seconds:.3f}"
            )

    def assert_input_file(self, path: Path) -> None:
        self.check_elapsed()
        size = path.stat().st_size
        if size > self.limits.max_input_bytes:
            raise ParserBudgetError(
                f"parser input bytes exceed limit: {size}/{self.limits.max_input_bytes}"
            )

    def start_sheet(self) -> None:
        self.check_elapsed()
        self.sheet_count += 1
        self.sheet_rows = 0
        if self.sheet_count > self.limits.max_sheet_count:
            raise ParserBudgetError(
                f"parser sheet count exceeds limit: {self.sheet_count}/{self.limits.max_sheet_count}"
            )

    def consume_row(self, cell_count: int) -> None:
        self.check_elapsed()
        if not isinstance(cell_count, int) or cell_count < 0:
            raise ParserBudgetError(f"invalid parser row cell count: {cell_count}")
        if cell_count > self.limits.max_cells_per_row:
            raise ParserBudgetError(
                f"parser row cells exceed limit: {cell_count}/{self.limits.max_cells_per_row}"
            )

        self.sheet_rows += 1
        self.total_rows += 1
        self.total_cells += cell_count
        if self.sheet_rows > self.limits.max_rows_per_sheet:
            raise ParserBudgetError(
                f"parser sheet rows exceed limit: {self.sheet_rows}/{self.limits.max_rows_per_sheet}"
            )
        if self.total_rows > self.limits.max_total_rows:
            raise ParserBudgetError(
                f"parser total rows exceed limit: {self.total_rows}/{self.limits.max_total_rows}"
            )
        if self.total_cells > self.limits.max_total_cells:
            raise ParserBudgetError(
                f"parser total cells exceed limit: {self.total_cells}/{self.limits.max_total_cells}"
            )
