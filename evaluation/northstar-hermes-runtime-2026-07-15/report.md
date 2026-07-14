# Northstar Hermes Runtime Remediation

## Scope

- Base: `dc608c8d7f7f854270669e05789cad88816d0f43`
- Branch: `fix/northstar-hermes-runtime-20260715`
- Route: `/api/agent/chat`
- No secrets, database changes, migrations, or provider fallback changes were added.

## Result

The production adapter factory can now construct an isolated OpenClaw-backed Hermes composition from environment configuration. It remains unavailable unless all of these checks succeed:

1. `experimental-hermes` local POC mode is enabled outside Vercel.
2. The authenticated organization and site exactly match the configured runtime binding.
3. The OpenClaw executable is available.
4. The selected OpenClaw agent has an explicit `tools.allow=[]` and `tools.deny=["*"]` policy.
5. The selected profile passes the existing OpenAI OAuth-only runtime check.

The existing Hermes adapter still preloads and validates `run_safeclaw_harness_agent` before planner execution. OpenClaw receives only the validated packet under a `naturalize_only` contract. Mutation, publication, and implied human confirmation remain forbidden; the EngineAdapter authority still requires human confirmation. Existing Vertex/Anthropic provider fallback files were not changed.

## TDD Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED | `npm.cmd test -- --run tests/hermes-engine-adapter.test.ts` | Exit 1; 33 tests, 20 passed, 13 failed. All 3 new runtime tests failed as expected; 10 pre-existing fixture failures exposed stale KOSHA provenance data. |
| GREEN focused | `npm.cmd test -- --run tests/hermes-engine-adapter.test.ts tests/openclaw-chat.test.ts tests/claw-chat-route.test.ts tests/engine-adapter.test.ts --reporter=dot` | Exit 0; 4 files, 79 tests passed. |
| Strict typecheck | `npm.cmd run typecheck` | Exit 0. |
| Normal build | `npm.cmd run build` | Exit 0; Next.js 15.5.20 production build includes `/api/agent/chat`. |
| Browser retry after build | `npm.cmd test -- --run tests/product-module-shell.test.ts tests/reports-download-center.test.ts tests/reports-wave1-publish-support.test.ts --maxWorkers=1 --reporter=dot` | Exit 0; 3 files, 25 tests passed. |
| Diff check | `git diff --check` | Exit 0. |

The full test command completed with 142 files passed, 6 skipped, and 5 failed; 1,541 tests passed, 22 skipped, and 11 failed. Nine failures are existing KOSHA provenance fixture expectations, one is stale frontend evidence identity, and one was a parallel-load timeout. Two browser suites also failed against a stale/incomplete pre-build `.next`; all three affected browser files passed after a clean build with one worker. These failures were not suppressed or allowlisted.

## Runtime Blockers

- The current machine has OpenClaw CLI `2026.6.5` reading config written by `2026.6.11`; OpenClaw rejects that version mismatch.
- The current `safeclaw` profile has no explicit `agents.list` entry for the selected agent, so the required tool-free policy cannot be attested.
- Runtime binding values must be supplied for `SAFECLAW_HERMES_BOUND_ORGANIZATION_ID` and `SAFECLAW_HERMES_BOUND_SITE_ID` together with the existing local Hermes/OpenClaw mode values.
- Vercel remains intentionally ineligible for local Hermes execution.
- No live OpenClaw answer was executed because the local attestation prerequisites are not currently satisfied. The adapter fails closed instead.
