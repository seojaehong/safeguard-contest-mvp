# Phase A Canonical Product Materialization

## Scope

- Base commit: `530efbfafb30c6145c1536172b260ff644845846`
- Branch: `feat/phase-a-canonical-workpack-materialization-20260716`
- Initial Phase A commit: `a523e56e912da95bab24153356da8191193b6bd0`
- Database and migrations: unchanged
- Ontology publication: not performed
- Runtime search path: unchanged

## Integration Reconciliation

- Fetched integration tip: `origin/feat/northstar-24h-integration-20260715` at `68cc9c5`.
- Authoritative integration sequence after the requested base: `530efbf` -> `2065e5e` -> `6277896` -> `68cc9c5`.
- The owned core blobs in `evidence-chain.ts`, `product-materialization.ts`, and `search.ts` are unchanged between `530efbf` and `68cc9c5`; no integration commit needed to be cherry-picked or rebased into this isolated branch.
- Follow-up `352bd56` restored `materializePhaseAProductDocuments` as the document/structured-row projection path and kept `materializePhaseAProductIntoResponse` as the compatibility entry point used by existing Claw and MCP callers.
- The older implementation that appended synthetic scored risk rows was not restored.

## Implemented Contract

- Runtime evidence packs are validated against the canonical Phase A registry before product projection, including runtime node/edge states, law authority/effective date/article overlays, complete KOSHA and SIF overlays, and the complete pipeline stages/provider fallback contract.
- Chain, task, hazard, control, SIF, mapped KOSHA chunk provenance, and law provenance are preserved.
- Each canonical control produces one deterministic risk-assessment review row and one deterministic TBM review row.
- Every projected row remains `review_required`; `verifiedDocumentRows` stays empty and human confirmation stays pending.
- Product projection does not create likelihood, severity, or risk-level values. Existing provider rows are only review-marked when their `controlId` matches a canonical control; their pre-existing score fields are preserved unchanged.
- Forged valid-shape task, SIF, control, KOSHA, law, runtime graph, overlay, pipeline-stage, provider-fallback, review-state, and stable-key mutations fail closed.
- Deterministic prose suppression requires a complete SafeClaw-owned start/end marker block whose stable key and complete body match the current canonical rendering. Provider stable-key text and incomplete marker blocks cannot suppress insertion.
- The exported document materialization boundary rebuilds the expected product from canonical registry identity and compares the complete product, including schema, chain, stable keys, controls, nested provenance, review authority, and coverage. Direct forged-product mutations fail closed.
- MCP response, persisted evidence summary, and tenant-scoped reopen payload preserve the same Phase A product.

## Verification

| Check | Result |
| --- | --- |
| Focused materialization/runtime/MCP/Claw tests | PASS, 4 files / 68 tests |
| Reviewed-route task-binding tests | PASS, 1 file / 7 tests; stale null-product expectation now requires canonical `work-at-height-fall` provenance |
| Related ontology evidence-chain tests | PASS, 1 file / 61 tests |
| TypeScript strict typecheck | PASS |
| `git diff --check` | PASS |
| Ownership diff check | PASS, 5 remediation files including the reviewer-confirmed stale route test and this report; no DB, migration, ontology publication, or search changes |

## Materialization Counts

| Canonical chain | Controls | Risk-assessment review rows | TBM review rows | Verified rows |
| --- | ---: | ---: | ---: | ---: |
| `work-at-height-fall` | 3 | 3 | 3 | 0 |
| `vehicle-machinery-entrapment` | 1 | 1 | 1 | 0 |
| `electrical-work-electrocution` | 5 | 5 | 5 | 0 |

Total deterministic review rows across the canonical registry: 18.
