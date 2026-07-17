# SafeClaw authoritative release gate

## Scope

- Original integration source HEAD: `2b4316056b44b8729903d364d93022a916383ab6`
- Current product verification HEAD: `05c19890f5b4f63684e38a38471d2600043c0227`
- Later commits in this file are documentation-only evidence refreshes unless stated otherwise.
- KOSHA exact-trust Wave 2: already present on the authoritative branch with equivalent product and evidence patches.
- Remote Hermes: trusted-transport and durable-attempt-ledger boundary integrated; product execution remains disabled until those application-owned dependencies are supplied.

## Verification

### Full test suite

- Command: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=hanging-process`
- Current HEAD result: 188 files passed, 9 skipped; 2,301 tests passed, 15 skipped.
- Evidence log: `evaluation/2026-07-17-authoritative-full-test-current.log` (local generated log, intentionally not committed).
- The prior stale frontend browser-evidence source identity failure is no longer present on the current HEAD.

### Focused backend trust gate

- Integrated Hermes and KOSHA focus: 15 files / 274 tests passed.
- Strict typecheck passed.

### Build and frontend audit

- Normal production build: passed, 28/28 static pages generated.
- Fresh current-HEAD production build after the KOSHA/share evidence refresh: passed, 28/28 static pages generated.
- Fresh current-HEAD strict typecheck after build: passed.
- Note: running `npm.cmd run typecheck` before a fresh `next build` failed because `tsconfig.json` includes `.next/types/**/*.ts` and the generated Next type files were missing. The subsequent `npm.cmd run build` regenerated `.next/types`, and the immediate typecheck rerun passed. This is recorded as a build-artifact ordering issue, not a source type error.
- Static frontend contract: 33 pages, 23 product components, 0 coverage issues, 0 violations.
- Normal bundle contract: passed; audit marker count 0.
- Audit bundle contract: passed; deterministic marker present only in the audit graph.
- Audit runtime boundary: HTTP 500 expected, one boundary marker, no unfiltered page or console errors.
- Browser matrix: 111/111 rows passed, 111 screenshots, 0 failed rows, 0 recovered rows, 0 findings.

### Export contract

- Direct XLSX POST: HTTP 200, 8,384 bytes, 18/18 expected headers, no missing headers.
- Direct binary PDF POST: HTTP 200, `application/pdf`, 22,106 bytes, `%PDF-` magic, not HTML.
- PDF NFT trace contains Noto Sans KR Regular, Bold, and OFL assets.
- Focused PDF/export tests: 3 files / 30 tests passed in the build-dependent focused run; production-only browser matrices remained conditionally skipped and are covered by the 108-row audit.
- Artifact: `evaluation/2026-07-17-authoritative-output-contract/report.json`.

## Honest limitations

- Remote Hermes production execution is intentionally unavailable until an application-owned connection-pinned transport and durable attempt ledger are wired.
- DB migration, published ontology mutation, and production data mutation were not performed.
- Existing unrelated/generated screenshot changes outside the current audit artifact set were not staged.

## 2026-07-17 Continuation Evidence

Current continuation HEAD after the KOSHA broad gate and frontend recipient-route audit refresh: `0b2187d54e1bfda6e992505e2c01627a419827c9`.

### KOSHA D-C-13 applicability

- `외벽 로프 작업 안전점검` and `외벽 로프 청소 작업` now map to the exact trusted D-C-13 exterior-wall KOSHA reference.
- `로프 구매 가격 비교` remains non-applicable, so commercial rope queries do not reopen direct evidence.
- Focused policy test: `tests\exact-kosha-applicability-policy.test.ts` passed, 1 file / 17 tests.
- KOSHA + ontology focused gate passed, 7 files / 179 tests.
- Strict typecheck passed.
- Normal production build passed, 28/28 static pages.

### Current master KOSHA exact-trust Wave 2 focused gate

Fresh current-HEAD verification:

- Command: `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts`
  - Result: 5 files / 80 tests passed.
- Command: `python -m unittest scripts.tests.test_acquire_exact_kosha_body`
  - Result: 19 tests passed.

This proves the current master still has the D-C-13/D-C-7 exact trust registry, fail-closed KOSHA grounding, bounded applicability policy, and acquisition parser contract alive after the share/Hermes evidence refresh. The broader historical KOSHA corpus audit RED is addressed separately in the next gate.

### Current master KOSHA broad corpus gate

The historical KOSHA corpus audit RED is now resolved on current master.

- Fix: `scripts/audit_kosha_guides.mjs` now performs bridge-only snapshot integrity and missing-credential fail-closed checks before loading the Vite module server.
- This closes the previous timeout path where tampered snapshots, traversal snapshot pointers, and missing Supabase credentials produced empty output or no `audit.log`.
- `npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts`
  - Result: 1 file / 110 tests passed.
- 34-file KOSHA/SIF/ontology broad gate:
  - Result: 31 files passed, 3 skipped; 395 tests passed, 4 skipped.
- Strict typecheck passed after the fix.
- Artifact: `evaluation/kosha-trust-registry-wave2-2026-07-16/kosha-sif-ontology-tests.log`.

This upgrades the prior KOSHA exact-trust Wave 2 evidence from focused-only product PASS with broad RED to focused plus broad PASS. It does not perform DB mutation, schema migration, embedding generation, or production data writes.

### Live `/ontology` P0 visual gate

The earlier live audit reported a 166-node hairball graph with severe overlap and contrast failures. Current production no longer exposes that default surface.

Fresh live browser gate:

- Command: `$env:ONTOLOGY_BASE_URL='https://www.safeclaw.kr'; npm.cmd test -- tests\ontology-ui-browser.test.ts`
- Result: 1 file / 1 test passed.
- Desktop and tablet Day/Night: 15 visible neighborhood nodes, overlap pairs 0, horizontal overflow 0.
- Mobile Day/Night: default graph hidden, relation-card view visible, fullscreen graph verified with 15 nodes, dialog keyboard trap verified.
- Minimum control height: 44px.
- Minimum node text contrast: 5.6:1.
- Artifact: `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`.

This proves the current production `/ontology` surface is now a selected-neighborhood explorer rather than an unreadable full-graph hairball.

### Live `/why` mobile comparison gate

The earlier live audit reported a mobile comparison table extending to roughly 889px on a 390px viewport. Current production reflows the comparison table into stacked readable cards.

Fresh live geometry probe:

- Route: `https://www.safeclaw.kr/why?theme=day` and `?theme=night`
- Viewport: 390px by 844px
- Document horizontal overflow: 0 in both themes
- Out-of-viewport visible elements: 0 in both themes
- Comparison table width: 332px in both themes
- Body row widths: `[332, 332, 332, 332, 332]` in both themes
- First row display: `grid`
- Visible mobile cell labels: `SafeClaw`, `안전관리 SaaS`, `한글·엑셀 양식`, `일반 AI`
- Focused layout test: `npm.cmd test -- tests\why-mobile-layout.test.ts` passed, 1 file / 4 tests.

This proves the current production `/why` comparison surface no longer clips horizontally on the audited mobile viewport.

### Live blank `/workspace` input gate

The earlier live audit reported that clicking `안전 문서 생성` on a clean blank workspace produced no alert, no focus movement, and no visible error. Current production now fails closed on the client before any generation request.

Fresh live probe:

- Route: `https://www.safeclaw.kr/workspace?theme=day`
- Viewport: 390px by 844px
- Action: clear local storage, reload, leave `#field-command-input` blank, click `안전 문서 생성`
- Error text: `현장 상황을 입력해 주세요.`
- Error role: `alert`
- Input `aria-invalid`: `true`
- Focus after click: `#field-command-input`
- Focused regression test: `npm.cmd test -- tests\workspace-layout-regression.test.ts --testNamePattern="focuses the input and announces an error when blank generation is submitted"` passed, 1 file / 1 test.

This proves the current production workspace no longer silently ignores a blank first action.

### Live CTA contrast spot gate

The earlier live audit reported low-contrast white/yellow CTA combinations on several public and product routes. A fresh Day mobile spot probe found no remaining low-contrast interactive controls with opaque backgrounds on the cited route set.

Fresh live probe:

- Viewport: 390px by 844px
- Routes: `/documents`, `/roadmap`, `/why`, `/settings/ai-connect`, `/search`, `/worker`, `/workers`, `/archive`, `/home`
- Method: collect visible `a[href]`, `button`, and `[role="button"]` elements, compute foreground/background contrast where the element has an opaque background, report controls below 4.5:1.
- Result: low-contrast controls `0` on every probed route.

This proves the previously cited white-on-yellow CTA contrast issue is not present on the current production route set.

### Live internal-terminology spot gate

The earlier live audit reported user-facing internal implementation terms such as DB harness, raw JSON/JSONL, Obsidian, and raw logs. A fresh mobile Day probe did not find those terms in the current visible route bodies.

Fresh live probe:

- Viewport: 390px by 844px
- Routes: `/workspace`, `/documents`, `/reports`, `/ontology`, `/dryrun`, `/knowledge`, `/ops/api`
- Terms checked: `DB 하네스`, `품질 계약`, `관리자 원본 JSON`, `다음 생성용 MD`, `하네스 JSONL`, `JSONL`, `Obsidian`, `API path`, `sample id`, `dryrun`, `raw log`, `published_ontology`, `Published ontology`
- Result: 0 hits on every probed route.

This proves the previously cited internal implementation terminology is not visible on the current production route set.

### Recipient portal and foreign-worker delivery gate

Current production code includes a worker-facing recipient confirmation page at `/share/[sessionId]`. The previous report that treated the recipient portal as unimplemented is stale for the current HEAD.

Fresh focused gates:

- `npm.cmd test -- tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts tests\workflow-share-panel-behavior.test.ts tests\share-recipient-portal-browser.test.ts`
  - Result: 4 files / 69 tests passed.
- `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts`
  - Result: 1 file / 1 test passed.
- `npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts`
  - Result: 2 files / 32 tests passed.

Verified contract:

- The manager language selector is preview-only.
- Server dispatch derives canonical per-recipient message variants from the stored workpack and active share-session snapshot.
- Canonical recipient variants were verified for simultaneous `ko`, `en`, `vi`, `zh`, and `th` recipients. Duplicate recipient language requests collapse to one server-authoritative message variant.
- Foreign recipient DTOs fail closed on Korean text leaks, unknown languages, malformed stored language entries, forged message variants, and SMS bodies above the relay-safe length budget.
- A Korean text leak in one foreign-language variant fails only that canonical bundle instead of silently falling back to a Korean or manager-facing message.
- The invited recipient page renders on mobile without horizontal overflow, preserves 44px controls, preselects the stored worker language, and posts `{ workerId, displayName, languageCode }` for confirmation.
- Live route existence probe: `https://www.safeclaw.kr/share/test-session-id` returned HTTP 200 and a Next page containing the current deployment asset marker `dpl_B8zyhtxqTq3B3Ac2HdBR3ddQ2KKY`; this proves the worker-facing share route is deployed as a page surface. Functional confirmation still requires a real issued share session or the local mocked route tests above.
- Actual provider dispatch remains gated until the persistent idempotency/storage migration receives explicit approval.

### Frontend contract refresh with recipient route

Fresh current-HEAD audit evidence now includes the worker-facing `/share/[sessionId]` surface as a first-class product route.

- Pre-commit source HEAD used for generated audit evidence: `5e477ac77f78be1b7eefd7bda06a247c909bb91c`.
- Static frontend contract: 33 pages, 23 product components, 0 coverage issues, 0 violations.
- Browser matrix: 111/111 rows passed, 111 screenshots, 0 failed rows, 0 recovered rows, 0 findings.
- Focused frontend contract tests: 2 files / 61 tests passed.
- Foreign recipient share client test: 1 file / 30 tests passed.
- Strict typecheck passed.
- Normal production build passed, 28/28 static pages.

Verified fixes:

- `/share/[sessionId]` is now represented in the static route inventory, browser route matrix, and route coverage contract.
- Invalid share session ids are rejected on the recipient page before any API call, so deterministic audit fixtures do not produce user-visible or console-level `/api/share-sessions` failures.
- `/interpretation/[id]`, `/law/[id]`, and `/precedent/[id]` are treated as deterministic missing-record fallbacks in the browser audit when no checked-in fixture exists.

### Recipient portal document-pack viewing refresh

The worker-facing share page now behaves as a lightweight document-pack viewer, not only a confirmation button.

Fresh current-tree gates:

- `npm.cmd test -- tests\workpack-commercial-tenant-hardening.test.ts tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts`
  - Result: 3 files / 41 tests passed.
- `npm.cmd test -- tests\frontend-design-contract.test.ts tests\frontend-route-coverage.test.ts`
  - Result: 2 files / 61 tests passed.
- `npm.cmd run typecheck`
  - Result: passed.
- `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.
- `npm.cmd run audit:frontend-consistency`
  - Result: 33 pages, 23 product components, 0 coverage issues, 0 violations.
- `node .\scripts\frontend_consistency_browser_audit.mjs` against the fresh production build on port 3011
  - Result: 111/111 screenshots, 0 failed rows, 0 recovered rows, 0 findings.

Verified fixes:

- Public share session reads `workpacks.deliverables` and returns a safe recipient-facing document pack: `위험성평가표`, `TBM 브리핑`, and `TBM 기록`.
- The recipient page shows the stored worker-language message first, then the core 3-document pack, then the read-confirmation controls.
- The public API still filters recipient hints by invited `workerId` and stores confirmations from the server-authoritative recipient snapshot, ignoring forged client fields.
- Internal evidence, DB harness diagnostics, JSONL, and full manager-only workpack data are not added to the recipient DTO.

### Document editor provenance separation refresh

The current document editor keeps the editable submission body separate from provenance and audit appendices. This closes the earlier issue where KOSHA/legal/internal evidence text could be mixed into the visible editor body as if it were part of the submitted document.

Fresh current-tree gates:

- `npm.cmd test -- tests\north-star-document-ux.test.ts tests\documents-editor-layout.test.ts`
  - Result: 2 files / 34 tests passed.
- `npm.cmd test -- tests\workflow-share-client.test.ts tests\workflow-share-panel-behavior.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\share-recipient-portal-browser.test.ts`
  - Result: 4 files / 40 tests passed.

Verified fixes:

- Review mode has one compact provenance trigger (`근거 N건 · 확인 필요 M건`) instead of a persistent right evidence rail or repeated yellow evidence badges.
- Edit mode renders structured body sections as separate textareas and moves source/provenance appendices into the `근거 부록` area inside the collapsed provenance drawer.
- The editor keeps 12 document options available while preserving mobile no-overflow, no nested scroll container, no clipped controls, and no sub-44px visible touch targets in the north-star browser matrix.
- Share v2 remains focused on target, channel, language preview, message preview, and one primary send action; recipient portal and foreign-language delivery contracts still pass after the document editor refresh.

### Core document body integrity gate

The quality contract now includes a `문서 본문 검수` item for the three core deliverables: `riskAssessmentDraft`, `tbmBriefing`, and `tbmLogDraft`. If any core body is missing, too short, placeholder-heavy, or missing required document terms, the overall quality contract becomes `blocked`, which keeps the existing share-readiness gate closed.

Fresh current-tree gates:

- RED first: `tests\quality-contract.test.ts` failed before implementation because `qualityContract.integrity` was absent and placeholder-heavy `riskAssessmentDraft` still produced an overall `ready`.
- `npm.cmd test -- tests\quality-contract.test.ts tests\deliverable-integrity-policy.test.ts tests\workpack-readiness.test.ts`
  - Result: 3 files / 24 tests passed.
- `npm.cmd test -- tests\commercial-harness.test.ts tests\live-harness-quality-probe.test.ts tests\answer-panel-display.test.ts`
  - Result: 3 files / 64 tests passed.
- `npm.cmd run typecheck`
  - Result: passed.

Verified fixes:

- Placeholder-heavy core documents now produce `qualityContract.overall = blocked`.
- The `integrity` summary records checked count, blocked count, blocked keys, and a user-facing detail string.
- Existing DB-harness, workpack readiness, and answer-panel display contracts continue to pass.
- Edited workpacks recompute the core body integrity gate during deterministic revalidation. A document can no longer regain share readiness merely because ontology revalidation passes while `riskAssessmentDraft`, `tbmBriefing`, or `tbmLogDraft` still contains unresolved placeholders.
- Malformed or incomplete DB harness packets are classified as blocked quality-contract state instead of throwing during quality-contract rebuild.

Fresh post-commit current-HEAD gates:

- `npm.cmd test -- tests\frontend-design-contract.test.ts tests\frontend-route-coverage.test.ts tests\product-module-shell.test.ts`
  - Result: 3 files / 64 tests passed.
- `npm.cmd test -- tests\engine-runtime-readiness-policy.test.ts tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\claw-chat-route.test.ts tests\remote-engine-protocol.test.ts tests\remote-hermes-service-auth.test.ts`
  - Result: 6 files / 180 tests passed.
- `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.
- `npm.cmd test -- tests\workpack-readiness.test.ts tests\quality-contract.test.ts tests\deliverable-integrity-policy.test.ts`
  - Result: 3 files / 25 tests passed.
- `npm.cmd test -- tests\commercial-harness.test.ts tests\workflow-share-client.test.ts tests\workpack-share-authority-routes.test.ts`
  - Result: 3 files / 112 tests passed.
- `npm.cmd run typecheck`
  - Result: passed.

### Hermes / EngineAdapter current boundary gate

The long-term Hermes/OpenClaw direction remains active, but current production does not claim a runnable external engine. It keeps SafeClaw's evidence harness as the system of record and presents the engine as inactive until the trusted transport and durable attempt ledger exist.

Fresh focused gate:

- `npm.cmd test -- tests\engine-runtime-readiness-policy.test.ts tests\engine-adapter.test.ts tests\hermes-engine-adapter.test.ts tests\claw-chat-route.test.ts tests\remote-engine-protocol.test.ts tests\remote-hermes-service-auth.test.ts`
  - Result: 6 files / 180 tests passed.

Fresh live `/ops/api` probe:

- Route: `https://www.safeclaw.kr/ops/api?theme=day`
- User-facing engine status text includes: `실행 엔진`, `연결 전`, `연결 상태 비활성`, `근거 권한 SafeClaw 고정`, `사람 확인 항상 필요`, `에이전트 실행 경계 비활성`.
- Internal raw readiness strings such as `remote-contract-ready`, `executionReady`, or `disabled` were not visible in the route body.

This proves the current production surface does not overstate Hermes runtime readiness while preserving the long-term EngineAdapter path.

### AiConnect copy/runtime boundary gate

The AI connection page now separates token issuance from actual document execution.

Fixes verified:

- The harness tab no longer says that connecting OpenClaw immediately writes documents.
- The page states that SIF/KOSHA/work-history are checked first and that actual document generation runs only through the SafeClaw approval flow.
- Engine readiness policy still reports remote Hermes as not execution-ready until the trusted transport and durable attempt ledger are supplied.

Fresh current-tree gates:

- `npm.cmd test -- tests\customer-terminology-boundary.test.ts tests\engine-runtime-readiness-policy.test.ts tests\ai-connect-production-matrix.test.ts`
  - Result: 2 files passed, 1 file skipped; 13 tests passed, 2 skipped.
- `npm.cmd run typecheck`
  - Result: passed.
- `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.

### Before/After photo improvement memory gate

The workspace now keeps rejected or held operation improvements out of the next DB-harness generation memory. This preserves the intended human decision boundary: accepted input-photo hazard candidates and usable saved improvements may inform the next risk assessment/TBM, but explicitly rejected or held improvement records cannot silently re-enter the generation loop.

Fresh current-tree gates:

- RED first: `tests\operation-improvement-history.test.ts` failed because `operationImprovementsToHarnessImprovements` did not exist and stored operation improvements had no filtered harness-memory boundary.
- `npm.cmd test -- tests\operation-improvement-history.test.ts tests\operation-improvements.test.ts tests\commercial-harness.test.ts`
  - Result: 3 files / 70 tests passed.
- `npm.cmd test -- tests\reporting-downloads.test.ts tests\workpack-improvement-route.test.ts tests\photo-vision-analysis-route.test.ts`
  - Result: 3 files / 52 tests passed.
- `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.
- `npm.cmd run typecheck`
  - Result: passed after the build regenerated `.next/types`.

Verified fixes:

- `rejected` and `on_hold` improvements are filtered before conversion to DB-harness memory.
- `candidate` and `approved` photo-analysis improvements still flow into harness memory, so a manager's saved Before/After improvement candidate can still come back into the next 위험성평가/TBM loop.
- The workspace generation path now uses the filtered conversion helper instead of mapping every local operation-improvement record directly.
- Existing photo analysis, report download, workpack-improvement route, and commercial harness contracts continue to pass.

### Live output integrity gate

Fresh production output integrity passed against the current live deployment marker `dpl_36k9BvS1pTSzivrhDxHiPb9zeo5U`.

Command:

- `$env:SAFECLAW_OUTPUT_INTEGRITY_BASE_URL='https://www.safeclaw.kr'; $env:SAFECLAW_OUTPUT_INTEGRITY_OUT_DIR='evaluation/final-output-integrity-audit-2026-07-18'; npm.cmd run audit:output-integrity`

Result:

- Overall verdict: `pass`
- Base URL: `https://www.safeclaw.kr`
- Generated: `2026-07-17T15:59:46.196Z`
- Elapsed: 138,731 ms
- Ask scenarios: 3/3 passed
- Ask deliverables: 11/11 passed for each scenario
- Generated download/export files: 14/14 passed for each scenario
- Blocked documents: none
- Blocked files: none
- Artifact: `evaluation/final-output-integrity-audit-2026-07-18/report.md`
- Machine report: `evaluation/final-output-integrity-audit-2026-07-18/report.json`

Scenario coverage:

- `서울 건설 강풍`: 11/11 live deliverables passed; 14/14 generated files passed.
- `인천 물류 우천`: 11/11 live deliverables passed; 14/14 generated files passed.
- `안산 제조 화기 외국인 포함`: 11/11 live deliverables passed; 14/14 generated files passed.

This verifies live document quality across core risk assessment, TBM, education, emergency, photo/evidence, foreign-worker briefing/transmission, and Kakao/share message outputs, plus text/json/csv/xls/doc/html/hwpx/hwp/xlsx/pdf/jpg and bundle export signatures.

### Live release scale and operator readiness gate

Fresh production release-scale audit also passed against `https://www.safeclaw.kr`.

Command:

- `$env:SAFECLAW_RELEASE_BASE_URL='https://www.safeclaw.kr'; $env:SAFECLAW_RELEASE_AUDIT_OUT_DIR='evaluation/final-release-scale-audit-2026-07-18'; npm.cmd run audit:release-scale`

Result:

- Overall verdict: `pass`
- Generated: `2026-07-17T16:00:16.572Z`
- Automated verdict: `pass`
- Release verdict: `pass`
- Exit verdict: `pass`
- Strict mode: `false`
- Automated gates: 13/13 passed
- Release gates: 2/2 passed
- Artifact: `evaluation/final-release-scale-audit-2026-07-18/final-release-scale-audit.md`
- Machine report: `evaluation/final-release-scale-audit-2026-07-18/final-release-scale-audit.json`

Verified coverage:

- Production `/api/ask` generated the existing web workflow with 11 deliverables and no missing documents.
- `/settings/ai-connect` rendered successfully.
- AI token API and MCP API both returned the expected auth guard responses without leaking access.
- Tenant-scoped token storage remains hash-only with organization/site scope.
- Token listing uses bounded cursor pagination and bounded site-name lookup.
- Active token caps and operator scale documentation remain present.
- The scale envelope models 1, 10, 100, 1,000, and 10,000 users with constant per-request row bounds.
- Supabase Kakao provider redirect is enabled and points back to the production callback.
- MCP token query indexes are present in the approved migration evidence.

### KOSHA current-head evidence refresh

Fresh KOSHA/SIF/ontology evidence was refreshed on current HEAD `32f5fd9732ca18d5981be82ae5532b4f5ba78aff`.

Artifact:

- `evaluation/kosha-current-head-refresh-2026-07-18/report.md`
- `evaluation/kosha-current-head-refresh-2026-07-18/report.json`

Results:

- KOSHA exact trust/applicability focused suite: 6 files / 114 tests passed.
- KOSHA corpus audit: 1 file / 110 tests passed.
- SIF/KOSHA/ontology broad suite: 31 files passed / 3 skipped, 395 tests passed / 4 skipped.
- Python exact-body acquisition: 19 tests passed.
- Strict TypeScript typecheck: passed.
- Production build: passed, 28/28 static pages generated.
- Next NFT exact KOSHA trace: 81 manifests, 17 include all 3 exact assets, 0 partial manifests.

### Ontology UI P0 current-head refresh

The `/ontology` hairball graph blocker remains closed on current HEAD `c80b45e868c60b38ec523ae7334e8502bb752772`.

Artifact:

- `evaluation/ontology-ui-remediation-2026-07-15/report.md`
- `evaluation/ontology-ui-remediation-2026-07-15/report.json`
- `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`

Results:

- Focused ontology contract: 3 files / 10 tests passed; 2 browser-gated files skipped without base URL.
- Production browser contract with `ONTOLOGY_BASE_URL=http://localhost:3011`: 2 files / 3 tests passed.
- Production typography matrix with `ONTOLOGY_TYPOGRAPHY_PROD_MATRIX=1`: 1 file / 1 test passed.
- Strict TypeScript typecheck: passed.
- Production build: passed, 28/28 static pages generated.
- Browser metrics: 6 variants, horizontal overflow 0, overlap pairs 0, minimum control height 44px, desktop visible neighborhood nodes 15, mobile default relation cards with expanded graph 15 nodes.

### Frontend audit evidence refresh and share copy boundary

The frontend browser audit evidence was refreshed after the share-recipient route and final share-panel copy boundary were reconciled.

Fixes verified:

- The workspace Day/Night geometry comparison now ignores non-geometric readiness state classes (`pending`, `ready`) while preserving actual geometry, spacing, radius, and typography checks.
- The share panel no longer exposes a raw `/share/[sessionId]` link as a default administrator CTA. It describes the current implemented boundary as administrator-side dispatch/confirmation tracking and displays only the session ID when present.

### 2026-07-18 UI blocker recheck

The prior live-audit blockers for `/why`, blank workspace submission, and module contrast were rechecked on HEAD `e1298644be1a78a59b0be8ef4cd4513c1ca64c51`.

Results:

- `/why` comparison layout: `npm.cmd test -- tests\why-mobile-layout.test.ts` passed, 1 file / 4 tests.
- Blank workspace submission: `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "focuses the input and announces an error when blank generation is submitted"` passed, 1 test / 25 skipped.
- Contrast/primary command spot check: `npm.cmd test -- tests\product-module-shell.test.ts tests\module-shell-design-regression.test.ts tests\reports-design-remediation.test.ts -t "contrast|AA|primary|Day|Night|workspace accents|heroCta"` passed, 2 files / 2 tests, 1 file / 17 tests skipped.
- Live root still responds HTTP 200 after the latest push.

Fresh current-tree gates:

- `npm.cmd run audit:frontend-consistency`
  - Result: 33 pages, 23 product components, 0 coverage issues, 0 violations.
- `node .\scripts\frontend_consistency_browser_audit.mjs` against the fresh production build on port 3011
  - Result: 111/111 screenshots, 0 failed rows, 0 recovered rows, 0 findings.
- `npm.cmd test -- tests\frontend-design-contract.test.ts tests\frontend-route-coverage.test.ts tests\product-module-shell.test.ts`
  - Result: 3 files / 64 tests passed.
- `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.
- `npm.cmd run typecheck`
  - Result: passed.

Artifacts:

- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.md`

Latest current-HEAD refresh after the AiConnect runtime-boundary copy change:

- Source SHA: `3ce357a716dddc4349c58a793b06bd11217bd2b8`
- Static frontend contract: 33 pages, 23 product components, 0 coverage issues, 0 violations.
- Browser matrix: 111/111 rows passed, 0 failed rows, 0 recovered rows, 0 findings.
- Focused evidence reconciliation: `npm.cmd test -- tests\frontend-design-contract.test.ts tests\frontend-route-coverage.test.ts tests\product-module-shell.test.ts`
  - Result: 3 files / 64 tests passed.

### Share recipient identity boundary gate

The worker recipient portal keeps the invited-worker identity boundary separate from open group viewing.

Fixes verified:

- Anonymous share lookups without a worker identity no longer return recipient hints or worker display names.
- Sessions that require a known worker snapshot reject anonymous/manual confirmation attempts before inserting a read-confirmation row.
- The recipient UI only presents the open group-copy path when the session is both anonymous and does not require a known worker snapshot.
- The manager share panel copy remains locked so it does not expose the raw recipient URL as a default CTA.

Fresh current-tree gates:

- `npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-panel-behavior.test.ts`
  - Result: 2 files passed, 1 file skipped; 41 tests passed, 1 skipped.
- `npm.cmd run typecheck`
  - Result: passed.

### 2026-07-18 knowledge and recipient portal recheck

The `/knowledge` mobile governance blocker and the recipient portal handoff were rechecked on current HEAD `7ad69632e9848a81f5bd81ecc7c43e2af1fc4a76`.

Knowledge UI results:

- User-facing governance stages no longer expose raw machine labels such as `human_review`, `published_ontology`, `Published ontology`, `Hermes / LLM`, or `SafeClaw system of record` in the visible governance flow.
- Machine identifiers remain available only as `data-knowledge-stage` / `data-knowledge-authority` attributes for audit and test contracts.
- Repeated KOSHA evidence disclosure summaries and links keep 44px minimum touch targets and no same-row target overlap on mobile.
- Focused gate: `npm.cmd test -- tests\knowledge-governance-ui-contract.test.ts tests\knowledge-page-layout.test.ts tests\user-visible-korean-copy.test.ts`
  - Result: 3 files / 21 tests passed.

Recipient portal results:

- The read-only handoff claiming no `/share/[sessionId]` recipient portal is stale for current HEAD.
- Current route census includes `app/share/[sessionId]/page.tsx` and public recipient API route `app/api/share-sessions/[sessionId]/route.ts`.
- Production build confirms `/share/[sessionId]` is included as a dynamic app route.
- The first recipient browser run failed because `.next` production artifacts were absent (`required-server-files.json` and app route files missing), not because of a product route failure.
- After `npm.cmd run build`, focused gate passed: `npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts tests\workflow-share-panel-behavior.test.ts`
  - Result: 3 files / 42 tests passed.
- Production build gate: `npm.cmd run build`
  - Result: passed, 28/28 static pages generated.

### 2026-07-18 current-head KOSHA exact gate

The KOSHA exact registry and applicability boundary were rechecked after the latest release-gate evidence commit on current HEAD `5d8fb3632b710be5c3f8856e7912a0e83587b5d9`.

Results:

- `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts`
  - Result: 6 files / 114 tests passed.

Verified boundary:

- Current exact KOSHA direct-evidence registry remains limited to the reviewed exact assets: `D-C-13-2026`, `D-C-7-2026`, and `B-E-10-2026`.
- Trusted KOSHA references remain gated by immutable pins, applicability policy, registry membership, fail-closed behavior, and current-review run/ask coverage.
- This was a verification-only gate; no database migration or production data mutation was performed.

### 2026-07-18 document export and foreign recipient delivery gate

The document-output and foreign-recipient delivery contracts were rechecked on current HEAD `67f7107039f5a5e0fd4156533f93589b768a8980`.

Results:

- `npm.cmd test -- tests\document-export-localization.test.ts tests\pdf-korean-font-integration.test.ts tests\pdf-font-failure.test.ts tests\xlsx-export-route.test.ts tests\workflow-share-client.test.ts tests\workflow-share-panel-behavior.test.ts`
  - Result: 6 files / 79 tests passed.
- `npm.cmd test -- tests\web-safe-presentation-localization.test.ts tests\editor-export-integrity.test.ts`
  - Result: 2 files / 10 tests passed.

Verified boundary:

- PDF/HWPX/XLSX-facing localization and Korean font/error handling remain covered by focused tests.
- Export surfaces keep Korean user-facing labels for document status, accident types, 4M labels, and Before/After improvement wording.
- Foreign recipient dispatch messages remain language-specific and are checked for Korean leakage in the delivery contract.
- This was a verification-only gate; no database migration or production data mutation was performed.

### 2026-07-18 SIF embedding, LLM Wiki, and Hermes boundary gate

The long-term North Star boundary for SIF vector retrieval, LLM Wiki governance, and Hermes/OpenClaw runtime integration was rechecked on current HEAD `111a2602ab05bc4438d785c56e6d10b87ff73aa9`.

SIF embedding approval boundary:

- `npm.cmd test -- tests\sif-embedding-preflight.test.ts tests\sif-embedding-runtime-probe.test.ts tests\sif-embedding-post-migration-verify.test.ts tests\sif-embedding-approval-packet.test.ts tests\sif-embedding-gate-status.test.ts tests\llm-wiki-rls-approval-packet.test.ts tests\knowledge-governance.test.ts tests\knowledge-promotion-gate.test.ts`
  - Result: 8 files / 34 tests passed.
- `npm.cmd run knowledge:sif-embedding-preflight -- --require-execution-env --output evaluation/sif-embedding-gate/approval-preflight-report.json`
  - Result: ok, approval held, corpus 6,032 rows, source SIF rows 6,033, corpus hash `2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e`, execution ready after approval.
- `npm.cmd run knowledge:sif-embedding-runtime-probe -- --output evaluation/sif-embedding-gate/runtime-db-probe.json`
  - Result: configured, `safety_reference_items` count 6,033, vector table/RPC absent, status `migration-required`, vector feature flag off.
- `npm.cmd run knowledge:sif-embedding-post-migration-verify -- --output evaluation/sif-embedding-gate/post-migration-verify.json`
  - Result: expected non-zero exit with status `migration-required`; no DB mutation performed; upload verification remains blocked until the approved SIF-only migration creates the table and RPC.

Hermes/OpenClaw runtime boundary:

- `npm.cmd test -- tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-service-auth.test.ts`
  - Result: 7 files / 176 tests passed.

Verified boundary:

- SIF embeddings remain prepared but not generated, uploaded, or enabled at runtime without explicit migration/cost/upload approval.
- LLM Wiki/knowledge promotion remains human-reviewed and approval-gated; generation candidates are not automatically published.
- Hermes/OpenClaw remains an adapter/runtime boundary behind service auth, replay, attestation, and evidence contracts; it does not replace the SafeClaw DB/MCP system of record.
- This gate performed read/probe/test work only; no database migration, embedding upload, or production data mutation was performed.

### 2026-07-18 tenant/RLS and operation-memory boundary gate

The tenant-boundary, MCP token, share authority, and LLM Wiki RLS approval boundary were rechecked on current HEAD `de920955094c09eaa41b101c3d78fb0a94dcdcfc`.

Application boundary results:

- `npm.cmd test -- tests\supabase-tenant-isolation-harness.test.ts tests\workpack-commercial-tenant-hardening.test.ts tests\workpack-commercial.test.ts tests\workpack-share-authority.test.ts tests\workpack-share-authority-routes.test.ts tests\dispatch-logs-tenant-boundary.test.ts tests\education-records-tenant-boundary.test.ts tests\mcp-auth.test.ts tests\mcp-token-service.test.ts tests\tenant-harness-memory.test.ts tests\tenant-harness-memory-claw-tool.test.ts tests\llm-wiki-rls-approval-packet.test.ts`
  - Result: 12 files / 176 tests passed.

RLS approval status:

- The current approval packet remains `approval_required`: `evaluation/supabase-rls-approval-2026-07-17/report.md` and `report.json`.
- The packet is read-only evidence, not authorization to migrate or mutate a Supabase project.
- Launch-ready DB-level tenant isolation is not yet proven because authoritative live `pg_catalog` policy snapshots, authenticated tenant A/B negative tests, and Storage object isolation tests are still approval-gated.
- The app-layer route and MCP boundary tests above are passing, but they do not replace DB RLS/catalog proof because service-role routes bypass RLS and must be evaluated separately.

Verified boundary:

- Tenant operation memory remains scoped through approved/reflected rows and structured digests.
- Public LLM Wiki/knowledge promotion remains approval-gated and separate from tenant operation memory.
- MCP token/service boundaries remain tested at the application layer.
- This gate performed tests and documentation only; no database migration, RLS policy change, Storage operation, or production data mutation was performed.

### 2026-07-18 frontend current-head browser gate

The current frontend surface was rechecked on current HEAD `0b2a847121e2e47312a0ba81c5996d106d7baa3b` after stabilizing the workspace input summary chip row against asynchronous weather-brief text changes.

Results:

- `npm.cmd run audit:frontend-consistency`
  - Result: pass; 33 page files, 23 product components, 0 coverage issues, 0 violations, 0 important declarations.
- `npm.cmd run typecheck`
  - Result: pass.
- `npm.cmd run build`
  - Result: pass; 28/28 static pages generated; `/share/[sessionId]` remains present in the production route map.
- `node .\scripts\frontend_consistency_browser_audit.mjs` against the fresh production build on port 3011 with `FRONTEND_AUDIT_OUTPUT_DIR=evaluation/frontend-audit-current-head-2026-07-18`
  - Result: 111/111 screenshots, 0 failed rows, 0 recovered rows, 0 findings.

Fix verified:

- Prior run on the same current-head line found `/workspace` tablet Day/Night geometry mismatch because the weather summary chip changed from a loading label to a longer live-weather label between captures.
- `app/globals.css` now reserves a stable workspace input summary-chip row height and aligns wrapped chips from the top, preventing the evidence rail and following controls from shifting when the weather summary resolves.

Artifacts:

- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-current-head-2026-07-18/browser-report.json`
- `evaluation/frontend-audit-current-head-2026-07-18/browser-report.md`
- `evaluation/frontend-audit-current-head-2026-07-18/browser-screenshots/`

Notes:

- An initial browser-audit attempt without a freshly controlled port 3011 server produced blank screenshots and was discarded before commit.
- The final browser evidence was generated only after a fresh production build and a controlled `next start -p 3011` server.

### 2026-07-18 KOSHA/SIF/ontology broad gate recheck

The KOSHA exact trust, KOSHA Guide corpus audit, SIF embedding approval boundary, and ontology test surface were rechecked on current HEAD `67ed505a22d60ba4e3c6a7989d2e1719f506c85e`.

Results:

- `npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts`
  - Result: 1 file / 110 tests passed.
- `npm.cmd test -- tests\sif-embedding-gate-status.test.ts`
  - Result: 1 file / 5 tests passed.
- 34-file KOSHA/SIF/ontology broad suite:
  - Command: `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\kosha-current-review-lifecycle.test.ts tests\kosha-current-review-photo-storage.test.ts tests\kosha-current-review-provenance.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-guide-corpus-audit.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-provenance-gate.test.ts tests\kosha-guide-supporting-row-relevance.test.ts tests\kosha-verified-subset-gate.test.ts tests\ontology-evidence-chains.test.ts tests\ontology-graph-store.test.ts tests\ontology-knowledge-tool.test.ts tests\ontology-operation-memory.test.ts tests\ontology-qa-review.test.ts tests\ontology-query.test.ts tests\ontology-schema.test.ts tests\ontology-seed.test.ts tests\ontology-tablet-overflow.test.ts tests\ontology-typography-production-matrix.test.ts tests\ontology-typography-role-contract.test.ts tests\ontology-ui-browser.test.ts tests\ontology-ui-remediation.test.ts tests\ontology-visualization.test.ts tests\sif-causality-audit-gate.test.ts tests\sif-embedding-approval-packet.test.ts tests\sif-embedding-gate-status.test.ts tests\sif-embedding-post-migration-verify.test.ts tests\sif-embedding-preflight.test.ts tests\sif-embedding-runtime-probe.test.ts tests\workpack-ontology-qa.test.ts`
  - Result: 31 files passed / 3 skipped; 395 tests passed / 4 skipped.

Fix verified:

- `tests\sif-embedding-gate-status.test.ts` now normalizes `generatedAt` and `checkedAt` before hashing the machine fixture. This keeps the approval-boundary fixture sensitive to product contract changes while avoiding false RED from timestamp-only evidence refreshes.

Integration note:

- The stale `feat/kosha-trust-registry-wave2` branch still contains branch-local broad RED evidence and is far behind current master; a whole-branch merge would delete current share portal, Hermes, knowledge, and release evidence files.
- Current master direct verification above is therefore the authoritative state for the KOSHA/SIF/ontology broad gate.

### 2026-07-18 recipient portal and foreign dispatch gate recheck

The recipient portal and owner-side share authority were rechecked on current HEAD `dfe75bfd7a9fa0056e73fe52acac28f4d65542ad`.

Results:

- `npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts tests\workflow-share-panel-behavior.test.ts`
  - Result: 3 files / 42 tests passed.

Verified boundary:

- `/share/[sessionId]` remains present in the product route map and is covered by the recipient portal browser contract.
- Share session and read-confirmation route authority remain covered by route tests.
- Owner-side share panel behavior remains covered by focused UI tests.
- Older read-only delegation that reported no recipient portal is stale relative to current master.

### 2026-07-18 document editor UX gate recheck

The document review/editor surface was rechecked on current HEAD `556c2221734a38d083cb574f2006f575cb77ffa9` after comparing current master against the older `feat/workpack-document-editors-v2-target-ready-v5` worktree.

Results:

- `npm.cmd test -- tests\documents-editor-layout.test.ts tests\workpack-editor-structured-sections.test.ts tests\workpack-risk-rows-editor.test.ts tests\editor-export-integrity.test.ts tests\north-star-document-ux.test.ts`
  - Result: 5 files / 47 tests passed.

Verified boundary:

- Current master already contains the structured document editor surface (`document-structured-editor`), section-level editable textareas (`document-section-textarea`), source text mode (`document-source-textarea`), and collapsed provenance drawer (`editor-provenance-drawer`).
- Current master also contains later document-editor follow-up commits such as provenance copy sanitization, structured fallback edit isolation, and canonical risk-row editor hardening.
- The older target-ready worktree must not be whole-merged: it is behind current master and its tree diff would remove current share portal, Hermes, KOSHA, knowledge, and release-gate test surfaces.

Integration note:

- No product code change was required for this gate. The current master state is the authoritative document editor UX baseline unless a fresh browser audit finds a new regression on this HEAD or later.

### 2026-07-18 exact KOSHA registry current-master recheck

The exact KOSHA trust registry was rechecked on current HEAD `10f87615579b03a129fad55d901a376dacf43274` after comparing the older `feat/kosha-trust-registry-wave2` worktree with current master.

Results:

- `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts`
  - Result: 5 files / 97 tests passed.

Verified boundary:

- Current master contains the exact KOSHA registry lineage through D-C-13, D-C-7, and B-E-10 hardening.
- Per-item immutable body/PDF/URL/file/publication/provenance pins, dual provenance alias validation, query applicability policy, fail-closed registry gating, and route-scoped Next file tracing are covered by the focused registry tests above.
- The older `feat/kosha-trust-registry-wave2` branch is not authoritative as a branch object. Current master has later exact-registry commits and must remain the integration source of truth.

Integration note:

- No database schema, Supabase data, or production corpus mutation was performed by this recheck.

### 2026-07-18 foreign dispatch and export localization gate recheck

The foreign-worker dispatch, recipient language contract, and document export localization surface were rechecked on current HEAD `c5c85333c9a3fc0d0204b34489f26ad32b107ba7`.

Results:

- `npm.cmd test -- tests\foreign-parse.test.ts tests\foreign-worker-languages.test.ts tests\workspace-share-mobile-browser.test.ts tests\workpack-share-authority-routes.test.ts tests\workflow-share-panel-behavior.test.ts tests\workspace-share-simplification.test.ts tests\document-export-localization.test.ts tests\pdf-korean-font-integration.test.ts tests\xlsx-export-route.test.ts tests\web-safe-presentation-localization.test.ts`
  - Result: 10 files / 107 tests passed.

Verified boundary:

- Foreign-worker language parsing and canonical language metadata remain covered.
- The workspace share mobile browser contract covers full Vietnamese preview paragraphs before the primary CTA without clipping or horizontal overflow.
- Share authority route tests cover recipient-language payload construction, forged foreign body rejection, unknown language rejection, Korean leakage rejection for foreign variants, and provider dispatch headers.
- PDF/XLSX/web-safe export localization remains covered so raw enum labels such as `Man`, `Machine`, `planned`, `fall`, `No.`, and English Before/After wording do not leak into the customer-facing export boundary.

Integration note:

- This gate validates current master behavior only. It does not claim that machine translation quality is complete for every future language; it proves the current saved-language dispatch and export-localization contracts.

### 2026-07-18 current-head typecheck and production build

The basic release build gate was rechecked on current HEAD `5c8d6f60b361e7ce92287e3d51ca02f67caac22e`.

Results:

- `npm.cmd run typecheck`
  - Result: pass.
- `npm.cmd run build`
  - Result: pass; 28/28 static pages generated.

Verified boundary:

- `/share/[sessionId]`, `/workspace`, `/documents`, `/reports`, `/knowledge`, `/ontology`, `/api/input-photos/hazard-analysis`, export routes, share-session routes, and KOSHA/SIF status routes remain present in the production route map.
- This build was run sequentially after typecheck. No concurrent build process was started for this gate.

### 2026-07-18 ontology, knowledge, and why UI gate recheck

The prior launch-blocker UI routes were rechecked on current HEAD `0d29cb6482d81c2bf2a9230f75a40f85c656782b`.

Results:

- `npm.cmd test -- tests\ontology-ui-browser.test.ts tests\ontology-ui-remediation.test.ts tests\ontology-tablet-overflow.test.ts tests\ontology-visualization.test.ts tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-governance-ui-contract.test.ts tests\why-mobile-layout.test.ts`
  - Result: 6 files passed / 2 skipped; 31 tests passed / 3 skipped.
  - The skipped files require `ONTOLOGY_BASE_URL`.
- `ONTOLOGY_BASE_URL=http://localhost:3012 npm.cmd test -- tests\ontology-ui-browser.test.ts tests\ontology-tablet-overflow.test.ts`
  - Result: 2 files / 3 tests passed against a fresh production build served on port 3012.

Browser metrics:

- `evaluation/ontology-ui-remediation-2026-07-15/browser-metrics.json`
  - desktop/tablet/mobile Day/Night: horizontal overflow 0, outside elements 0, overlap pairs 0.
  - desktop/tablet visible neighborhood nodes: 15.
  - mobile default relation list visible, fullscreen graph verified with 15 nodes and keyboard dialog contract.
  - minimum control height: 44px.
  - minimum node/text contrast: at least 5.6:1 in the captured variants.

Verified boundary:

- `/ontology` no longer exposes the previous 166-node hairball as the default customer surface in the tested production build. The bounded neighborhood explorer passes collision, contrast, overflow, and mobile fullscreen gates.
- `/knowledge` mobile IA, localized governance labels, full-size evidence disclosures, and touch targets are covered by focused browser/contract tests.
- `/why` mobile comparison layout keeps stacked cards readable without horizontal overflow while preserving the desktop comparison table.

Integration note:

- The production server used for the `ONTOLOGY_BASE_URL` gate was stopped after the test run. No product code, database schema, or production data was changed by this recheck.

### 2026-07-18 Hermes, OpenClaw, and MCP engine boundary recheck

The long-term Hermes/OpenClaw engine boundary was rechecked on current HEAD `e00d9614ef238994b9e6ec8443d7f9c67c8fe5c4`.

Results:

- `npm.cmd test -- tests\engine-adapter.test.ts tests\engine-runtime-readiness-policy.test.ts tests\hermes-engine-adapter.test.ts tests\openclaw-hermes-route.test.ts tests\remote-engine-protocol.test.ts tests\remote-hermes-contract.test.ts tests\remote-hermes-https-transport.test.ts tests\remote-hermes-route.test.ts tests\remote-hermes-runtime.test.ts tests\remote-hermes-service-auth.test.ts tests\mcp-auth.test.ts tests\mcp-route-scope-contract.test.ts tests\mcp-tools.test.ts`
  - Result: 13 files / 329 tests passed.

Verified boundary:

- `docs/phase-b-organization-knowledge-and-engine-plan.md` keeps Hermes/OpenClaw as planner-runtime choices behind a versioned `EngineAdapter`; they are not model-provider branches in `ai-provider-policy.ts`.
- SafeClaw remains the system of record and effect authority. Runtime engines can propose tool intent, but MCP scope, tenant identity, evidence harnessing, approval, and effect execution stay in the SafeClaw-controlled path.
- Remote Hermes tests cover protocol shape, service-auth assertion/replay checks, HTTPS transport, runtime policy attestation, route fail-closed behavior, and terminal ledger boundaries.
- MCP tests cover authentication and route/tool scope contracts that the engine boundary depends on.

Integration note:

- This is a boundary/contract recheck, not a production Hermes traffic cutover. The Phase B document still requires a separate explicit approval gate before GPT OAuth proof-of-concept work, service-auth traffic, DB migration, billing schema, or tenant data mutation.

### 2026-07-18 tenant/RLS application-boundary gate recheck

The tenant-boundary, MCP token, share authority, and LLM Wiki RLS approval boundary were rechecked on current HEAD `c22c8d76854993003bef96fc563563ccdba438a9`.

Results:

- `npm.cmd test -- tests\supabase-tenant-isolation-harness.test.ts tests\workpack-commercial-tenant-hardening.test.ts tests\workpack-commercial.test.ts tests\workpack-share-authority.test.ts tests\workpack-share-authority-routes.test.ts tests\dispatch-logs-tenant-boundary.test.ts tests\education-records-tenant-boundary.test.ts tests\mcp-auth.test.ts tests\mcp-token-service.test.ts tests\tenant-harness-memory.test.ts tests\tenant-harness-memory-claw-tool.test.ts tests\llm-wiki-rls-approval-packet.test.ts`
  - Result: 12 files / 176 tests passed.

Verified boundary:

- Tenant operation memory remains scoped through approved/reflected rows and structured digests.
- Workpack share authority, recipient session construction, dispatch log boundaries, education record boundaries, MCP token service behavior, and LLM Wiki approval-packet boundaries are covered by focused app-layer tests.
- Public LLM Wiki/knowledge promotion remains approval-gated and separate from tenant operation memory.

RLS approval status:

- The authoritative approval packet remains `approval_required`: `evaluation/supabase-rls-approval-2026-07-17/report.md` and `report.json`.
- The read-only audit confirms the repository/migration contract and non-mutating REST reachability evidence, but it does not prove live `pg_catalog` policy expressions, `FORCE RLS`, grants, authenticated tenant A/B negative tests, or Storage object path isolation.
- Service-role routes bypass RLS, so route predicates and relational ownership checks remain separately tested at the application layer.

Integration note:

- This gate performed tests and documentation only; no database schema, RLS policy, migration, Storage operation, production data, or Supabase project state was changed.

### 2026-07-18 current-head full serial test and frontend evidence refresh

The current HEAD `b59cead62c4e54edf9eaafb7beae2cb36fa4188b` received a fresh frontend evidence refresh and full serial test rerun.

Frontend audit refresh:

- `npm.cmd run audit:frontend-consistency`
  - Result: pass; 33 page files, 23 product components, 0 coverage issues, 0 violations, 0 important declarations.
- `npm.cmd run build`
  - Result: pass; 28/28 static pages generated.
- `node .\scripts\frontend_consistency_browser_audit.mjs` against a controlled production server on port 3011
  - Result: 111 screenshots, 111 successes, 0 failed rows, 0 recovered rows, 0 findings.
- `npm.cmd test -- tests\frontend-route-coverage.test.ts`
  - Result: 1 file / 39 tests passed.

Full serial test:

- Command: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=hanging-process`
- Log: `evaluation/2026-07-18-authoritative-full-test-current-rerun.log` (local ignored log artifact)
- Result: 188 files passed / 9 skipped; 2308 tests passed / 15 skipped; exit code 0.

Skip note:

- The skipped tests are production-matrix/browser tests gated by environment variables or a production build id. Their corresponding production/browser surfaces are covered by the focused gates above and the earlier ontology/document/frontend browser gates in this release file.

Integration note:

- The first full serial attempt on the same HEAD found one stale frontend route evidence identity. After regenerating the static/browser audit evidence, `tests\frontend-route-coverage.test.ts` passed and the full serial rerun exited 0.
