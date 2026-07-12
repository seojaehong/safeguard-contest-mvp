# SafeClaw refactor status report grill

- Generated: `2026-07-12T23:29:43+09:00`
- Source report: `C:\Users\iceam\Downloads\SafeClaw (safeguard-contest-mvp) 전면 리팩토링 현황 점검 보고서.md`
- Source SHA-256: `AA5111EFA12229F881AB0C6DFE14F02266319A4262B34C2138AE26F36FFB7F2D`
- Stale report base: `ba6fd220ec17caa018513d39965e17105486ec3b`
- Evaluated HEAD: `ae6b88ad59b2e251f47d2d6b2be79d657681c027`
- Merge base: `c7ec5e0bd040f3661f2371136774173a3ba1cc29`
- Scope: repository code, docs, tests, migrations, and committed evaluation only; no product-code or database changes

## Verdict

The supplied report is not safe to adopt as a current status report. `ba6fd22` is not an ancestor of `ae6b88a`: the two snapshots diverge at `c7ec5e0`, with three stale-side commits and 379 current-side commits. Several statements were true only on the stale branch, several were already overstated there, and the current launch gate is RED.

Current HEAD does compile: strict TypeScript and the production build pass. It is not launch-clean: the current static frontend audit fails with nine violations, the complete serial suite has seven failing files and nine failing tests, `/reports` fails the 390px first-viewport contract, the production agent adapter is fail-closed, and tenant/RLS production evidence is incomplete.

Disposition totals: `adopt` 10, `hold` 7, `reject` 8, `needs-current-verification` 1. These are classifications, not quality ratings.

## Classification Rules

- `adopt`: supported by current code/evidence and safe to carry forward.
- `hold`: partly true or directionally useful, but incomplete, ambiguous, or blocked by an existing gate.
- `reject`: materially false, superseded, or contrary to the current architecture decision.
- `needs-current-verification`: static repository evidence cannot establish the current live state.

## Fresh HEAD Evidence

| Check | Current result |
| --- | --- |
| `npm.cmd run audit:frontend-consistency` | FAIL at `ae6b88a`: 32 pages, 23 components, 20,121 CSS lines, no `!important`, no coverage gaps, nine violations. Six are `line-height-tier`; three are incomplete `typography-tuple` rules in `app/globals.css:18300-18398`. |
| Focused claim tests | FAIL: 11 files passed, two failed; 107 tests passed, two failed. Failures were the Reports spacing residue and `/reports` mobile content top `410` over maximum `387`; cleanup also hit a hook timeout after failure. |
| Full serial Vitest | FAIL: 124 files passed, seven failed, five skipped; 1,197 tests passed, nine failed, seven skipped. Failures cover the same frontend audit debt, `/reports` mobile geometry, and launch-audit process timing. |
| Standalone launch-audit test | FAIL: three passed, one failed. The success fixture uses a 75ms request timeout (`tests/launch-readiness-audit.test.ts:125-151`), which is not stable on this Windows run. |
| `npm.cmd run typecheck` | PASS after restoring the lockfile-declared dependencies missing from this worktree's local `node_modules`. No tracked file changed. |
| `npm.cmd run build` | PASS; 27 static pages generated. |
| Current frontend-final evidence ancestry | FAIL: `evaluation/frontend-final-gate-current-2026-07-12/report.json` names source `92eea81`; that commit is not an ancestor of `ae6b88a`. |
| Browser family | Chromium only. Browser harnesses import or launch Chromium; no Firefox or WebKit execution was found (`scripts/frontend_consistency_browser_audit.mjs:7,376`; `tests/helpers/isolated-next-browser-harness.ts:5,254`). |

## Claim Matrix

| ID | Source lines | Stale-base truth | Current disposition | Current truth and evidence |
| --- | ---: | --- | --- | --- |
| C01 | 11 | Unsupported overclaim | `reject` | Commercialization foundations exist, but “perfectly combined” is contradicted by current failing gates and the accepted ADR's explicit unimplemented target (`docs/adr/0001-agent-runtime-boundary.md:7-22`). |
| C02 | 13 | Partial | `reject` | `docs/ARCHITECTURE_DECISIONS.md` and `docs/PHASE_EXECUTION_PLAN.md` exist at `ba6fd22` but not at `ae6b88a`. Current authority is ADR 0001 and the long-term roadmap, both explicit about deferred work (`docs/adr/0001-agent-runtime-boundary.md:24-52`; `docs/agent-runtime-long-term-roadmap.md:5-12`). |
| C03 | 13, 22 | Supported direction | `adopt` | The field-instrument/command-center direction is real (`CONTEXT.md:63-67`; `app/globals.css:56-69`). This adopts the direction, not the report's completeness claim. |
| C04 | 22 | Partial | `reject` | Steel and hazard-yellow tokens exist, but a complete conversion is false: current frontend audits fail, and `DESIGN.md:15-25` still defines Field Green/Warm Clay/Paper roles that do not match the claimed single system. |
| C05 | 22 | Unsupported | `reject` | `tabular-nums` is applied only to named selectors (`app/globals.css:184-192`), not to every numeric rendering, and no exhaustive numeric-coverage test exists. |
| C06 | 23 | Supported only at stale base | `reject` | `ba6fd22:components/SafeClawModuleShell.tsx:28-47` had 15 items in three groups. Commit `c33aafd` replaced that model. Current code intentionally has six primary destinations plus contextual children (`lib/module-navigation.ts:16-77`; `tests/module-shell-navigation.test.ts:15-52`). |
| C07 | 24 | Partial | `hold` | Query/scenario URLs redirect to `/workspace` and the landing has direct workspace links (`app/page.tsx:4-13`; `components/SafeClawLanding.tsx:70-99`), but `/` remains a substantial landing page, not immediate workspace entry. |
| C08 | 27-28 | Supported | `adopt` | `/tbm` remains `status="planned"` and renders sample workpack content rather than a persisted fullscreen meeting flow (`app/tbm/page.tsx:5-30`). |
| C09 | 27-29 | Supported | `adopt` | `/worker` remains `status="planned"`; acknowledgement is local component state and says recording is only planned (`app/worker/page.tsx:8-68`). |
| C10 | 30 | Supported | `adopt` | `/settings` remains `status="planned"`, although briefing and AI-connect subfeatures exist (`app/settings/page.tsx:14-35`). |
| C11 | 30 | Partial | `needs-current-verification` | `/ontology` is no longer merely a shell: it loads a published graph and falls back to bundled published seed (`app/ontology/page.tsx:35-90`). Its live/partial/planned badge depends on current Supabase configuration and response, which static HEAD cannot establish. |
| C12 | 31 | Supported | `adopt` | Mobile verification remains necessary. Current Chromium coverage is broad, but there is no Firefox/WebKit run and `/reports` currently fails at 390px (`evaluation/module-shell-harness-remediation-2026-07-12/report.md:47-49`). |
| C13 | 36 | Supported at stale base | `hold` | The injected stateless Anthropic tool loop still exists and is tested (`lib/agent-loop.ts:18-83,307-374`), but it is now legacy compatibility code, not the default route (`lib/agent-loop.ts:1-5`). Current chat uses the broker/adapter path (`app/api/agent/chat/route.ts:1-10`). |
| C14 | 37 | Supported | `adopt` | The quality contract reduces required evidence, structured output, ontology, DB-harness, and persistence items to `ready`, `degraded`, or `blocked` (`lib/quality-contract.ts:3-40,238-324`). |
| C15 | 38 | Supported | `adopt` | The integrity policy checks missing documents, minimum length, unresolved placeholders, required terms, and scenario terms (`lib/deliverable-integrity-policy.ts:1-8,50-87,109-168`). |
| C16 | 41 | Unsupported | `reject` | The provider direction is reversed in the source report. Vertex is the default. Claude/Anthropic is optional primary when explicitly selected and configured; Vertex is its fallback (`lib/ai-provider-policy.ts:1-27`; `lib/ai-deliverables.ts:131-161`). |
| C17 | 41 | Partial future concern | `hold` | Hermes routing is a future gated target, not current launch work. Current modes are only `disabled` and `local-openclaw` (`lib/engine-adapter.ts:3,77-83`); the ADR defers Hermes to a separate PoC and later promotion gate (`docs/adr/0001-agent-runtime-boundary.md:38-52,73-115`). |
| C18 | 46 | Unsupported superlative | `reject` | The organization/site/worker/workpack hierarchy exists (`supabase/migrations/002_workspace_productization.sql:3-57`), but it is not “perfect”: tenant IDs can disagree with nullable site/workpack references, `organizations.owner_id` is nullable, and null-organization dispatch rows pass the broad policy (`:76-90,183-200`). |
| C19 | 47 | Supported | `adopt` | Seven node kinds and seven edge relations are defined and tested (`lib/ontology/schema.ts:8-20`; `tests/ontology-schema.test.ts:14-30`). |
| C20 | 47 | Partial | `hold` | Citation syntax is Zod-validated, but the Zod arrays and SQL columns allow empty arrays (`lib/ontology/schema.ts:94-116`; `supabase/migrations/008_safety_ontology.sql:9-27`). Non-empty provenance is enforced later by graph assembly/upsert (`lib/ontology/graph-store.ts:73-115,235-279`). |
| C21 | 50 | Subjective/under-specified | `hold` | The bundled ontology is not tiny: 171 nodes and 182 edges from 190 reviewed source rows, including ten tasks and common fall/caught-between hazards (`tests/ontology-seed.test.ts:8-45`). It has no Accident nodes and only one bundled seed family, but “insufficient” needs a coverage acceptance matrix. |
| C22 | 51 | Supported | `adopt` | A full RLS (row-level security, 행 수준 보안) audit is warranted. Core migrations contain policies, but no executable two-tenant DB test exists, legacy `001` tables have no RLS, and null-org dispatch access remains (`supabase/migrations/001_init.sql:1-16`; `002_workspace_productization.sql:99-200`; `docs/agent-runtime-long-term-roadmap.md:55-64,94-97`). |
| C23 | 57 | Recommendation | `hold` | TBM/Worker integration is real unfinished work, but whether it blocks launch is a product-scope decision. The last committed production-table probe also found commercial share/read/improvement tables absent (`evaluation/crunch/production-commercial-tables-probe-2026-07-10.md:8-21`). |
| C24 | 58 | Recommendation | `hold` | Expanding ontology coverage is sensible, but “five accident types first” is not supported by a gap analysis; the existing seed already includes fall and caught-between hazards. Define task/hazard/article/control coverage and missing Accident-node criteria first. |
| C25 | 59 | Conflicts with active decision | `reject` | A generic `EngineAdapter` already exists, while pre-wiring Hermes now conflicts with the accepted defer-and-gate decision. First close tenant, ledger, attestation, parity, license, and operations gates (`lib/engine-adapter.ts:20-26`; `docs/adr/0001-agent-runtime-boundary.md:73-115`). |
| C26 | 13 | Supported | `adopt` | Separating loop/tool logic from deliverable integrity is structurally sound. Current truth must add that the active agent path has moved behind a fail-closed broker/adapter, so the old loop is no longer the production default. |

## Launch Blockers

1. **Current frontend gate is RED.** Static audit has nine violations; the full serial suite has seven failing files and nine failing tests. The dominant owners are the workspace typography overrides and Reports route spacing in `app/globals.css`.
2. **`/reports` fails the mobile first-viewport contract.** At 390px, content begins at `410` while the contract maximum is `387` (`tests/module-shell-design-regression.test.ts:347-350`).
3. **Production agent execution is intentionally unavailable.** `createProductionEngineAdapter` hardcodes `verifySiteBinding: async () => false` until a local attestation sidecar proves site/org binding (`lib/openclaw-broker-route.ts:56-68`). Current integration evidence explicitly did not run OAuth login, a credential-evaluating turn, paid call, or deployment (`evaluation/openclaw-current-integration-2026-07-12/report.md:5-13`).
4. **Commercial persistence needs a fresh production check.** Migration `010` is labeled draft (`supabase/migrations/010_commercial_operations.sql:1-3`), and the last committed read-only production probe found share sessions, read confirmations, and improvements absent. That probe is dated 2026-07-10, so current live status is not assumed.
5. **Tenant isolation is not proven end to end.** Migration text is not a substitute for two-tenant live tests. The null-org dispatch policy, missing legacy-table RLS, cross-table organization/site consistency, storage-object policy, and duplicate read-confirmation race remain unclosed.
6. **No source-bound all-green frontend evidence exists for `ae6b88a`.** The report that claims a complete frontend pass is bound to non-ancestor `92eea81`; current-head reruns are RED.
7. **Planned routes are conditional blockers.** TBM, Worker, and Settings are blockers only if they are included in the launch promise; otherwise they must be explicitly excluded or relabeled.

## Missing Tests

- A real Supabase/Postgres RLS matrix using two organizations, two sites, anon/auth/service roles, and every tenant table.
- Regression coverage for null-organization `dispatch_logs`, cross-organization `site_id` references, and legacy `query_logs`/`documents` exposure.
- Storage-object policy and concurrent duplicate read-confirmation tests for migration `010`.
- Firefox and WebKit responsive/browser runs; current browser automation is Chromium-only.
- TBM and Worker end-to-end tests that persist a real workpack/share session/read confirmation rather than sample/local state.
- A live, site-bound OpenClaw sidecar test proving MCP credential scope, executable-tool allowlist, effect authorization, abort, and tenant separation.
- A source-bound current-HEAD browser audit after the static CSS and `/reports` failures are fixed.
- An ontology coverage matrix by task, hazard, control, article, document, duty, and accident; current tests prove integrity, not domain sufficiency.
- A schema/DDL assertion that `cited_uids` is non-empty before data reaches graph assembly.
- A stable Windows launch-audit process test; the current 75ms fixture timeout produced a repeatable standalone failure.
- Exhaustive coverage for the “all numbers use tabular numerals” design claim.

## Unresolved User Decisions

Only these decisions cannot be resolved from code:

1. **Launch scope:** include TBM/Worker/Settings now, or exclude/relabel them until persistence-backed flows exist. Recommendation: do not advertise planned routes as complete.
2. **Production DB approval:** approve a corrected, split migration for commercial persistence separately from embeddings. Recommendation: add uniqueness, storage policy, tenant-consistency, rollback, and RLS evidence before application.
3. **Supported browser matrix:** decide whether launch support is Chromium-only or includes WebKit/Firefox. Recommendation: require WebKit for mobile launch claims and run Firefox as an additional smoke gate.

No Hermes decision is open now: the accepted repository decision already defers it. No database mutation was performed during this grill.

## Artifact Validation

- `ConvertFrom-Json` parsed `report.json`; all 26 claims and disposition totals matched the declared summary.
- `git diff --cached --check` passed with only the repository's Windows line-ending notices.
