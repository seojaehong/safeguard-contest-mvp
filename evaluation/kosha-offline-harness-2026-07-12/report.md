# KOSHA Offline Harness Review Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-harness`
- Review base: `19a098f`
- Actual read-only artifact: `C:\Users\iceam\dev\safeclaw-local-artifacts\kosha-corpus-body-recovery-2026-07-12-v3`

## Actual Generator Contract

- `current.json` schema: `safeclaw-kosha-body-current/v1`
- `manifest.json`, `items.jsonl`, `chunks.jsonl`, and `failures.jsonl` schema: `safeclaw-kosha-body-corpus/v2`
- Snapshot: `bb8dd542a0d8dc1ac37e330944bc24fcbfef6eea72e4afb106f96a9c19e63d51`
- Manifest SHA-256: `f90262fc98c190243d80124b5e8711866d3372b3affef7d294c881ed194806d2`
- Inventory: 1,040 items; 1,039 searchable records; 20,520 chunks; one declared failure-ledger record without chunks.
- JSONL size: 79,424,010 bytes. The loader bounds each JSONL file at 48 MiB, for a 96 MiB combined file ceiling, and streams one opened descriptor per file.

## Remediation

- Replaced invented camelCase v2 fixture parsing with the actual snake_case v3 contract.
- Hashes and parses the same opened file descriptor. Root confinement, `lstat`, `realpath`, and `fstat` reject absolute paths, parent escapes, symlinks/junctions, non-regular files, and lstat-to-open replacement.
- Caches a validated corpus by root/current hash/snapshot/source/manifest identity. A `current.json` switch invalidates the cached entry without reparsing the corpus for every query.
- Enforces unique item IDs and chunk IDs, rejects orphan chunks, requires chunks for every non-failure item, and accounts for the declared failure-ledger item explicitly.
- KOSHA v3 records remain supporting evidence while their page anchor is propagated unchanged into deterministic risk rows and TBM links. No ranking value is exposed.
- `sif-case` bypasses local KOSHA records. Server retrieval merges local KOSHA with successful Supabase ranked/REST/vector output by ID and leaves remote failures unmasked.

## Boundary Review

The 12 edited callsites are required by the client/server split, not unrelated refactoring.

- `lib/db-harness.ts` now uses `lib/safety-reference-catalog-client.ts`, a pure browser-safe policy surface. This prevents a client component from tracing server filesystem imports.
- `lib/search.ts`, `lib/claw-tools.ts`, `lib/photo-vision-analysis.ts`, and the four API/MCP routes import `lib/safety-reference-catalog-server.ts`. That wrapper is the sole `server-only` caller of the v3 file loader and merges the remote catalog result.
- `lib/safety-reference-catalog.ts` remains the shared remote catalog implementation and exports the existing `mergeCatalogItems` helper; the server wrapper now imports that helper instead of carrying a duplicate. `lib/kosha-guide-corpus.ts` remains the protected parser. The two new boundary modules are necessary to make ordinary `import()` work in Vitest and Next without the removed `eval` import.

## Fresh Gates

1. `npm.cmd test -- tests/kosha-guide-offline-harness.test.ts tests/kosha-guide-provenance-gate.test.ts`
   Result: 2 files, 8 tests passed, including actual v3 load, path escape/symlink/TOCTOU, bounds/cache, membership, SIF exclusion, remote merge, and risk/TBM page-reference propagation.
2. `npm.cmd run typecheck`
   Result: passed.
3. `npm.cmd run build`
   Result: exactly one run after cleanup. `Compiled successfully` was observed; the root Next process and all child workers later reached zero, and `.next/BUILD_ID` plus the build manifest exist. The execution tool did not expose a final exit status, so this is recorded as process/artifact evidence rather than an asserted exit-code pass.
4. `git diff --check`
   Result: no whitespace errors; CRLF conversion warnings only.

After the review found the duplicate merge helper, the wrapper was changed to import the existing `mergeCatalogItems` implementation. The focused command and typecheck passed again. No second build was run because the race-correction instruction required exactly one final build; the import consolidation preserves the merge implementation that the single build already compiled.

## Race Audit

- Invalidated prior overlapping build PID pairs: `193232/24272` and `226608/154340`.
- Before cleanup, the requested worktree had no remaining matching `cmd.exe` or `node.exe` process. Only `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\kosha-offline-harness\.next` was removed.
- The final build created its own root process and child workers, all of which later terminated. No `frontend-audit-runner` process or other worktree was targeted.

## Limitation

The final build command's exit status was not observable from the execution tool output. Treat the captured compile line, zero remaining matching processes, and generated build artifacts as evidence only; do not present it as a confirmed exit-code success.
