# Hermes Engine ADR Sidecar Review

Date: 2026-07-14
Status: `READY_FOR_FRESH_REVIEW`
Approval: Not approved; this sidecar does not self-approve

## Scope and Source

- Source SHA: `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`
- Source branch: `docs/hermes-engine-adr-sidecar-2026-07-14`
- Ownership: `docs/evaluation` only
- Prohibited scope: code, UI, database, migrations, packages, runtime execution,
  provider access, and GPT OAuth login
- Updated ADR: [`ARCHITECTURE_DECISIONS.md`](../../ARCHITECTURE_DECISIONS.md)

Primary files reviewed at the source SHA:

- `ARCHITECTURE_DECISIONS.md`
- `CONTEXT.md`
- `docs/adr/0001-agent-runtime-boundary.md`
- `docs/agent-runtime-long-term-roadmap.md`
- `docs/phase-b-organization-knowledge-and-engine-plan.md`
- `docs/mcp-server.md`
- `docs/superpowers/specs/2026-07-12-openclaw-broker-hardening-design.md`
- `lib/ai-provider-policy.ts`
- `lib/engine-adapter.ts`
- `lib/db-harness.ts`
- `lib/mcp-auth.ts`
- `lib/mcp-scoped-tool.ts`
- `lib/mcp-tools.ts`
- `app/api/mcp/[transport]/route.ts`
- `lib/openclaw-broker-route.ts`
- `lib/openclaw-chat.ts`
- `tests/engine-adapter.test.ts`
- `tests/editor-export-integrity.test.ts`
- `tests/tbm-deterministic-structures.test.ts`

## Decision Result

| Status | Count | IDs | Meaning |
| --- | ---: | --- | --- |
| `ADOPTED` | 6 | `AD-01` to `AD-06` | Architecture invariants and design contracts accepted |
| `DEFERRED` | 4 | `DE-01` to `DE-04` | No implementation or experiment authorization |
| `REJECTED` | 6 | `RJ-01` to `RJ-06` | Prohibited in the active plan or at every phase, as stated |

The active-plan wholesale Hermes/FastAPI or OpenClaw core replacement is
rejected. Only future reconsideration is deferred, and it requires all re-entry
evidence plus a separate ADR. SafeClaw MCP, DB, and Evidence Harness remain the
system of record and effect authority.

The only accepted long-term planner seam is a SafeClaw-owned, isolated,
versioned `EngineAdapter`. A later experimental fork may run Hermes or OpenClaw
as stateless workers, but engine choice remains separate from
`ai-provider-policy` model selection. Planner promotion never transfers fact,
database, approval, effect, publication, or export authority.

## Seam Review

| Seam | Current evidence | ADR consequence |
| --- | --- | --- |
| Model provider | `lib/ai-provider-policy.ts` selects Vertex or an optional Anthropic pilot and preserves Vertex fallback. | Hermes/OpenClaw cannot become a provider-policy branch. |
| Planner engine | `lib/engine-adapter.ts` exposes no execution capabilities and defaults to disabled; local OpenClaw is disabled on Vercel. | The seam exists, but durable/versioned worker promotion is not implemented. |
| MCP authorization | DB tokens carry site, organization, and tool scopes; `registerScopedTool` checks scope before handlers. | Future workers must use the same SafeClaw-controlled interceptor. |
| MCP tenancy limit | Harness memory queries use the token's `siteId`, while the legacy env token remains unbound and fully trusted. | Complete runtime tenant isolation remains a prerequisite, not a current claim. |
| DB Evidence Harness | The packet fixes `db_harness` authority, `naturalize_only`, fixed-evidence rewriting, no evidence fallback, and review-required missing evidence. | Runtime planning cannot invent evidence or silently substitute generic prose. |
| Deterministic outputs | Phase B keeps retrieval, obligation classification, and exports in deterministic code where practical; current tests bind exports to confirmed rows. | Engine failover cannot alter authoritative PDF, XLSX, HWPX, or related exports. |

## Phase Contracts

Phase A remains SIF -> KOSHA Guide -> current law, with exactly these
obligation outcomes:

- `statutory_mandate`
- `technical_guidance_only`
- `statutory_mandate_with_guidance`
- `review_required`

Phase B remains design-only and includes:

- public safety ontology, organization ontology, and site operation memory;
- candidate -> site submission -> headquarters review -> verification ->
  organization publication;
- receiving-site human acceptance before organization knowledge affects a
  workpack;
- usage and billing attribution by organization, site, job, provider/model,
  usage, cost, retry, and escalation reason;
- scoped service authentication, durable job queue, shared stateless worker
  pool, approval ledger, and effect ledger;
- one representative local GPT OAuth PoC only after the Phase B entry gate and
  a separate explicit PoC approval.

An LLM may draft or rank a promotion candidate. It cannot approve, publish, or
directly mutate ontology, wiki, corpus, prompts, skills, workpacks, ledgers, or
other source-of-truth state.

## Security, Privacy, and Ownership

- SafeClaw-owned systems retain system-of-record and control-plane authority
  over product facts, tenant records, approvals, effect receipts, published
  knowledge, and deterministic exports. Customer organizations retain their
  contractual rights to organization and site data.
- Runtime sessions, model conversations, OAuth profiles, caches, and
  trajectories are processing artifacts only.
- Organization and site data remain tenant-private. Personal information,
  original photos, signatures, incident-subject data, unreviewed text, and
  another customer's records cannot be promoted automatically.
- A runtime receives the minimum tenant-bound evidence packet and no database,
  migration, service-role, or publication credential.
- Provider retention, deletion, redaction, access, incident response, secret
  rotation, and license terms require fresh acceptance before any worker PoC or
  promotion.

## Unresolved Prerequisites

1. `U-01` - Versioned request/result/error/cancellation/resume/capability and
   trajectory contracts are not implemented.
2. `U-02` - Durable jobs, leases, checkpoints, bounded retry, terminal states,
   and dead-letter handling are not implemented for Hermes/OpenClaw workers.
3. `U-03` - A durable approval/effect ledger with idempotency keys and receipts
   is not proven end to end.
4. `U-04` - Runtime-wide tenant isolation, including legacy unbound MCP token
   handling and cross-tenant resume/failover tests, is not proven.
5. `U-05` - Three-layer knowledge storage, promotion workflow, and usage/billing
   ledger implementation require separately approved database design.
6. `U-06` - Service authentication, secret rotation, provider privacy and
   retention, license, incident response, and capacity reviews are open.
7. `U-07` - Hermes/fork and OpenClaw parity, recovery, duplicate-effect defense,
   and deterministic export parity are not proven.
8. `U-08` - The representative GPT OAuth PoC is not authorized and was not run.

## Validation Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Local Markdown links resolve | `PASS` | 41 local links resolved; 40 line fragments fit their target files |
| Required terms and status IDs present | `PASS` | 21 required architecture terms present |
| Decision counts match the ADR register | `PASS` | 6 adopted, 4 deferred, 6 rejected; total 16 |
| `report.json` parses and matches this report | `PASS` | JSON parsed; counts match; 8 unresolved prerequisites retained |
| Changed paths remain docs/evaluation only | `PASS` | Root ADR plus the two requested evaluation artifacts only |
| No code, UI, package, DB, or migration diff | `PASS` | Changed-path and extension scan found no forbidden file |
| `git diff --check` | `PASS` | Tracked diff check and all-artifact whitespace scan passed |

## Change Declaration

- `noCodeChange`: `true`
- `noDbMutation`: `true`
- `noDbMigration`: `true`
- `runtimeExperimentRun`: `false`
- `gptOauthAttempted`: `false`
- `selfApproved`: `false`
- `freshReviewRequired`: `true`

All sidecar gates passed. A fresh reviewer must accept, request changes, or
reject the ADR; this sidecar stops without approval.
