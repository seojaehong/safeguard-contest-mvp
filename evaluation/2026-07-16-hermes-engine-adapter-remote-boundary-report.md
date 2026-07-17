# Hermes EngineAdapter Remote Boundary Evaluation

Date: 2026-07-16
Verdict: PASS for the docs-only contract after fresh HOLD remediation; runtime implementation not verified

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

## Fresh HOLD Remediation

The follow-up commit `8b47a33d36037ffabf264d4d898bb046659abd61`
remained on HOLD because `claims` did not prove a minimized remote DTO, the
response did not have closed success/failure variants or a whole-envelope
digest, and retry classification ownership remained underspecified. This
follow-up changes the documentation contract only:

1. Ambiguous `claims` is replaced by typed `claimsProjection` with
   `schemaVersion="claims-projection/v1"`. Only opaque IDs, minimum redacted
   safety text, bounded citation fields, allowed public provenance, and a
   complete scalar-leaf classification map may cross. Raw local claim/Harness
   objects, extra or unclassified fields, disallowed provenance, unknown data,
   and PII fail closed before dispatch.
2. `claimsProjectionDigest` is required in `redactionProof` and
   `logicalRequestDigest`. The redaction proof also pins claims projection and
   field-classification policy versions plus the complete classification-map
   digest.
3. `engine-remote-response/v1` is discriminated by `kind="success"` or
   `kind="failure"`. The variants are mutually exclusive and both require
   usage and terminal status. Canonical `responseEnvelopeDigest` covers every
   unsigned response field, including selected claims/citations or the error,
   usage, and status. The service receipt signs and binds that digest to the
   exact attempt.
4. `engine-remote-error/v1` is a closed error-code taxonomy and
   `engine-remote-retry-policy/v1` is SafeClaw-owned. Workers and the gateway
   cannot provide an authoritative retryable flag or disposition. SafeClaw
   validates origin/signature, maps the known code, applies remaining budgets,
   and records the deterministic result. Unknown, malformed, unsigned, policy,
   or signature failures do not become transient retries.

This report does not claim those contracts are implemented in product code or
deployed remotely. It verifies only that the bounded ADR/spec now states the
required fail-closed behavior without modifying production code.

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
| Typed minimized `claimsProjection` | PASS | `Typed Claims Projection`; closed DTO, public provenance allowlist, complete scalar-leaf classifications, PII/unknown fail-closed rules, and no raw local claim objects. |
| Claims digest binding | PASS | `claimsProjectionDigest` is present in `redactionProof`, `logicalRequestDigest`, retry identity, tenant capability, and response validation. |
| Discriminated response variants | PASS | `Response Envelope`; success and failure are mutually exclusive and both bind usage and terminal status. |
| Whole-response digest and receipt | PASS | `responseEnvelopeDigest` covers every unsigned response field; `serviceReceipt` signs and binds it to the exact attempt. |
| Versioned errors and SafeClaw retry ownership | PASS | `Versioned Error Taxonomy And Retry Ownership`; closed codes and deterministic SafeClaw disposition. |
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

The earlier `2590556` validation found thirteen baseline concepts and the
`8b47a33` follow-up added the prompt/digest checks below. Those results describe
the earlier commits and do not by themselves clear the fresh HOLD.

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

The fresh HOLD gate additionally requires:

```text
claimsProjection
claims-projection/v1
claimsProjectionDigest
fieldClassifications
allowed provenance classes
raw local claim objects prohibited
engine-remote-response/v1
kind: "success" | "failure"
responseEnvelopeDigest
selectedClaims and error mutual exclusion
engine-remote-error/v1
engine-remote-retry-policy/v1
worker cannot choose retry disposition
```

Result: all fresh HOLD contract concepts are present. Stale ambiguous request
field `claims` is absent from the request table. The response contract binds
all unsigned fields to a signed receipt, and retry ownership is explicitly
SafeClaw-only. These are documentation checks, not executable runtime tests.

### Fresh HOLD Validation Result

- typed claims projection requirements checked: sixteen;
- discriminated response/digest requirements checked: fourteen;
- error taxonomy and retry-ownership requirements checked: eleven;
- evaluation honesty/coverage requirements checked: six;
- missing requirements: zero;
- stale ambiguous `claims` request fields: zero;
- relative links checked across both artifacts: six, missing zero;
- changed files: two, both under the owned documentation/evaluation paths;
- `git diff --check`: pass;
- product code, tests, migrations, configuration, secrets, deployment, and
  remote runtime changed or executed: zero.

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
