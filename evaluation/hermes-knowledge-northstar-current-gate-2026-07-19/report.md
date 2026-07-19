# Hermes / OpenClaw / Knowledge North Star Current Gate

Date: 2026-07-19
Authoritative report commit: the commit containing this report file
Verified source base before this report commit: `b2fc86f0ed18a3e238bcd4327351567e302c32f0`
Live build-info at verification time: `b2fc86f0ed18a3e238bcd4327351567e302c32f0` on `master` / `production`

## Verdict

Current master supports the North Star as a guarded architecture path, not as a completed live autonomous engine.

What is verified now:

- SafeClaw MCP/DB Evidence Harness remains the system of record and effect authority.
- Hermes/OpenClaw selection is kept outside `ai-provider-policy`; it is an EngineAdapter/runtime concern.
- Remote Hermes requires endpoint allowlist, tenant allowlist, request signing, response verification, policy attestation, trusted transport, and attempt ledger before execution readiness.
- LLM/Hermes knowledge output is candidate-only. It cannot publish ontology, mutate DB state, or become legal/statutory authority without human review.
- Knowledge UI presentation no longer exposes the previously reported raw mobile labels as visible body text on the live `/knowledge` surface, per the separate live gate.

What is not claimed:

- No live Hermes worker pool is proven.
- No GPT OAuth PoC is claimed as active Phase A product capability.
- No direct Hermes/OpenClaw DB write, ontology publish, or effect execution is authorized.
- No external SMS/email/Kakao provider dispatch was re-proven by this gate.

## Focused Verification

Command:

```powershell
npm.cmd test -- tests\hermes-engine-adapter.test.ts tests\engine-runtime-readiness-policy.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-service-auth.test.ts tests\knowledge-governance.test.ts tests\knowledge-governance-ui-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 7 passed / 7
- Tests: 161 passed / 161
- Duration: 11.98s

## Evidence Map

- `ARCHITECTURE_DECISIONS.md` records the accepted boundary: SafeClaw MCP/DB/Evidence Harness is authority; Hermes/OpenClaw are future runtime adapters only.
- `docs/architecture/0003-engine-adapter-remote-hermes-boundary.md` records the remote Hermes boundary: central stateless worker pool, service authentication, no per-site OAuth copy, no direct DB/MCP/effect access.
- `lib/engine-runtime-readiness-policy.ts` keeps remote Hermes execution readiness false unless all contract requirements are present.
- `lib/remote-hermes-runtime.ts` requires HTTPS endpoint allowlist, tenant allowlist, signing/verification credentials, and policy attestation.
- `lib/hermes-engine-adapter.ts` projects only verified evidence claims into Hermes planner input and preserves immutable evidence-packet digestion.
- `lib/knowledge-governance.ts` marks Hermes/LLM as candidate-only with no DB mutation or publish authority.

## Submission Guidance

Use this wording for demo/submission:

> SafeClaw is built around an evidence harness first. Hermes/OpenClaw is designed as a future planner-runtime layer behind a versioned adapter. The current product already enforces the important boundary: verified SIF/KOSHA/legal/work-history evidence is fixed by SafeClaw, the model naturalizes within that packet, and any knowledge promotion remains human-reviewed.

Avoid this wording:

- "Hermes is live."
- "OpenClaw learns automatically."
- "LLM Wiki updates itself."
- "OAuth-based customer Hermes runtime is enabled."

## Remaining North Star Gates

- Phase B explicit approval before GPT OAuth PoC or service-auth Hermes worker implementation.
- Durable job queue, attempt ledger, effect receipt ledger, resume/failover tests.
- Tenant-isolated organization/site knowledge promotion workflow.
- External provider dispatch proof in the actual production provider environment.
