# DB Harness Retrieval Contract Report

Date: 2026-07-09
Branch: `feature/backend-harness-gate`

## Decision

SafeClaw generation should keep the DB harness as the source of truth and carry the retrieval path inside the harness packet.
The LLM layer can naturalize fixed evidence, but it should not hide whether the evidence came from REST text search, ranked RPC, or the approved vector RPC.

## Implemented Contract

`DbHarnessPacket` now includes `retrievalContract`.

The contract records:

- source: `safety_reference_items`
- retrieval mode: `unconfigured`, `rest-ilike`, `ranked-rpc`, or `hybrid-vector-rpc`
- vector state: enabled, attempted, ready, reason, and message
- source counts: direct evidence, SIF cases, supporting evidence, rest, ranked, vector, and hybrid
- message from the underlying retrieval path

## Why This Matters

Before this change, `searchSafetyReferences` knew whether SIF vector retrieval was active, but `DbHarnessPacket` only received the final references.
That made the generation harness less auditable.

After this change:

- `/workspace` generation can show whether the DB harness used ranked search or approved vector retrieval.
- OpenClaw/Codex `run_safeclaw_harness_agent` returns the same retrieval contract.
- `qualityContract.dbHarness` preserves the retrieval contract for product QA.
- `buildHarnessPromptContext` tells the naturalization model the retrieval path and source counts.

## Current Runtime Meaning

The current SIF approval gate still says:

- corpus ready: yes
- full embedding generated: no
- DB upload verified: no
- vector search usable: no
- next gate: `apply-sif-only-migration`

Therefore the current production-safe behavior remains ranked/text retrieval.
After SIF-only migration, full embedding upload, row count verification, and RPC smoke test, enabling `SAFETY_REFERENCE_VECTOR_SEARCH=1` will cause the harness retrieval contract to report `hybrid-vector-rpc`.

## Verified

Commands:

```powershell
npm.cmd test -- tests\commercial-harness.test.ts tests\mcp-tools.test.ts tests\quality-contract.test.ts tests\safety-reference-hybrid.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- targeted tests: 4 files, 43 tests passed
- typecheck: passed
- build: passed

No DB migration, embedding generation, upload, or feature flag activation was performed.
