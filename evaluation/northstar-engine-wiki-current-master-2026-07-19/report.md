# SafeClaw North Star Engine/Wiki Current Master Gate

Date: 2026-07-19
Authoritative local HEAD: `df26c626e65b40ffed7b46b33011409b17630c82`
Live build-info commit at check time: `df26c626e65b40ffed7b46b33011409b17630c82`

## Verdict

Current master preserves the intended North Star boundary:

- SafeClaw MCP/DB Evidence Harness is still the system of record.
- Hermes/OpenClaw is an engine-runtime concern behind `EngineAdapter`, not an `ai-provider-policy` model-provider branch.
- The production agent chat route is wired through `createProductionEngineAdapter(...)`, but live `/ops/api` reports the execution engine as disabled/connected-before-use, not live Hermes.
- LLM Wiki / knowledge generation remains candidate-only. Published ontology mutation and public knowledge promotion require human review plus separate RLS/RPC approval.
- No DB migration, schema change, publication RPC, or runtime cutover was performed by this gate.

This means the long-term direction is aligned, but the completed product claim must stay precise:

> SafeClaw is evidence-harness-first today. Hermes/OpenClaw is the guarded future planner-runtime path, not the current source of truth.

## Current Source Evidence

### Provider Policy

`lib/ai-provider-policy.ts` only selects structured deliverable model providers:

- default: `vertex`
- optional pilot: `anthropic`
- Hermes/OpenClaw flags are not accepted as model providers.

This preserves the split between model fallback and planner-runtime selection.

### Engine Adapter

`lib/engine-adapter.ts` defines:

- `ENGINE_ADAPTER_CONTRACT_VERSION = "engine-adapter/v1"`
- runtime modes: `disabled`, `local-openclaw`, `experimental-hermes`, `remote-hermes`
- authority:
  - `systemOfRecord: "safeclaw-mcp-db-harness"`
  - `toolExecutionBoundary: "safeclaw-mcp-interceptor"`
  - `canMutate: false`
  - `canPublish: false`
  - `humanConfirmationRequired: true`

Local Hermes requires `SAFECLAW_HERMES_LOCAL_POC=1` and is disabled on Vercel.
Remote Hermes can resolve as a mode, but runtime readiness keeps execution false until trusted transport and attempt ledger gates are present.

### Production Agent Route

`app/api/agent/chat/route.ts` constructs:

```ts
createProductionEngineAdapter(process.env, {
  openClawHermes: { trustedKoshaReference: isProductionTrustedKoshaReference },
  remoteHermes: { trustedKoshaReference: isProductionTrustedKoshaReference }
})
```

So the product route uses the guarded adapter boundary, not a direct Hermes worker or direct DB runtime.

### Ops Surface

Live `/ops/api` on desktop and mobile shows:

- execution engine: `연결 전`
- connection state: `비활성`
- evidence authority: `SafeClaw 고정`
- human confirmation: `항상 필요`

No secrets, bearer tokens, or API key fragments were visible in the page text.

### Knowledge / LLM Wiki Boundary

`docs/adr/0002-knowledge-promotion-provenance-boundary.md` and `lib/knowledge-governance.ts` preserve the four-stage contract:

1. `knowledge_event`
2. `candidate`
3. `human_review`
4. `published_ontology`

Hermes/LLM has `authority: "none"`, `scope: "candidate_only"`, `dbMutationAllowed: false`, and `publishAllowed: false`.

The existing `evaluation/llm-wiki-rls-approval-2026-07-17/report.md` remains a RED approval packet for actual publication infrastructure. It explicitly requires approved DDL/RLS/RPC/service identity/live isolation before publication can be enabled.

## Verification

### Focused Engine + Knowledge Gate

Command:

```powershell
npm.cmd test -- tests\ai-provider-policy.test.ts tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\engine-runtime-readiness-policy.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-service-auth.test.ts tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\llm-wiki-rls-approval-packet.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: `12 passed`
- Tests: `200 passed`

### Live Ops Browser Check

Command:

```powershell
node -e "... playwright /ops/api desktop+mobile check ..."
```

Result:

Desktop 1440x900:

- `clientWidth=1440`
- `scrollWidth=1440`
- `hasEngine=true`
- `hasSafeClawFixed=true`
- `hasNoSecret=true`

Mobile 390x844:

- `clientWidth=390`
- `scrollWidth=390`
- `hasEngine=true`
- `hasSafeClawFixed=true`
- `hasNoSecret=true`

Visible live text includes:

```text
실행 엔진
연결 전
연결 상태
비활성
근거 권한
SafeClaw 고정
사람 확인
항상 필요
```

## Demo-Safe Language

Use:

> SafeClaw fixes SIF/KOSHA/law/work-history evidence first. Hermes/OpenClaw is connected as a guarded planner-runtime path behind SafeClaw's EngineAdapter, while SafeClaw remains the system of record and any knowledge promotion stays human-reviewed.

Avoid:

- `Hermes is live`
- `LLM Wiki updates itself`
- `OpenClaw learns automatically`
- `runtime can publish ontology`
- `runtime can write DB facts`
- `customer OAuth Hermes is production-ready`

## Remaining North Star Work

The next real promotion work is still:

1. durable job queue / attempt ledger / terminal receipt persistence,
2. trusted remote Hermes transport and service auth in a real deployment,
3. tenant-isolated runtime state, retrieval, trace, resume, and failover tests,
4. human-confirmed export receipt binding,
5. approved LLM Wiki publication schema/RPC/RLS canary,
6. OpenClaw/Hermes parity corpus with no effect duplication.

This report keeps the active objective intact: the direction is correct, but the current product is not yet the autonomous Hermes + LLM Wiki North Star.
