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
- `app/api/export/xlsx/route.ts`
- `app/api/export/hwp/route.ts`
- `components/WorkpackEditor.tsx`
- `lib/openclaw-broker-route.ts`
- `lib/openclaw-chat.ts`
- `tests/engine-adapter.test.ts`
- `tests/editor-export-integrity.test.ts`
- `tests/tbm-deterministic-structures.test.ts`
- `tests/workspace-layout-regression.test.ts`

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
| Deterministic outputs | The editor and export tests prove deterministic mapping/edit propagation for current selected rows. XLSX and HWP/HWPX paths do not require a human-confirmation record or approval receipt; the separate ontology evidence-pack confirmation does not supply that binding. | Human-confirmation and approval-receipt export binding is REQUIRED long term but UNIMPLEMENTED and DEFERRED as a promotion prerequisite and experiment exit criterion. Current tests do not prove it. |

The current implementation evidence is the selected-row mapping and export
payload construction
([`WorkpackEditor.tsx:1319-1324`](../../components/WorkpackEditor.tsx#L1319-L1324),
[`WorkpackEditor.tsx:1970-1974`](../../components/WorkpackEditor.tsx#L1970-L1974),
[`WorkpackEditor.tsx:2298-2376`](../../components/WorkpackEditor.tsx#L2298-L2376),
[`WorkpackEditor.tsx:2434-2438`](../../components/WorkpackEditor.tsx#L2434-L2438)).
The XLSX and HWP routes consume request rows without confirmation/receipt
inputs
([`xlsx/route.ts:163-232`](../../app/api/export/xlsx/route.ts#L163-L232),
[`hwp/route.ts:291-301`](../../app/api/export/hwp/route.ts#L291-L301)). The
tests establish edit propagation only
([`editor-export-integrity.test.ts:32-84`](../../tests/editor-export-integrity.test.ts#L32-L84),
[`workspace-layout-regression.test.ts:1770-1790`](../../tests/workspace-layout-regression.test.ts#L1770-L1790)).

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

The Phase B plan separately requires explicit approval for database migration,
billing schema, data backfill, or production traffic cutover
([`phase-b-organization-knowledge-and-engine-plan.md:27-29`](../../docs/phase-b-organization-knowledge-and-engine-plan.md#L27-L29)).
Its entry-gate prerequisite list is the reviewed ontology/provenance evidence,
read-only RLS audit, Hermes ADR, explicit migration approval, tenant-isolation
and rollback plans, and agreed usage-cap/service-authentication policy
([`phase-b-organization-knowledge-and-engine-plan.md:188-193`](../../docs/phase-b-organization-knowledge-and-engine-plan.md#L188-L193)).

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
7. `U-07` - Current exports prove selected/edited-row propagation only.
   Human-confirmation and approval-receipt binding for authoritative exports is
   not implemented; engine parity, recovery, duplicate-effect defense, and
   deterministic export parity are also not proven.
8. `U-08` - The representative GPT OAuth PoC is not authorized and was not run.

## Validation Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Local Markdown links and line ranges resolve | `PASS` | 61 local links resolved; 60 line fragments fit their target files |
| Required and prohibited terminology | `PASS` | 28 required architecture/remediation terms present; 2 rejected overclaim phrases absent |
| Decision counts match the ADR register | `PASS` | 6 adopted, 4 deferred, 6 rejected; total 16 |
| `report.json` parses and matches this report | `PASS` | 14 parity checks passed; 8 unresolved prerequisites retained |
| Changed paths remain docs/evaluation only | `PASS` | Root ADR plus the two requested evaluation artifacts only; 3 paths total |
| No code, UI, or package diff | `PASS` | Repository diff-verifiable; 0 forbidden paths |
| No DB migration diff | `PASS` | Repository diff-verifiable; 0 migration paths |
| No DB mutation executed | `DECLARED` | Author-task execution declaration; not independently proven by repository diff |
| `git diff --check` | `PASS` | 0 whitespace errors against `f45bba17bcce0d8ebb2690f82d014dbe42ae8191` |

## Change Declaration

- `noCodeChange`: `true` - diff-verifiable
- `noDbMutation`: `true` - author-task execution declaration; not independently
  proven by repository diff
- `noDbMigration`: `true` - diff-verifiable
- `runtimeExperimentRun`: `false`
- `gptOauthAttempted`: `false`
- `selfApproved`: `false`
- `freshReviewRequired`: `true`

All diff-verifiable sidecar gates passed. `noDbMutation` remains an author-task
execution declaration rather than repository-diff proof. A fresh reviewer must
accept, request changes, or reject the ADR; this sidecar stops without approval.
