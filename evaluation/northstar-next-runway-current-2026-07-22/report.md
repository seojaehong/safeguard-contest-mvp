# North Star Next Runway

Checked at: 2026-07-22 KST

Verdict: `OPEN_APPROVAL_GATED`

Source HEAD: `8799b707923228487d056f4c2037daf07c8fa218`

Production `/api/build-info`: `8799b707923228487d056f4c2037daf07c8fa218`

Open-gate artifact: `evaluation\northstar-open-gates-current\report.json`

Live-rollup artifact: `evaluation\northstar-live-rollup-2026-07-20\report.json`

## Proven Current State

- Live harness quality is proven.
- KOSHA exact trust registry is proven for the current accepted exact-trust slice.
- Documents and Share cockpit UI is proven for the current evidence scope.
- Standalone Dispatch cockpit is proven for the current evidence scope.
- Generated Share result fixture cockpit is proven without claiming real provider dispatch.
- Hermes/OpenClaw runtime architecture is proven at the adapter, policy, service-auth, route, and fail-closed boundary level without claiming live production engine execution.
- Final-99 is `pass_with_notice`, not clean launch-complete. The notices are carried explicitly in `evaluation\final-99-gate-current-2026-07-21\notice-carry.json`.

## Approval-Gated Boundaries

These are not blocked by missing CSS or missing frontend evidence. They require explicit approval before runtime mutation or live claims:

| Gate | Current state | Why it remains held |
| --- | --- | --- |
| Provider dispatch persistence | `approval_gated` | Persistent idempotency and provider-result persistence are not approved or live verified. |
| Supabase RLS launch isolation | `approval_gated` | Live catalog and disposable tenant A/B isolation proof are not approved. |
| LLM Wiki publication | `approval_gated` | Publication RPC/RLS/ledger approval and canary are not complete. |
| SIF embedding runtime | `approval_gated` | Migration, embedding cost, upload, and vector runtime approval remain separate. |

## UI/UX Follow-Up Boundary

The current live geometry splits the user's Documents and Share concern as follows:

- Default Documents cockpit: raw route height is closed in the current live geometry.
- Selected editor/detail: the first risk-row header and hazard field land in the first viewport, but the raw long-form textarea remains secondary drilldown below the first viewport.
- Share desktop: raw geometry is two-column, not a literal mobile stack; if it still feels mobile-like, treat that as a visual full-workbench composition follow-up.
- Share mobile: current compact cockpit remains first-viewport bounded in the current evidence.

Route/page split alone is not accepted as the UX fix. The accepted structure is step split plus first-viewport cockpit plus bounded drilldown/detail panes for long documents, messages, logs, and raw metadata.

## Next Safe Work Without Approval

1. Keep refreshing source/live exact evidence when production marker advances.
2. Keep UI follow-up strictly scoped to drilldown readability or perceived desktop workbench composition.
3. Keep Hermes/OpenClaw as a bounded external runtime/adapter path until authenticated tenant-bound execution, replay ledger, tool denial, Evidence Harness, and terminal ledger gates are proven.
4. Keep provider dispatch, RLS, LLM Wiki publication, and SIF vector runtime as approval-required gates.
5. Do not convert `pass_with_notice` into a full launch claim until admin-auth history reuse and approved provider dispatch are verified in a secure environment.
