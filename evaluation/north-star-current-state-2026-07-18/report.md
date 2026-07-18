# SafeClaw North Star Current State

Generated at: 2026-07-19 KST  
Authoritative live-proven HEAD: `48a5c8b83d076f427748b0ac2dbe04712ddecec8`

## Purpose

This checkpoint keeps the 24h North Star crunch aligned with the original direction:

- SIF/KOSHA-first evidence harness, with law as the mandate validation layer.
- SafeClaw as the system of record and effect authority.
- Hermes/OpenClaw as versioned engine adapters, not direct database or provider-policy replacements.
- Worker-facing sharing, foreign-language delivery, photo hazard analysis, and Before/After improvement memory as product differentiators.

This is not a completion declaration. It records what current evidence proves and what remains unproven or approval-gated.

## Current Proven Gates

| Axis | Evidence | Current conclusion |
| --- | --- | --- |
| Full serial suite | `evaluation/2026-07-18-authoritative-full-test-current-rerun.log` | 188 files passed / 9 skipped; 2308 tests passed / 15 skipped; exit code 0. |
| Frontend consistency | `evaluation/frontend-audit-runner-port-v2-2026-07-11/` | Static audit and browser audit were refreshed; 111 screenshot rows completed with 0 findings. |
| Current CI and production build | GitHub Actions run `29651333050` | `typecheck`, full `npm.cmd test -- --maxWorkers=1 --fileParallelism=false`, and `npm.cmd run build` all passed in CI for `94d45b02`. |
| Live deployment commit mapping | `GET https://www.safeclaw.kr/api/build-info` | Live production returns `commitSha=94d45b02651f7dd4179988791d8ad564474db954`, `branch=master`, `environment=production`. |
| Public live smoke | `evaluation/live-public-smoke-2026-07-18/report.md` and `report.json` | Public routes responded and showed no horizontal overflow or console/page errors in the checked desktop/mobile smoke. |
| Exact KOSHA registry | `evaluation/live-provider-readiness-2026-07-19/report.md`, `evaluation/kosha-trust-registry-wave2-2026-07-16/report.md`, `evaluation/kosha-runtime-corpus-repackaging-2026-07-18/report.md` | D-C-13, D-C-7, and B-E-10 are exact trust registry entries; KOSHA local corpus is live-ready with the compressed verified subset. Live `/api/safety-reference/status` returns HTTP 200, `searchReady=true`, `localCorpus.status=ready`, `itemCount=234`, `chunkCount=7127`. |
| Live provider readiness | `evaluation/live-provider-readiness-2026-07-19/report.md` | OpenAI vision is ready on live, dispatch is preview-only because provider idempotency remains intentionally locked, KOSHA local corpus is live-ready, and SIF embedding remains approval-held. |
| Current KOSHA reconciliation | `evaluation/kosha-current-master-reconciliation-2026-07-19/report.md` | Current master carries exact production KOSHA pins for D-C-13, D-C-7, and B-E-10. Focused KOSHA gate passed 5 files / 80 tests, Python acquisition passed 19/19, local build generated 28/28 pages, NFT partial exact assets were 0, and live `/api/safety-reference/status` is ready. |
| Ontology UI | `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json` | Default `/ontology` no longer exposes the 166-node hairball; bounded neighborhood UI passes overflow, overlap, contrast, and mobile fullscreen gates in recorded browser evidence. |
| Hermes/OpenClaw boundary | `docs/phase-b-organization-knowledge-and-engine-plan.md` and engine tests | Hermes/OpenClaw remain behind `EngineAdapter`; SafeClaw keeps tenant, MCP, evidence, approval, and effect authority. |
| Tenant/RLS app boundary | `evaluation/supabase-rls-approval-2026-07-17/report.md` and app-layer tests | App-layer tenant and route boundaries are covered; live DB catalog RLS proof is still approval-gated. |
| Document quality/export | `evaluation/2026-07-17-authoritative-release-gate.md` | Core document editor, export localization, Korean labels, and foreign recipient delivery contracts are covered by focused gates. |
| Photo hazard analysis | `evaluation/2026-07-17-authoritative-release-gate.md` | Input-photo analysis supports 10 photos, explicit unconfigured/partial states, accepted candidate provenance, and Before/After improvement memory. |
| Recipient portal | `evaluation/share-recipient-current-gate-2026-07-19/report.md`, `evaluation/share-recipient-live-smoke-2026-07-19/report.md`, `evaluation/share-recipient-route-loop-gate-2026-07-19/report.md` | `/share/[sessionId]` and `/api/share-sessions/[sessionId]` exist on the production-mapped HEAD. The stale `de4103db` "portal absent" finding is closed for current master. Focused gate: 2 files / 41 tests passed; live non-mutating smoke confirms the route shell and invalid-session fail-closed behavior; route-level loop proves manager-created invited session, worker confirmation, and manager confirmation readback without production writes. |
| Manager demo path | Commit `5b6422e2` and release gate | Share screen now shows secondary `작업자 화면 미리보기` when a session and worker id exist, while primary delivery CTA remains unchanged. |

## Remaining Non-Completion Items

These are not failures in the current patch. They are the remaining items that prevent marking the full North Star objective complete.

1. Live Supabase catalog RLS proof remains approval-gated.
   - Current evidence covers app-layer tenant checks and non-mutating readiness.
   - Evidence still needed: live `pg_catalog` policy expressions, `FORCE RLS`, grants, authenticated tenant negative tests, and Storage path isolation.

2. Phase B remains a design contract, not an authorized migration or production cutover.
   - Organization ontology, usage ledger, service-auth traffic, Hermes worker pool, and billing schema are documented but not authorized for implementation.
   - Evidence needed: explicit Phase B entry approval and per-slice migration approval.

3. Real external provider dispatch and production OpenAI vision execution need environment-specific proof.
   - Tests prove contracts and fail-closed behavior.
   - Live readiness now proves OpenAI vision is configured, but dispatch remains preview-only.
   - Next approval artifact: `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`.
   - Evidence still needed: approved idempotency migration, runtime table/RLS/index probe, provider-specific dry run without leaking secrets or sending unintended real messages.

4. Long-term LLM Wiki and organization knowledge promotion are still human-in-the-loop.
   - Current plan preserves public/organization/site memory boundaries.
   - Evidence still needed: approved migration and review-queue implementation beyond the current Phase A/launch-safe scope.

## Recommended Next Work Order

1. Share demo verification:
   - Non-mutating live smoke for `/share/not-a-session?lang=vi` is captured in `evaluation/share-recipient-live-smoke-2026-07-19/report.md`.
   - Non-mutating route-level loop is captured in `evaluation/share-recipient-route-loop-gate-2026-07-19/report.md`.
   - Remaining proof is a real invited session E2E: `/workspace` share flow, `/share/{sessionId}?workerId={workerId}`, worker confirmation, and manager acknowledgment refresh.

2. Provider readiness proof:
   - Review and approve `evaluation/provider-dispatch-idempotency-gate-2026-07-19/provider-dispatch-idempotency-draft.sql`, then implement the route reservation flow before converting dispatch from preview-only.
   - The draft intentionally requires a full tenant tuple and avoids the legacy `dispatch_logs` nullable-organization / `FOR ALL` pattern.

3. KOSHA exact reference expansion:
   - Keep live `/api/safety-reference/status` on the compressed verified subset bundle and do not present the unverified full body recovery corpus as direct runtime evidence.

4. Supabase RLS read-only live audit:
   - Run a read-only catalog audit and tenant A/B negative plan only after confirming safe credentials and no data mutation.

5. Phase B entry packet:
   - Present the already documented Hermes/organization-knowledge plan as the next approval gate, rather than starting migrations implicitly.

## Working-Tree Note

Known unrelated dirty screenshots remain under:

- `output/playwright/2026-07-10/module-shell-hardening/*.png`

They were not included in the recent share/photo/recipient commits.
