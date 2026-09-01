# Workbook budgets apply after ExcelJS materialization

## Severity

Low

## Attack Path

A compact but structurally large XLSX can consume memory before row, cell, sheet, or elapsed budgets run.

## Source Evidence

scripts/final_output_parser_safety.mjs:101-130 calls workbook.xlsx.readFile before post-load workbook budgets.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Use bounded streaming parsing or a worker with hard memory/deadline limits and pre-allocation projections.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

