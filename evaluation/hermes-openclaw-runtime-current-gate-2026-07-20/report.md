# SafeClaw Hermes / OpenClaw Runtime Current Gate

Checked at: 2026-07-22T22:49:50.468Z

## Verdict

The Hermes/OpenClaw runtime architecture is green at the adapter, policy, service-auth, route, and fail-closed boundary level when the verdict is `adapter_boundary_pass_live_execution_not_claimed`.

Live production runtime execution is still not claimed. The live `/api/agent/chat` route must require authentication before engine execution, and production local OpenClaw mode remains closed without a proven site/org binding attestation. Remote Hermes service execution requires the configured gateway, service assertion, replay ledger, tenant binding, and terminal ledger gates.

## Authority

- Source SHA for focused tests: `4fe73315c156f7398aea76ca86d9e90579e79e7f`
- Production build-info observed during live smoke: `4fe73315c156f7398aea76ca86d9e90579e79e7f`
- Live deployment URL: `safeguard-contest-aj76j8cr3-seojaehongs-projects.vercel.app`
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\recipient-foreign-live-gate-20260720`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## Verification

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\openclaw-broker-ui-context.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-service-auth.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-provider-policy.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000 --hookTimeout=180000
```

Result:

- Test files: 13 passed / 13
- Tests: 289 passed
- Duration: 16.11s
- Status: `pass`

Live unauthenticated broker smoke:

```powershell
Invoke-WebRequest -Uri 'https://www.safeclaw.kr/api/agent/chat?codexCacheBust=...' -Method Post -ContentType 'application/json' -Body '{"messages":[{"role":"user","content":"ping"}]}' -SkipHttpErrorCheck
```

Result:

- HTTP: 401
- Code: `AUTH_REQUIRED`
- Content length: 64 bytes
- Engine execution: not reached
- Smoke status: `pass`

## Current Runtime Boundary

- `ai-provider-policy.ts` remains a model provider policy for structured deliverables, not the Hermes/OpenClaw runtime switch.
- `EngineAdapter` owns runtime mode selection: `disabled`, `local-openclaw`, `experimental-hermes`, `remote-hermes`.
- Production local OpenClaw mode still uses a fail-closed site-binding verifier.
- Remote Hermes service-auth tests cover assertion TTL, future skew, replay consumption, binding, key window, signature checks, timeout, and abort behavior.
- Live execution still requires an authenticated owned site context and runtime-specific attestation.

## Non-Actions

- DB mutation performed: `false`
- Provider dispatch live claimed: `false`
- Engine execution claimed: `false`
- Live authenticated execution performed: `false`

## Interpretation

This is the correct current state for launch safety: SafeClaw can demonstrate that Hermes/OpenClaw is integrated as a bounded adapter path, while avoiding the false claim that a production Hermes worker pool or local OAuth runtime is fully operational inside Vercel.

The next proof requires an authenticated operator-owned test site plus a configured remote/local runtime that can pass availability, tenant binding, tool-denial, Evidence Harness, and terminal-ledger gates without exposing secrets.
