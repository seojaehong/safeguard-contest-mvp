# SafeClaw Current Live Reconciliation

Generated: 2026-07-18 KST

Authoritative local HEAD at check: `62cccafbdeb5a87e045c9f9bd7c43619029ddd17`

Live target: `https://www.safeclaw.kr`

## Purpose

This checkpoint reconciles stale read-only handoffs with the current `master` state before demo/launch work continues. It does not change product code.

## Current Facts

| Axis | Current result | Evidence |
| --- | --- | --- |
| Recipient portal | Implemented on current HEAD. The stale report that says there is no worker-facing portal is not current. | `app/share/[sessionId]/page.tsx`, `app/api/share-sessions/[sessionId]/route.ts`, `components/WorkflowSharePanel.tsx` |
| Manager preview action | Implemented as a secondary action after a share session and worker id exist. | `recipientPortalPreviewHref` and visible copy `작업자 화면 미리보기` in `components/WorkflowSharePanel.tsx` |
| Live recipient route shell | Available on production. | `GET https://www.safeclaw.kr/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?workerId=11111111-1111-4111-8111-111111111111` returned HTTP `200` |
| KOSHA runtime corpus | Ready on production. The older live-provider readiness report that said local corpus was unconfigured is stale for current live. | `GET /api/safety-reference/status` returned `ok=true`, `status=ready`, `searchReady=true`, `localCorpus.status=ready`, `itemCount=234`, `chunkCount=7127` |
| Photo hazard analysis | Ready on production. | `GET /api/input-photos/hazard-analysis` returned `status=ready`, `provider=openai`, `apiKeyPresent=true`, `maxInputPhotos=10` |
| Provider dispatch | Still preview-only. | `GET /api/workflow/dispatch` returned `providerDispatch.capability=false`, `mode=preview_only`, `reason=persistent_idempotency_unavailable` |
| Live harness quality | Passed after current harness remediation. | `evaluation/live-harness-quality-probe-2026-07-18-after-control-fix/report.md` |
| Frontend browser audit | Latest file is `browser-report.md`, not `report.md`; current recorded audit has `111/111` rows, failed rows `0`, findings `0`. | `evaluation/frontend-audit-current-head-2026-07-18/browser-report.md` |

## Reconciled Decision

1. The recipient portal is no longer a missing-route blocker for current HEAD. The remaining share limitation is real external dispatch, not the existence of the worker-facing page.
2. The KOSHA local corpus is no longer live-unconfigured. Demo language should say the runtime product uses the verified KOSHA subset, not the unreduced body recovery corpus.
3. Photo risk analysis is live-ready for up to 10 images, but actual production image POST still depends on normal auth/storage/user flow.
4. Email/SMS/Kakao provider sending should still be described as preview-only until persistent idempotency and provider credentials are proven in a safe dry run.
5. Long-term Hermes/OpenClaw, organization ontology, usage ledger, and LLM Wiki work remain Phase B/approval-gated and should not be described as completed production migrations.

## Commands Used

```powershell
git rev-parse HEAD
rg -n "recipientPortalPreviewHref|/share/|작업자 화면 미리보기|workpack_share_sessions|anonymousAllowed" components app tests evaluation -S
Invoke-WebRequest -Uri "https://www.safeclaw.kr/api/safety-reference/status" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "https://www.safeclaw.kr/api/input-photos/hazard-analysis" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "https://www.safeclaw.kr/api/workflow/dispatch" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "https://www.safeclaw.kr/share/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb?workerId=11111111-1111-4111-8111-111111111111" -UseBasicParsing -TimeoutSec 30
```

## Follow-Up Order

1. Keep live demo focused on `workspace -> document -> share -> worker preview`.
2. If time allows, run one real share-session creation in an authenticated preview environment and open the generated `작업자 화면 미리보기`.
3. Keep external dispatch in preview mode unless idempotency and provider dry-run evidence are added.
4. Do not reopen DB migration, SIF embedding upload, or Phase B Hermes/LLM Wiki migration during the imminent demo window.
