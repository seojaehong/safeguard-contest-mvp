# Operator PDF parsers lack enforceable hard deadlines

## Severity

Medium

## Attack Path

A crafted local or CI PDF can hang synchronous parser code before elapsed checks execute.

## Source Evidence

scripts/snapshot_kosha_guide_corpus.py:958-988 and scan_industrial_safety_templates.py:259-275 call PdfReader and extract_text in-process.

## Impact

The affected control can be bypassed or exhausted under the stated preconditions. Current live database state and approval-gated operations were not exercised.

## Remediation

Run PDF parsing in disposable workers with hard wall-clock, memory, and output limits.

## Boundaries

No database, provider, Share-session, vector, wiki, embedding, or KOSHA registry mutation was performed. Exact saved Share remains MISSING_EVIDENCE.

