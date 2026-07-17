# North Star Engine / Wiki Boundary Check

Date: 2026-07-18

## Scope

This check verifies the current SafeClaw `master` boundary for the long-term
North Star track:

- Hermes/OpenClaw are agent runtime consumers behind SafeClaw-owned contracts.
- SafeClaw MCP, Supabase, and the Evidence Harness remain the system of record.
- LLM Wiki / knowledge updates remain candidate and human-review gated, not
  automatic publication or product-fact mutation.

No database schema, production data, provider settings, or runtime credentials
were changed.

## Current Source Head

- Commit: `77ef360c`
- Branch: `master`
- Prior CI: `29620735422` PASS

## Architecture Evidence

Relevant source-of-truth documents:

- `ARCHITECTURE_DECISIONS.md`
- `docs/adr/0001-agent-runtime-boundary.md`
- `docs/adr/0002-knowledge-promotion-provenance-boundary.md`
- `docs/agent-runtime-long-term-roadmap.md`

Confirmed boundary:

- Hermes is not the current product core.
- Hermes may become the primary planner runtime only after the Phase 4 promotion gate.
- OpenClaw remains the parity oracle, compatibility runtime, and failover path.
- Hermes/OpenClaw never own product facts or write directly to Supabase/Postgres.
- LLM/wiki output is candidate-only until human review and graph/provenance validation.

## Engine / MCP Focused Gate

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\engine-runtime-readiness-policy.test.ts tests\hermes-engine-adapter.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-service-auth.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\mcp-route-scope-contract.test.ts tests\mcp-auth.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS

- Test files: 12/12 passed
- Tests: 256/256 passed

Coverage intent:

- EngineAdapter mode and readiness boundary
- Local Hermes/OpenClaw containment
- Remote Hermes request/response contract
- Pinned transport and service-auth boundary
- MCP route scope and authentication boundary

## Knowledge Promotion / LLM Wiki Focused Gate

Command:

```powershell
npm.cmd test -- tests\knowledge-review-prepare.test.ts tests\knowledge-review-prepare-route.test.ts tests\knowledge-review-route.test.ts tests\knowledge-review-actions.test.ts tests\knowledge-promotion-gate.test.ts tests\knowledge-review-inbox-browser.test.ts tests\knowledge-runtime-smoke.test.ts tests\llm-wiki-rls-approval-packet.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS

- Test files: 8/8 passed
- Tests: 100/100 passed

Coverage intent:

- Stateless candidate generation boundary
- Stored prepare path guarded by authenticated review
- Review action receipts without ontology publication
- UI inbox does not expose raw tenant event payloads
- LLM wiki/RLS approval packet remains proposal-only

## Combined Focused Evidence

- Test files: 20/20 passed
- Tests: 356/356 passed

## Non-Claims

This check does not claim:

- Hermes is production enabled.
- Customer traffic is using Hermes.
- LLM Wiki publication is implemented.
- A DB migration, schema change, or public corpus promotion is approved.

It proves only that the current code and tests preserve the agreed boundary
while the long-term engine/wiki roadmap remains active.
