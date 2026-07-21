# SafeClaw Hermes / OpenClaw Runtime Current Gate

Checked at: 2026-07-21T22:36:02.691Z

## Verdict

The Hermes/OpenClaw runtime architecture is green at the adapter, policy, service-auth, route, and fail-closed boundary level.

Live production runtime execution is still not claimed. The live `/api/agent/chat` route requires authentication before engine execution, and production local OpenClaw mode remains closed without a proven site/org binding attestation. Remote Hermes service execution requires the configured gateway, service assertion, replay ledger, tenant binding, and terminal ledger gates.

## Authority

- Source SHA for focused tests: `00754eaf792223b9e1063fefd030c56237dbbb6e`
- Production build-info observed during live smoke: `00754eaf792223b9e1063fefd030c56237dbbb6e`
- Live deployment URL: `safeguard-contest-3x2i32c6h-seojaehongs-projects.vercel.app`
- Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\recipient-foreign-live-gate-20260720`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## Verification

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\openclaw-broker-ui-context.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-service-auth.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-provider-policy.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000
```

Result:

- Test files: 13 passed / 13
- Tests: 289 passed / 289
- Duration: 13.80s

Live unauthenticated broker smoke:

```powershell
Invoke-WebRequest -Uri https://www.safeclaw.kr/api/agent/chat -Method Post -ContentType 'application/json' -Body '{"message":"status"}' -TimeoutSec 20 -SkipHttpErrorCheck
```

Result:

- HTTP: 401
- Code: `AUTH_REQUIRED`
- Content length: 46 bytes
- Engine execution: not reached

## Current Runtime Boundary

- `ai-provider-policy.ts` remains a model provider policy for structured deliverables, not the Hermes/OpenClaw runtime switch.
- `EngineAdapter` owns runtime mode selection: `disabled`, `local-openclaw`, `experimental-hermes`, `remote-hermes`.
- Production local OpenClaw mode still uses a fail-closed site-binding verifier.
- Remote Hermes service-auth tests cover assertion TTL, future skew, replay consumption, binding, key window, signature checks, timeout, and abort behavior.
- Live execution still requires an authenticated owned site context and runtime-specific attestation.

## Interpretation

This is the correct current state for launch safety: SafeClaw can demonstrate that Hermes/OpenClaw is integrated as a bounded adapter path, while avoiding the false claim that a production Hermes worker pool or local OAuth runtime is fully operational inside Vercel.

The next proof requires an authenticated operator-owned test site plus a configured remote/local runtime that can pass availability, tenant binding, tool-denial, Evidence Harness, and terminal-ledger gates without exposing secrets.

## Evidence

- Prior runtime readiness surface: `evaluation/engine-runtime-readiness-2026-07-16/report.md`
- Remote service-auth remediation: `evaluation/remote-hermes-service-auth-2026-07-17/report.md`
