# SafeClaw C4 generation-evidence integrity

Date: 2026-07-10
Base commit: `275eb65`

## Implemented contract

- `/api/ask` and `/api/ask/stream` attach a versioned `safeclaw-generation-evidence/v1` envelope.
- The HMAC-SHA256 signature covers canonical question, scenario, exact DB harness packet, generatedAt, and a SHA-256 response-content digest.
- The response-content digest binds the complete authoritative `AskResponse` payload. Only `generationEvidence` and `generationEvidenceError` are excluded to avoid self-reference.
- Workpack persistence verifies the signature and request payload equality before workspace context creation or insert.
- Verified envelope and snapshot data are stored in the existing `workpacks.evidence_summary` JSONB column.
- Legacy or unsealed workpacks remain non-shareable. MCP and briefing persistence also fail closed on unsealed evidence.
- Saved operation graphs and learning exports use generation-time snapshot references and generatedAt values.
- Fresh graph search is opt-in with `comparison=true` and is returned separately with `query`, `retrievedAt`, `mode=comparison_only`, and `not_used_for_generation=true`. Comparison items are not added to the authoritative graph.

## TDD evidence

RED failures were observed before implementation for:

- missing generation-evidence module and seal/verify functions;
- JSON and SSE responses without an envelope;
- unsealed, signature/payload-tampered workpack saves being accepted;
- catalog drift replacing generation-time graph/export references;
- fresh comparison references being mixed into the operation graph;
- legacy DB-harness workpacks lacking a generation seal reason;
- deliverable and ontology-QA mutation after sealing being accepted.
- answer, status, and evidence-label mutation after sealing being accepted.

Final focused command:

```text
npm.cmd test -- tests/generation-evidence.test.ts tests/ask-generation-evidence-routes.test.ts tests/workpack-generation-evidence-route.test.ts tests/generation-evidence-operation-routes.test.ts tests/workpack-store.test.ts tests/workpack-share-authority.test.ts tests/workpack-share-authority-routes.test.ts tests/workspace-operation-graph.test.ts tests/commercial-harness.test.ts tests/ask-progress.test.ts
```

Result: 10 test files passed, 77 tests passed.

Typecheck command:

```text
npm.cmd run typecheck
```

Result: exit code 0.

The full `npm.cmd test` run reached 603 passed and 17 skipped tests, with 12 failures across 7 files. The failures were separated from this C4 gate: browser suites collided on fixed ports 3227/3231/3233 and shared `.next` manifests, several browser assertions reflected concurrent UI changes, and three focused route tests exceeded the default timeout under that resource contention. The focused route tests passed when rerun in isolation.

## Environment requirement

Set a dedicated server-only `SAFECLAW_GENERATION_EVIDENCE_SECRET` on every generation, save, graph, and export runtime. Do not expose it through a `NEXT_PUBLIC_` variable or reuse an unrelated application secret. All instances that read previously saved workpacks must use the same value.

Missing configuration leaves local/template generation available with an explicit `generationEvidenceError`, while authoritative persistence, graph reconstruction, export, and sharing remain fail closed.

## Schema and migration limits

- No DB migration or data mutation was added or run. The implementation uses the existing `evidence_summary` JSONB column.
- Existing rows cannot be made authoritative by a schema-only migration or by copying current catalog data. They lack a server-time signature and must be regenerated through the sealed generation path.
- Secret rotation invalidates existing envelopes because v1 has no key identifier or multi-key verification window. Rotation requires an explicit key-version strategy before changing the production secret.
- Comparison retrieval is intentionally not generation evidence and cannot repair or replace a missing generation snapshot.
