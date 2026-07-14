# Hermes/OpenClaw EngineAdapter 24h Audit

Date: 2026-07-14
Authoritative base: `01ba1c924e5ab19803bdb86527fce9eccfc1ab60`
Worktree: `.worktrees/hermes-engine-adapter-24h-20260714`
Branch: `feat/hermes-engine-adapter-24h-20260714`

## Verdict

Hermes belongs behind a versioned engine-runtime contract, not in the model
provider policy. The implemented slice is suitable for a local experimental
composition only. It does not authorize production traffic, direct database
access, mutation, document publication, or customer service authentication.

SafeClaw MCP, the DB Evidence Harness, and the authenticated site context remain
the product fact and effect authority. Existing OpenClaw, Vertex, Anthropic,
and OpenAI paths remain in place.

## Boundary Audit

| Boundary | Evidence | Audit result |
| --- | --- | --- |
| Model provider policy | `lib/ai-provider-policy.ts:10-27`, `lib/ai.ts:270-381` | Structured deliverables choose only Vertex or Anthropic. Existing Vertex-to-OpenAI fallback stays separate. Hermes/OpenClaw are not provider values. |
| Agent/chat | `lib/openclaw-broker-route.ts:99-167`, `lib/agent-loop.ts:89-96` | Authentication and owned-site resolution occur before engine preflight/run. The shared prompt fixes DB-harness use and human field confirmation. |
| OpenClaw runtime | `lib/openclaw-chat.ts:22-65`, `lib/openclaw-chat.ts:447-480`, `lib/openclaw-broker-route.ts:64-83` | OpenAI OAuth is required. Site binding and execution attestation fail closed. The existing local OpenClaw path remains available and unchanged in authority. |
| MCP interceptor | `lib/mcp-scoped-tool.ts:49-67`, `lib/mcp-auth.ts:49-59`, `lib/mcp-auth.ts:119-140` | Tool registration enforces authenticated scopes. Read and write tool sets are explicit. Hermes intents reuse the same read classification. |
| MCP write effects | `app/api/mcp/[transport]/route.ts:267-363` | Both document-generation tools can persist a workpack for a site-bound request. Hermes therefore cannot request either tool, even with human confirmation. |
| DB Evidence Harness | `lib/db-harness.ts:150-155`, `lib/db-harness.ts:351-356`, `lib/db-harness.ts:740-742` | The LLM role is naturalization only, evidence authority is the DB harness, and generic/fallback substitution is prohibited. |
| Local OAuth POC | `C:/Users/iceam/safeclaw-openclaw-poc/package.json` | Separate local package uses OpenClaw. Its `.env` contents were intentionally not read. No customer traffic service-auth implementation is present. |

## Implemented Contract

- `engine-adapter/v1` identifies engine runtime, capabilities, and authority.
- `SAFECLAW_ENGINE_MODE=experimental-hermes` additionally requires
  `SAFECLAW_HERMES_LOCAL_POC=1` and is disabled on Vercel.
- The application composition remains unavailable when no local Hermes planner
  and SafeClaw-owned read executor are injected.
- Hermes receives tenant context, prompt, cancellation, text-only streaming, and a
  read-only tool-intent callback. It receives no Supabase client, MCP token,
  write callback, or publish callback.
- Unknown tools, `generate_reviewed_safety_docpack`, and
  `generate_safety_docpack` fail before the executor.
- `run_safeclaw_harness_agent` remains a valid read path and receives the
  authenticated organization/site/user context through the executor request.
- Engine authority declares no mutation or publish authority and requires human
  confirmation.

## Deferred

- Customer traffic service authentication using a project service account or
  workload identity.
- Secret rotation, tenant-bound worker authorization, deployment, and runtime
  attestation for a Hermes service.
- Resume, trajectory parity, effect receipts, idempotent failover, and promotion
  to a production/default runtime.
- Any database migration, schema change, backfill, or data mutation.

## Verification

- Pre-change baseline: 7 test files, 98 tests passed.
- TDD RED/GREEN: local mode gate, version/authority metadata, MCP read
  classification, Hermes adapter module, and production composition boundary.
- Focused final regression: 12 test files, 176 tests passed.
- TypeScript strict typecheck: passed.
- Full suite: 141 test files total; 134 passed, 2 failed, and 5 skipped. Of
  1,427 tests, 1,418 passed, 2 failed, and 7 skipped in 1,230.81 seconds.
- Full-suite failure 1 was the authoritative frontend evidence source identity:
  checked-in `cf3acf32...` versus current `9eab4b0b...`. This identity excludes
  every file changed by this round, so the mismatch predates this branch.
- Full-suite failure 2 was a browser save-status timing assertion. Its isolated
  rerun passed: 1 test passed and 19 skipped in 28.62 seconds.
- After narrowing the planner surface to `emitText`, the focused 176-test suite
  and strict typecheck were rerun and passed.
- Build: not run; this round requested tests and evaluation.

Local logs:

- `evaluation/hermes-engine-adapter-24h-20260714/focused-tests.log`
- `evaluation/hermes-engine-adapter-24h-20260714/typecheck.log`
- `evaluation/hermes-engine-adapter-24h-20260714/browser-save-status-rerun.log`
