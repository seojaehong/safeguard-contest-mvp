# SafeClaw North Star Live Rollup

Generated at: 2026-07-20T05:19:48.112Z

Current HEAD / live production build: `ceda7092e834db3c38769e5523c7452125084411`

Overall: `northstar_open_approval_gated`

This rollup does not claim the long-term North Star is complete. It records the current production-visible evidence line and keeps approval-gated items explicit.

## Proven On Current Line

| Gate | Result | Evidence |
| --- | --- | --- |
| Live harness quality | PASS, failed contracts 0 | `evaluation/live-harness-quality-probe-current-2026-07-20/report.json` |
| KOSHA materialization | PASS, finding count 0 | `evaluation/kosha-live-materialization-2026-07-20/report.json` |
| KOSHA exact trust registry | PASS, D-C-13 / D-C-7 / B-E-10, focused 5 files / 53 tests | `evaluation/kosha-focused-current-gate-2026-07-20/report.json` |
| RLS / LLM Wiki app boundary | PASS approval-gated, 9 files / 83 tests | `evaluation/rls-current-tenant-boundary-gate-2026-07-20/report.json` |
| Live critical surface | PASS, 8 routes x 2 viewports, findings 0 | `evaluation/live-critical-surface-current-2026-07-20-rerun/report.json` |
| Operator wiki / reference corpus | PASS approval-gated, 18 files / 208 tests, ontology 166/169 | `evaluation/operator-wiki-reference-corpus-current-gate-2026-07-20/report.json` |
| Hermes / OpenClaw runtime boundary | PASS boundary, 13 files / 289 tests, live unauth 401 | `evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json` |
| Export / foreign dispatch quality | PASS, 9 files / 67 tests, no provider side effect | `evaluation/export-foreign-dispatch-current-gate-2026-07-20/report.json` |
| UI documents contrast | PASS, focused UI 4 files / 19 tests, build 28/28 | `evaluation/ui-documents-contrast-current-gate-2026-07-20/report.json` |

## Still Approval-Gated

| Gate | State | Evidence |
| --- | --- | --- |
| SIF embedding runtime | Migration required; corpus ready; execution env ready after approval; vector flag off | `evaluation/sif-embedding-gate/approval-preflight-report.json` |
| Supabase RLS launch isolation | Approval-ready preflight only; launch readiness false | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` |
| LLM Wiki publication | Approval-ready preflight only; publication unavailable | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` |

## Safe Demo Claims

- SafeClaw fixes SIF/KOSHA/current work-history evidence before LLM wording.
- KOSHA exact-trust pins and live harness contracts are proven on the current production line.
- SIF embedding corpus is prepared, but vector retrieval remains disabled until approved migration/upload/runtime verification.

## Forbidden Claims

- RLS launch isolation is proven.
- LLM Wiki publication is available.
- SIF vector retrieval is production-active.
- All KOSHA metadata rows are exact evidence.
- DB migration or data upload was performed in this rollup.




