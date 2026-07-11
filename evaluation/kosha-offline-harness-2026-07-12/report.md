# KOSHA Offline Harness Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-harness`
- Base: `84c04cd`
- Scope: phase-1 KOSHA offline/full-body harness, integrity gate, local retrieval wiring, risk/TBM provenance propagation

## Changed files

- `lib/kosha-guide-corpus.ts`
- `lib/safety-reference-catalog.ts`
- `lib/db-harness.ts`
- `lib/search.ts`
- `tests/kosha-guide-offline-harness.test.ts`
- `tests/kosha-guide-provenance-gate.test.ts`

## TDD evidence

1. Added new offline harness tests before implementation.
2. Observed RED on:
   - missing `@/lib/kosha-guide-corpus`
   - focused command still kept existing 47 tests green while 2 new suites failed to import
3. Implemented harness and reran focused verification to GREEN.

## Verification

- Focused command:
  - `npm.cmd test -- tests/kosha-guide-offline-harness.test.ts tests/kosha-guide-provenance-gate.test.ts tests/commercial-harness.test.ts tests/safety-reference-relevance.test.ts tests/tbm-deterministic-structures.test.ts tests/risk-ref-gate-wiring.test.ts`
  - Result: 6 files, 52 tests passed
- Typecheck:
  - `npm.cmd run typecheck`
  - Result: passed
- Build:
  - `npm.cmd run build`
  - Result: passed
- Diff check:
  - `git diff --check`
  - Result: no whitespace errors; only CRLF normalization warnings on existing edited files

## Implemented gates

- Snapshot v2 loader for `current.json`, `manifest.json`, `items.jsonl`, `chunks.jsonl`, `failures.jsonl`
- Hash verification for source, generation, accounting, manifest, items, chunks, failures
- Exact accounting verification for file counts and chunk/item membership
- Fail-closed handling for:
  - missing manifest
  - manifest hash drift
  - accounting drift
  - stale lifecycle
  - partial stage
  - non-zero failure ledger
- Accepted direct KOSHA evidence requires:
  - `lifecycle=current`
  - `bodyKind=native`
  - `quality=accepted`
  - non-empty `bodyHash`
  - page/excerpt anchor
- `ocr`, `summary`, `unknown`, `retired`, `anchorless` records stay review-only and do not seed deterministic risk/TBM controls

## Retrieval behavior

- Added local retrieval modes:
  - `local-tag`
  - `local-ranked`
  - `local-hybrid`
- No ranking score is exposed in surface items
- When an offline snapshot root is configured, public search uses the gated offline corpus instead of silently falling back to direct KOSHA DB rows
- When no snapshot root is configured, previous behavior is preserved

## Provenance propagation

- Deterministic risk rows carry the page-anchor evidence ref as a single exact string
- TBM links reuse the same `evidenceRefs` array without mutation

## Limitations

- The offline corpus is path-driven and fixture-tested, but no real external corpus is committed in this branch.
- To keep the client bundle clean, the offline corpus module is loaded only through a runtime-only server path from `safety-reference-catalog`.
