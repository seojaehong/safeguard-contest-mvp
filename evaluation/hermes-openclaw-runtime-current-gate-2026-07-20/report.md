# SafeClaw Hermes / OpenClaw Runtime Current Gate

Checked at: 2026-07-28T07:19:58.706Z

## Verdict

The Hermes/OpenClaw runtime architecture is green at the adapter, policy, service-auth, route, and fail-closed boundary level when the verdict is `adapter_boundary_pass_live_execution_not_claimed`.

Live production runtime execution is still not claimed. The live `/api/agent/chat` route must require authentication before engine execution, and production local OpenClaw mode remains closed without a proven site/org binding attestation. Remote Hermes service execution requires the configured gateway, service assertion, replay ledger, tenant binding, and terminal ledger gates.

## Authority

- Source SHA for focused tests: `3ab2b41a664412cbdf1fddbde97371ecc6798cf8`
- Production build-info observed during live smoke: `1b7f53712acdfea65d2a5abc52a3e73cfb03501b`
- Live deployment URL: `safeguard-contest-p63gspunn-seojaehongs-projects.vercel.app`
- Worktree: `C:\Users\iceam\OneDrive\.codex-worktrees\safeclaw-northstar-current`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## Verification

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\openclaw-broker-ui-context.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-service-auth.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-provider-policy.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000 --hookTimeout=180000
```

Result:

- Test files: 13 passed / 13
- Tests: 290 passed
- Duration: 12.97s
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

## Remote Hermes Source Contract

- Production route wires configured trusted HTTPS transport: `true`
- Configured transport fails closed on service/digest mismatch: `true`
- Trusted transport wired: `true`
- Durable attempt ledger wired: `false`
- Readiness keeps the durable ledger blocker visible: `true`
- Execution-ready claimed: `false`

## Interpretation

This is the correct current state for launch safety: SafeClaw can demonstrate that Hermes/OpenClaw is integrated as a bounded adapter path, while avoiding the false claim that a production Hermes worker pool or local OAuth runtime is fully operational inside Vercel.

The production route now supplies the DNS-pinned trusted HTTPS transport. Runtime creation still fails closed because no durable cross-instance attempt/terminal ledger is wired. The next proof requires the approved durable ledger plus an authenticated operator-owned canary; this report does not substitute source wiring for live execution.
