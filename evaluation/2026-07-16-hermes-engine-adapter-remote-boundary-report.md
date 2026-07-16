# Hermes EngineAdapter Remote Boundary Evaluation

Date: 2026-07-16
Verdict: PASS after P1 contract remediation

## Evaluated Baseline

- Authoritative source worktree:
  `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\northstar-clean-integration-20260715`
- Required base commit: `530efbfafb30c6145c1536172b260ff644845846`
- Isolated branch: `docs/hermes-engine-adapter-boundary-20260716`
- Isolated worktree:
  `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\hermes-engine-adapter-boundary-20260716`
- Owned paths: `docs/architecture/**` and `evaluation/**`
- Production code changes: none
- Database, environment, remote service, deployment, and production traffic
  changes: none

## Artifact

- [Architecture Contract 0003: EngineAdapter Remote Hermes Boundary](../docs/architecture/0003-engine-adapter-remote-hermes-boundary.md)

The contract is intentionally documentation-only. It defines the first remote
slice as a stateless, tool-free `naturalize_only` service and leaves effectful
planning behind ADR 0001's existing Phase 4 promotion gate.

## Independent Review Remediation

The initial commit `2590556b7754150a1d818300e6b5fd36685e0fdf` was rejected
because the network request could include a normalized raw prompt and because
one request digest ambiguously covered both a logical run and retry-specific
transport fields. Both findings are remediated in the architecture contract:

1. `prompt` is removed from the remote envelope. SafeClaw now creates an
   allowlisted `promptProjection`, applies structural PII redaction before
   dispatch, pins `redactionPolicyVersion`, and emits a non-sensitive
   `redactionProof`. Unknown field classes, detected PII that cannot be safely
   removed/tokenized, unsupported policy versions, or irreproducible digests
   fail closed before any remote call. A raw or merely normalized prompt is
   explicitly prohibited.
2. `logicalRequestDigest` now covers stable logical fields and excludes
   `requestId`, `attemptId`, `issuedAt`, `expiresAt`, attempt number, nonce, and
   attempt-specific budget. `attemptEnvelopeDigest` covers the complete
   concrete attempt and is what the service identity signs. Every retry keeps
   the logical and evidence digests but creates fresh request/attempt IDs,
   timestamps, envelope digest, and signature.

## Reconciliation Review

| Existing record | Review result |
| --- | --- |
| `docs/adr/0001-agent-runtime-boundary.md` | Preserved as the authority for system-of-record ownership, MCP interception, ledgers, tenant isolation, failover, and Phase 4 promotion. The new contract only specifies the missing remote transport boundary. |
| `docs/adr/0002-knowledge-promotion-provenance-boundary.md` | Preserved as the authority for candidate-only LLM output and human-reviewed publication. Remote Hermes receives no persistence or publication capability. |
| `docs/phase-b-organization-knowledge-and-engine-plan.md` | Preserved and operationalized: central stateless workers, service auth, org/site attribution, budgets, and no per-site OAuth/runtime copies. |
| `docs/agent-runtime-long-term-roadmap.md` | Preserved: Hermes-as-primary remains deferred; OpenClaw remains parity/failover; the new slice does not claim promotion. |
| `evaluation/2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md` | Used as supporting evidence for auth-plane separation, one SafeClaw interceptor, durable receipts, and stateless worker constraints. It is not promoted to normative ADR status. |

No existing ADR was copied, renumbered, superseded, or edited. The new
contract includes an explicit precedence rule: ADR 0001 and ADR 0002 win on
conflict.

## Requirement Coverage

| Requested boundary | Result | Contract location |
| --- | --- | --- |
| Local OAuth POC versus contract service auth | PASS | `Current State And Target State`; `Authentication And Tenant Binding` |
| Stateless shared worker pool | PASS | `Target Remote Slice`; `Stateless Worker Pool` |
| Tenant binding | PASS | `Request Envelope`; `Authentication And Tenant Binding` |
| Minimized/redacted remote prompt | PASS | `Prompt Projection And Structural Redaction`; raw or normalized prompts are prohibited and redaction uncertainty fails closed before dispatch. |
| Stable logical digest versus signed attempt digest | PASS | `Request Envelope`; `Response Envelope`; `Retries, Deadlines, And Budgets` |
| Evidence Harness `naturalize_only` | PASS | `Evidence Harness And Tool Deny` |
| Tool deny | PASS | No tool schema or credential; service policy must attest `allow: []`, `deny: ["*"]`; any tool request is terminal. |
| Approval and effect ledger | PASS | `Approval And Effect Ledger` |
| Retries and budgets | PASS | `Retries, Deadlines, And Budgets` |
| Vercel remote boundary | PASS | `Vercel Remote Boundary` |
| No per-site OAuth copies | PASS | Central service/provider identity and per-request tenant capability; site-specific runtime homes and credentials are prohibited. |
| Bounded scope | PASS | Remote v1 is naturalization-only; schema, deployment, provider, queue vendor, billing, and effectful planning are non-goals. |

## Current-Code Consistency Search

Read-only search of the authoritative base confirmed the document's current
state statements:

- `lib/engine-adapter.ts` defines `engine-adapter/v1`.
- `lib/engine-adapter.ts` disables local OpenClaw and experimental Hermes when
  `VERCEL` is present and requires `SAFECLAW_HERMES_LOCAL_POC=1` for the local
  Hermes experiment.
- `lib/hermes-engine-adapter.ts` requires the DB Harness generation role
  `naturalize_only` and validates evidence/output attestation.
- `lib/openclaw-hermes-runtime.ts` instructs the local runtime to perform
  `naturalize_only` output.
- `tests/hermes-engine-adapter.test.ts` contains the exact tool-free policy
  fixture `allow: []`, `deny: ["*"]`.

Command:

```powershell
rg -n -F -e 'engine-adapter/v1' -e 'naturalize_only' `
  -e 'deny: ["*"]' -e 'VERCEL' -e 'SAFECLAW_HERMES_LOCAL_POC' `
  lib\engine-adapter.ts lib\hermes-engine-adapter.ts `
  lib\openclaw-hermes-runtime.ts tests\hermes-engine-adapter.test.ts
```

Result: PASS. All five current-state invariants were found in implementation
or tests.

## Link Validation

The architecture contract contains five relative Markdown links. A PowerShell
resolver expanded each path relative to the document directory and checked it
with `Test-Path`.

| Target | Result |
| --- | --- |
| `../adr/0001-agent-runtime-boundary.md` | PASS |
| `../adr/0002-knowledge-promotion-provenance-boundary.md` | PASS |
| `../phase-b-organization-knowledge-and-engine-plan.md` | PASS |
| `../agent-runtime-long-term-roadmap.md` | PASS |
| `../../evaluation/2026-07-10-hrms-hermes-safeclaw-engine-gap-audit.md` | PASS |

Result: five checked, zero missing.

## Coverage Search

A literal search checked these required concepts in the architecture contract:

```text
local OpenAI OAuth
service auth
stateless Hermes worker pool
organizationId
siteId
naturalize_only
deny: ["*"]
approval
effect ledger
retries
budget
Vercel
per-site
```

Result: thirteen concepts found, zero missing. A broader bounded search for
Hermes, EngineAdapter, OAuth, naturalize_only, approval, effect, retry, budget,
Vercel, and per-site terms returned ninety-one matching lines for manual
review.

The follow-up P1 gate additionally searches for:

```text
promptProjection
redactionPolicyVersion
redactionProof
structural PII redaction
raw or normalized prompts never cross
logicalRequestDigest
attemptEnvelopeDigest
fresh request/attempt IDs
```

Result: all remediation concepts found. The contract contains no remote
envelope field named `prompt`, and the retry rule explicitly creates both a new
`requestId` and a new `attemptId` for every retry.

## Scope And Diff Validation

Commands:

```powershell
git diff --check
git diff --name-only
git status --short
```

Pre-commit result:

- whitespace errors: zero;
- changed path roots: `docs/architecture/` and `evaluation/` only;
- production source, tests, migrations, configuration, and secrets changed:
  zero.

The isolated worktree did not contain `node_modules`. No dependency install,
build, or application test run was needed for this documentation-only change.
Validation used dependency-free link resolution, literal source search, scope
inspection, and `git diff --check`.

## Evidence Boundary

This report verifies repository documentation consistency only. It does not
claim that a remote Hermes service, workload identity, durable run ledger,
shared worker pool, Vercel integration, or production canary exists. Those
remain gated implementation work in the architecture contract.
