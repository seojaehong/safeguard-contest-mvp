# KOSHA Fresh P1 Remediation Evidence

Generated: 2026-07-14T21:13:56.6306269+09:00
Branch: fix/kosha-commercial-contract-remediation
RED commit: 32a864f2308d5c6b4ee6972a6cd7bb08de49f24b
Product commit: c30e0991956e37bcde8d4ff306ce75ea1ffa1ecb
Main target checked: 920c7f360688352156de4854b4957a9f2f1f0e43

## Scope

- Fixed P1-1: ambiguous mixed-family scaffold/equipment/collision text can no longer reopen a KOSHA collision parent.
- Fixed P1-2: query-hazard-unrelated directEvidence is filtered before public packet, MCP payload, provider prompt, response citations, and deterministic risk-row inputs.
- Preserved SIF -> KOSHA -> law wording and naturalize_only generation contract.
- No DB, schema, data, migration, package, lockfile, or dependency changes.

## TDD Evidence

- RED: red-v6-fresh-p1.log -> 6 failed / 10 passed / 88 skipped.
- GREEN fresh P1: green-v6-fresh-p1.log -> 16 passed / 88 skipped.
- Focused: green-v6-focused55.log -> 55 passed / 20 skipped.
- Prior v4: green-v6-prior-v4.log -> 7 passed / 97 skipped.
- MCP27: green-v6-mcp27.log -> 27 passed / 2 skipped.
- Typecheck: green-v6-typecheck.log -> passed.
- Build: green-v6-build.log -> passed.
- Scope: green-v6-diff-scope.log -> diff-check 0, no added any, no forbidden path, merge-tree exit 0.

## Merge Tree

- Command: git merge-tree --write-tree 920c7f360688352156de4854b4957a9f2f1f0e43 c30e0991956e37bcde8d4ff306ce75ea1ffa1ecb
- Result tree: a5573ce55259e2fab9da9f513ce1a22fce6e9139
- Integration approval: false. Main integration remains prohibited pending fresh independent review.
