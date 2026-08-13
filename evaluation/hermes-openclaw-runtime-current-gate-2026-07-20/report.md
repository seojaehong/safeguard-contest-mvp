# SafeClaw Hermes / OpenClaw Runtime Current Gate

Checked at: 2026-08-13T20:32:33.058Z

## Verdict

The Hermes/OpenClaw runtime architecture is green at the adapter, policy, service-auth, route, and fail-closed boundary level when the verdict is `adapter_boundary_pass_live_execution_not_claimed`.

Live production runtime execution is still not claimed. The live `/api/agent/chat` route must require authentication before engine execution, and production local OpenClaw mode remains closed without a proven site/org binding attestation. Remote Hermes service execution requires the configured gateway, service assertion, replay ledger, tenant binding, and terminal ledger gates.

## Authority

- Source SHA for focused tests: `75027ffa8e8ad26dfea2048a6429f36c5607c980`
- Production build-info observed during live smoke: `75027ffa8e8ad26dfea2048a6429f36c5607c980`
- Source/live aligned: `true`
- Live deployment URL: `safeguard-contest-pfhxmz3lv-seojaehongs-projects.vercel.app`
- Worktree: `C:\Users\iceam\OneDrive\.codex-worktrees\safeclaw-northstar-current`
- Branch: `chore/recipient-foreign-live-gate-20260720`

## Verification

Command:

```powershell
npm.cmd test -- tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\openclaw-chat.test.ts tests\openclaw-broker-ui-context.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-upstash-ledger.test.ts tests\remote-hermes-service-auth.test.ts tests\remote-engine-protocol.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-provider-policy.test.ts tests\mcp-tools.test.ts --maxWorkers=1 --fileParallelism=false --testTimeout=90000 --hookTimeout=180000
```

Result:

- Test files: 15 passed / 15
- Tests: 333 passed
- Duration: 13.75s
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
- Share session created: `false`
- Vector runtime activated: `false`
- LLM Wiki publication performed: `false`
- KOSHA registry mutation performed: `false`
- Engine execution claimed: `false`
- Live authenticated execution performed: `false`

Exact saved Share remains `MISSING_EVIDENCE`. LLM Wiki publication, provider persistence, SIF vector runtime, KOSHA exact promotion, and the authenticated Hermes canary remain approval-gated.

## Remote Hermes Source Contract

- Production route wires configured trusted HTTPS transport: `true`
- Configured transport fails closed on service/digest mismatch: `true`
- Trusted transport wired: `true`
- Durable attempt ledger wired: `true`
- Ledger explicit opt-in: `true`
- Atomic reservation: `true`
- Terminal requires reservation: `true`
- Terminal stores digest only: `true`
- Readiness keeps the durable ledger blocker visible: `true`
- Execution-ready claimed: `false`

## Interpretation

This is the correct current state for launch safety: SafeClaw can demonstrate that Hermes/OpenClaw is integrated as a bounded adapter path, while avoiding the false claim that a production Hermes worker pool or local OAuth runtime is fully operational inside Vercel.

The production route now supplies both the DNS-pinned trusted HTTPS transport and an explicit opt-in durable attempt/terminal ledger. Runtime creation still fails closed unless the operator configures the remote gateway, signed policy, and `SAFECLAW_REMOTE_HERMES_LEDGER_MODE=upstash`. The next proof is an approved authenticated operator-owned canary; this report does not substitute source wiring for live execution.
