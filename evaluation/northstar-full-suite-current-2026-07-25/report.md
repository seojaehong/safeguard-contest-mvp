# Northstar Full Suite Current

- Verdict: `PARTIAL_CURRENT_SOURCE_KOSHA_RED_REMOVED_REMAINING_FULL_SUITE_RED`
- Source commit: `8b0d7d613155b285d9ed785a1db6b86c86eca6cc`

## Full Baseline

The complete current-master Vitest run executed 226 test files:

- Files: 206 PASS / 10 RED / 10 skipped
- Tests: 2,524 PASS / 19 RED / 24 skipped
- Duration: 996.64 seconds
- Log: `evaluation/northstar-full-suite-current-2026-07-25/vitest.log`

## KOSHA Remediation

Seven RED tests belonged to the exact-promotion packet and next-candidate audit.
Both scripts began with a CRLF shebang. Direct `node script.mjs` execution
accepted it, but Vitest/Vite ESM transformation failed with `SyntaxError:
Invalid or unexpected token` before the actual KOSHA contracts ran.

The scripts are always invoked through `node`, so the redundant shebangs were
removed. No KOSHA selection, provenance, lifecycle, review, or promotion logic
was changed.

After remediation:

- Direct KOSHA suites: 2 files / 9 tests PASS
- KOSHA exact adjacent suites: 5 files / 64 tests PASS
- Strict typecheck: PASS
- Both scripts pass `node --check`

The passing assertions still cover current metadata, verified body provenance,
official lifecycle identity, exact-pin exclusion, non-mutation, reviewer
support, and Northstar approval boundaries.

## Remaining RED

Twelve failures remain from the pre-remediation full run:

- Frontend route, typography, contrast, and module-shell contracts: 10
- MCP product materialization persistence contracts: 2

The complete suite has not yet been rerun after this KOSHA-only repair.
Therefore this report does not claim a green full suite.

## Boundary

No database, Share-session, provider, embedding, vector, or exact-trust
registry mutation was performed. KOSHA exact promotion remains unperformed and
approval-gated. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`;
broad human review remains incomplete.
