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
- The application composition remains unavailable unless the local Hermes
  planner is wrapped by `createSafeClawHermesComposition`.
- That factory creates the read executor internally. Each supported read tool
  is registered by `registerScopedTool`, invoked with broker-derived
  `tools:read` site/org context, and returned through the same scope
  interceptor used by the MCP route.
- Before planner execution, the adapter invokes `run_safeclaw_harness_agent`
  exactly once and validates successful SIF and KOSHA search lanes, non-empty
  grounded SIF and verified-current KOSHA evidence, retrieval counts/status,
  ready ontology, required arrays, and complete document coverage. A shaped
  `naturalize_only` packet alone is insufficient.
- Packet question must equal the trimmed current prompt. The adapter clones,
  recursively freezes, canonicalizes, and SHA-256 attests the validated packet
  before planner execution. Retrieval, shape, grounding, or question failure
  prevents planner invocation and output.
- Planner text must return packet content whose digest equals the attested
  digest. Object identity is irrelevant; same-content clones pass, while
  mutation, partial content, or a different question fails before text emit.
- Hermes receives broker-authenticated tenant context, prompt, cancellation,
  packet-attested text streaming, and a read-only tool-intent callback. It
  receives no Supabase client, MCP token, write callback, or publish callback.
- Unknown tools, `generate_reviewed_safety_docpack`, and
  `generate_safety_docpack` fail before the executor.
- `run_safeclaw_harness_agent` is reserved for the mandatory adapter preload;
  planner-requested re-entry fails before the executor.
- Harness auth attribution records broker-authenticated organization/site
  scope. It is not token-bound, and no user identity propagation is claimed
  because user identity is not passed into the MCP auth context.
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

### Prior P2/P3 RED Evidence

1. Arbitrary executor injection:

   `npm.cmd test -- tests/hermes-engine-adapter.test.ts -t "rejects an arbitrarily injected" --maxWorkers=1 --no-file-parallelism`

   Exit `1`; 1 test failed and 7 tests were skipped. Failure: the production
   composition accepted the forged executor instead of throwing.

2. Scoped Harness attribution:

   `npm.cmd test -- tests/hermes-engine-adapter.test.ts -t "routes the Evidence Harness" --maxWorkers=1 --no-file-parallelism`

   Exit `1`; 1 test failed and 8 tests were skipped. The Harness packet was
   present, but auth was `source=none`, `siteId=null`, `orgId=null`, and
   `tokenBound=false`.

### Fresh Review RED Evidence at `cb11ad11`

1. Mandatory preload order: planner received no `evidencePacket`; 1 failed and
   9 skipped.
2. Harness retrieval failure: raw executor error escaped instead of a broker
   failure; 1 failed and 10 skipped.
3. Output packet gate: planner text without packet proof resolved and emitted;
   1 failed and 11 skipped.
4. Auth attribution: result claimed `source=db` and `tokenBound=true` instead
   of broker-authenticated site/org scope; 1 failed and 12 skipped.
5. Harness re-entry: planner could request a second harness call; 1 failed and
   13 skipped.

Each case was run independently with the matching test title in
`tests/hermes-engine-adapter.test.ts` before its implementation change. That
remediation checkpoint had 14 passing behavior tests.

### Fresh Independent Review RED Evidence at `b5ee3de`

The independent review rejected `b5ee3de` with two P2 findings. Five isolated
RED executions were observed before implementation:

1. Empty shaped packet resolved and called planner; 1 failed and 14 skipped.
2. Required SIF search with `ok=false` resolved and called planner; 1 failed
   and 15 skipped.
3. Grounded packet for another question resolved and called planner; 1 failed
   and 16 skipped.
4. Planner mutated the same packet object and emitted text; 1 failed and 17
   skipped.
5. Packet with missing nested retrieval status resolved and called planner; 1
   failed and 22 skipped.

Additional GREEN behavior tests cover top-level partial packet, unresolved
KOSHA grounding, different-question output, and same-content clone acceptance.
The final Hermes test file has 24 passing tests, including trimmed-prompt
normalization.

### P2/P3 Final GREEN Evidence

| Check | Reproducible command | Exit | Result |
| --- | --- | ---: | --- |
| Focused tests | `npm.cmd test -- tests/hermes-engine-adapter.test.ts tests/engine-adapter.test.ts tests/ai-provider-policy.test.ts tests/ai-generation-trace.test.ts tests/ai-deliverables-generation-trace.test.ts tests/claw-chat-route.test.ts tests/openclaw-chat.test.ts tests/agent-loop.test.ts tests/mcp-auth.test.ts tests/mcp-route-scope-contract.test.ts tests/mcp-tools.test.ts tests/commercial-harness.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 12 files passed; 193 tests passed; 0 failed; 20.73 s |
| TypeScript strict | `npm.cmd run typecheck` | 0 | `tsc --noEmit --incremental false` passed |
| Production build | `npm.cmd run build` | 0 | Next.js 15.5.20; compiled in 14.4 s; static pages 27/27 |

Tracked command output is in `focused-final.txt`, `typecheck-final.txt`, and
`build-final.txt` beside this audit. The evidence does not cite gitignored or
untracked log files.

### Prior Full-Suite Context

The pre-remediation full suite had 141 test files: 134 passed, 2 failed, and 5
skipped. Of 1,427 tests, 1,418 passed, 2 failed, and 7 skipped in 1,230.81
seconds. One failure was the authoritative frontend evidence source identity
(`cf3acf32...` checked in versus `9eab4b0b...` current); that identity excludes
all files changed by this engine round. The other was a browser save-status
timing assertion whose isolated rerun passed 1/1.
