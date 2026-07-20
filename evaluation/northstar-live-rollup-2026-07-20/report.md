# SafeClaw North Star Live Rollup

Generated at: 2026-07-20T06:50:00.000Z

Current HEAD: `6331d8aa45b23badca96495e67f762c4dd7702e8`

Current live production build: `3a6b9f4e25739954ba3b89c0b9d067ff52a28ef2`

Overall: `northstar_open_approval_gated`

This rollup does not claim the long-term North Star is complete. It records the current production-visible evidence line and keeps approval-gated items explicit.

## Proven On Current Line

| Gate | Result | Evidence |
| --- | --- | --- |
| Live harness quality | PASS, failed contracts 0 | `evaluation/live-harness-quality-probe-current-2026-07-20/report.json` |
| KOSHA materialization | PASS, 9 files / 169 tests + Python 19 tests + typecheck | `evaluation/kosha-materialization-current-gate-2026-07-20/report.json` |
| KOSHA exact trust registry | PASS, D-C-13 / D-C-7 / B-E-10, focused 5 files / 53 tests | `evaluation/kosha-focused-current-gate-2026-07-20/report.json` |
| KOSHA guide approval packet | APPROVAL REQUIRED before mutation/embedding, 1040 rows audited, 818 empty bodies, 1040 missing official provenance rows, 70 operational-control review rows, 2 retrieval branches unobserved, approval packet tests 2 files / 114 tests | `evaluation/kosha-guide-approval-current-2026-07-20/approval-packet.json` |
| KOSHA guide repair plan | PASS read-only repair queue, 6 workstreams, update 7, retire 1, control review 71, retrieval scenario-branch pairs 8, focused 3 files / 116 tests | `evaluation/kosha-guide-approval-current-2026-07-20/repair-plan.json` |
| RLS / LLM Wiki app boundary | PASS approval-gated, 9 files / 83 tests | `evaluation/rls-current-tenant-boundary-gate-2026-07-20/report.json` |
| Live critical surface | PASS, 8 routes x 2 viewports, 16 rows, findings 0 | `evaluation/live-critical-surface-current-2026-07-20-rerun/report.json` |
| Operator wiki / reference corpus | PASS approval-gated, 18 files / 208 tests, ontology 166/169 | `evaluation/operator-wiki-reference-corpus-current-gate-2026-07-20/report.json` |
| Hermes / OpenClaw runtime boundary | PASS boundary, 13 files / 289 tests, live unauth 401 | `evaluation/hermes-openclaw-runtime-current-gate-2026-07-20/report.json` |
| Export / foreign dispatch quality | PASS, 13 files / 143 tests, no provider side effect | `evaluation/export-foreign-dispatch-current-gate-2026-07-20/report.json` |
| Share recipient portal | PASS, 13 files / 143 tests, live Vietnamese chrome, no provider side effect | `evaluation/share-recipient-portal-current-gate-2026-07-20/report.json` |
| Recipient demo capture | PASS non-mutating 390px capture, overflow 0, min control 44, saved confirmation true | `evaluation/recipient-demo-capture-2026-07-20/metrics.json` |
| Workspace documents/share geometry | PASS, generated state verified, desktop docs 1.27x, mobile docs 1.68x, desktop share 1180px | `evaluation/workspace-docs-share-production-gate-2026-07-20/metrics.json` |
| UI documents contrast | PASS, focused UI 4 files / 19 tests, build 28/28 | `evaluation/ui-documents-contrast-current-gate-2026-07-20/report.json` |

## Still Approval-Gated

| Gate | State | Evidence |
| --- | --- | --- |
| SIF embedding runtime | Migration required; corpus ready; execution env ready after approval; vector flag off | `evaluation/sif-embedding-gate/approval-preflight-report.json` |
| Supabase RLS launch isolation | Approval-ready preflight only; launch readiness false | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` |
| LLM Wiki publication | Approval-ready preflight only; publication unavailable | `evaluation/rls-llm-wiki-approval-preflight-current-2026-07-20/report.json` |
| KOSHA guide full corpus embedding | Approval required; official provenance/body repair needed first | `evaluation/kosha-guide-approval-current-2026-07-20/approval-packet.json` |

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





