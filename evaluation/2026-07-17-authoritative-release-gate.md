# SafeClaw authoritative release gate

## Scope

- Source HEAD: `2b4316056b44b8729903d364d93022a916383ab6`
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

Current continuation HEAD after KOSHA/share copy work: `a2cf31f6cb3ddd32ef60e47010c4a420c1ed2380`.

### KOSHA D-C-13 applicability

- `외벽 로프 작업 안전점검` and `외벽 로프 청소 작업` now map to the exact trusted D-C-13 exterior-wall KOSHA reference.
- `로프 구매 가격 비교` remains non-applicable, so commercial rope queries do not reopen direct evidence.
- Focused policy test: `tests\exact-kosha-applicability-policy.test.ts` passed, 1 file / 17 tests.
- KOSHA + ontology focused gate passed, 7 files / 179 tests.
- Strict typecheck passed.
- Normal production build passed, 28/28 static pages.

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
