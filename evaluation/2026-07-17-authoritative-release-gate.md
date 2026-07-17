# SafeClaw authoritative release gate

## Scope

- Original integration source HEAD: `2b4316056b44b8729903d364d93022a916383ab6`
- Current product verification HEAD: `06c0d0ba83d472521c7bfb5cdfa806507dcf29c9`
- Later commits in this file are documentation-only evidence refreshes unless stated otherwise.
- KOSHA exact-trust Wave 2: already present on the authoritative branch with equivalent product and evidence patches.
- Remote Hermes: trusted-transport and durable-attempt-ledger boundary integrated; product execution remains disabled until those application-owned dependencies are supplied.

## Verification

### Full test suite

- Command: `npm.cmd test -- --maxWorkers=1 --no-file-parallelism --reporter=verbose --reporter=hanging-process`
- Result before evidence refresh: 184 files, 175 passed, 1 failed, 8 skipped; 2,062 tests passed, 1 failed, 14 skipped.
- The only failure was a stale frontend browser-evidence source identity after the Hermes integration. It was not a product assertion failure.
- Evidence log: `evaluation/2026-07-17-authoritative-full-test.log` (local generated log, intentionally not committed).
- After regenerating the static and browser evidence, the failed contract suite passed: 1 file / 39 tests.

### Focused backend trust gate

- Integrated Hermes and KOSHA focus: 15 files / 274 tests passed.
- Strict typecheck passed.

### Build and frontend audit

- Normal production build: passed, 28/28 static pages generated.
- Fresh current-HEAD production build after the KOSHA/share evidence refresh: passed, 28/28 static pages generated.
- Fresh current-HEAD strict typecheck after build: passed.
- Note: running `npm.cmd run typecheck` before a fresh `next build` failed because `tsconfig.json` includes `.next/types/**/*.ts` and the generated Next type files were missing. The subsequent `npm.cmd run build` regenerated `.next/types`, and the immediate typecheck rerun passed. This is recorded as a build-artifact ordering issue, not a source type error.
- Static frontend contract: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Normal bundle contract: passed; audit marker count 0.
- Audit bundle contract: passed; deterministic marker present only in the audit graph.
- Audit runtime boundary: HTTP 500 expected, one boundary marker, no unfiltered page or console errors.
- Browser matrix: 108/108 rows passed, 108 screenshots, 0 failed rows, 0 recovered rows, 0 findings.

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

Current continuation HEAD after the final foreign-recipient evidence refresh: `45b68f83355dc41969ec0cc36dcfb3f390dfdb7d`.

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

This proves the current master still has the D-C-13/D-C-7 exact trust registry, fail-closed KOSHA grounding, bounded applicability policy, and acquisition parser contract alive after the share/Hermes evidence refresh. The broader historical KOSHA corpus audit RED remains recorded as unresolved and is not reclassified as a pass.

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
