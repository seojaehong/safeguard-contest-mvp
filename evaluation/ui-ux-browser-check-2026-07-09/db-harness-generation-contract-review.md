# DB Harness Generation Contract Review

Generated: 2026-07-09

## Purpose

This update tightens the commercial SafeClaw generation contract so the visible judgment and practical actions do not fall back to generic LLM prose when DB/SIF/KOSHA/work-history evidence is missing.

## What Changed

- `buildDbHarnessAnswer` now accepts only a `DbHarnessPacket`.
- When the harness has no direct evidence, SIF case, control, or improvement memory, the answer stays in a harness-owned "evidence missing" state.
- Generic answer text is no longer accepted as a secondary source for the visible judgment summary.
- `buildDbHarnessPracticalPoints` now uses only:
  - controls fixed by SIF/direct evidence/improvement memory,
  - required document linkage,
  - missing evidence actions.
- `runAsk` no longer passes legacy answer/practical point text into the DB harness summary builders.
- AI deliverable non-response detail now says `하네스 템플릿 보강` instead of a template fallback path.

## Why This Matters

The target architecture is DB Evidence Harness first, not a simple LLM fallback chain. If evidence retrieval is weak or unavailable, SafeClaw should show a review-required state and missing evidence actions. It should not silently replace the missing harness result with plausible generic prose.

## Current Boundary

This change does not remove template mode itself. Explicit `AI_MODE=template` remains a no-external-call path for local/static operation. The commercial generation path still needs a later pass to decide whether template mode should also build a DB harness packet when Supabase is configured.

## Verification

Command:

```powershell
npm.cmd test -- tests/commercial-harness.test.ts tests/quality-contract.test.ts tests/answer-panel-display.test.ts tests/ontology-graph-store.test.ts tests/ontology-schema.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Result:

- 5 test files passed
- 29 tests passed
- Typecheck passed
- Production build passed

New regression:

- `does not fall back to generic LLM prose when the DB harness has no evidence`

## Remaining Follow-Up

- Add integration-level coverage for `/api/ask` proving `dbHarness.promptContext` is created before AI deliverable prompts in enhanced/full mode.
- Decide whether explicit template mode should remain a pure static no-external-call mode or become a DB-harness-template mode when Supabase is configured.
- Continue keeping internal terms such as provider retry, API key, timeout, and fallback out of user-facing answer panels.
