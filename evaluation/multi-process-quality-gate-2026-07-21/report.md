# Multi-Process Workpack Quality Gate - 2026-07-21

## Verdict

PASS for the current bounded gate.

The current generation contracts and deterministic DB harness path preserve explicit multi-process work instead of collapsing it into one generic process. This gate is focused on the prior product concern: a question such as "굴착, 토사반출, 자재양중" must produce process-specific risk rows and not borrow adjacent process evidence.

## Scope

- Worktree: `recipient-foreign-live-gate-20260720`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- HEAD: `f0b2ab37aba288d82cc62a60196187b32bfa12e2`
- Product code changes in this gate: none
- DB/schema/Supabase writes: none
- Production API generation call: not claimed

## What This Gate Proves

- The structured risk-row prompt explicitly switches from fixed 5-7 rows to per-process coverage when two or more processes are named.
- Deterministic DB harness risk rows preserve the explicit labels `굴착`, `토사반출`, and `자재양중`.
- Each explicit process receives at least two rows in the deterministic harness gate.
- Process rows remain tied to process-specific evidence and do not borrow an adjacent process accident case just because a summary mentions another process.
- When process-specific direct evidence is ambiguous or absent, deterministic fallback rows use process-specific controls instead of generic scaffold rows.

## Verification

```text
npm.cmd test -- tests\commercial-harness.test.ts
Test Files  1 passed (1)
Tests       59 passed (59)
```

```text
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts
Test Files  1 passed (1)
Tests       13 passed (13)
```

Relevant test coverage:

- `tests/commercial-harness.test.ts`
  - preserves explicit multi-process labels in deterministic DB harness risk rows
  - keeps deterministic multi-process rows tied to process-specific evidence
  - does not use another explicit process accident case just because its summary mentions the current process
  - does not use mixed-process accident cases as the default row for a different explicit process
  - uses process-specific deterministic fallback controls when direct process evidence is ambiguous
- `tests/ai-deliverables-generation-trace.test.ts`
  - requires per-process risk row coverage for explicit multi-process work

## Remaining Boundaries

This gate does not claim a live model-quality comparison, production `/ask` call, or export rendering test. It proves the current prompt contract and deterministic harness path that protect multi-process workpack generation.

The next UI/IA wave remains separate: Documents manager-cockpit and route/disclosure architecture should not be mixed into this quality gate.
