# Workspace Documents / Share Current Verdict

Checked at: 2026-07-20 KST

## Verdict

**PARTIALLY FIXED, WITH THE BOUNDED EDIT-MODE REMEDIATION SHIPPED.**

The current production surface no longer reproduces the old launch blocker for the default document review stage or the share desktop breakpoint. The staged `입력 -> 문서 -> 공유` flow is also real in the default flow: only one stage is visible at a time.

The initial mismatch was real: prior static/design-contract passes and the default document/share geometry gate did not fully prove the workflow-level edit experience the user expected. A bounded edit-mode remediation has now shipped to production and materially reduced the internal editor depth while preserving document/provenance/export contracts.

## Authoritative Surface

- Git HEAD used for source comparison: `96d16238ae71896aa608d93ee9db25d455bd6894`
- Served URL: `https://www.safeclaw.kr/workspace`
- Build info endpoint: `https://www.safeclaw.kr/api/build-info`
- Served commit: `96d16238ae71896aa608d93ee9db25d455bd6894`
- Served branch: `master`
- Deployment URL: `safeguard-contest-8bkp35kfa-seojaehongs-projects.vercel.app`

The current probe waits for generated document readiness (`12/12 생성` or `안전 문서팩 3종 준비 완료`) before measuring, so it does not accidentally capture the interim generating shell.

## Results

| Viewport | Stage | Page height | Stage y | Stage height | Key result |
| --- | --- | ---: | ---: | ---: | --- |
| 1440x900 | Documents review | 1147 | 229 | 798 | Fixed versus prior 2070px/723px sticky report |
| 1440x900 | Document edit | 2210 | 63 editor y / 374 textarea y | 1433 editor height | Improved; no horizontal overflow, sticky count 0 |
| 1440x900 | Share | 1174 | 189 | 921 | Fixed; 1180px desktop surface, not mobile-card width |
| 390x844 | Documents review | 1417 | 262 | 1050 | Acceptable as a compact step, no horizontal overflow |
| 390x844 | Document edit | 1981 | 63 editor y / 361 textarea y | 1359 editor height | Improved; textarea starts higher and editor depth is roughly halved |
| 390x844 | Share | 1487 | 244 | 1138 | Not the old 3836px share body; one primary CTA, no horizontal overflow |

## Interpretation

The original default-stage complaints are fixed on current production:

- Documents default review is `1147 / 900 = 1.27x` on desktop, not the old `2070 / 723 = 2.86x` report.
- Mobile default review is `1417 / 844 = 1.68x`, with no horizontal overflow or sticky overlap.
- Desktop share is a `1180px` surface at `1440px`, so it is no longer a narrow mobile-card layout.
- Share has one primary CTA and no horizontal overflow on desktop or mobile.

The edit-mode remediation result:

- Desktop editor panel is reduced from `2561px` to `1433px`.
- Mobile editor panel is reduced from `2696px` to `1359px`.
- Mobile first textarea moves from `y=407` to `y=361`.
- Horizontal overflow remains false and outside elements remain 0 on desktop/mobile.

This does not make the edit screen a tiny one-card surface. It makes it a single, cleaner page flow with collapsed sections and no nested shell scroll in the north-star gate. Further product refinement can still turn each document into richer field-specific editors, but the immediate launch blocker is bounded and reduced.

## Implementation Trace

The requested UX work was implemented across bounded fixes that are integrated into current HEAD:

- `54af1d7d` `fix: tighten workspace document and share stages`
  - touched `components/SafeGuardCommandCenter.tsx`, `app/globals.css`, `tests/frontend-workbench-visual-contract.test.ts`, `tests/north-star-document-ux.test.ts`, `tests/workspace-share-mobile-browser.test.ts`
  - changed staged workspace documents/share surfaces and captured desktop/mobile evidence.
- `652ba44c` `fix: widen workspace share desktop surface`
  - touched `app/globals.css`
  - widened the share surface on desktop.
- `98ddcddd` `fix: widen workspace share desktop layout`
  - touched `app/globals.css`
  - further adjusted the share desktop composition.
- `4a6e35fb` `fix: compact documents mobile editor entry`
  - touched `app/globals.css`
  - moved the mobile edit entry up and reduced the first-action delay.
- `a2535d21` `chore: tighten workspace doc share gate`
  - tightened the production gate so document measurements wait for generated-state readiness.

All five commits are ancestors of current HEAD `96d16238`. A separate older geometry commit `ddda375d` is not an ancestor of this branch, but the current DOM/CSS still contains the effective later fixes listed above.

## Mismatch Finding

**Reason for mismatch:** prior completion language was too broad. It should have said "default document review and share desktop layout fixed; edit mode still has product-depth work."

Possible user-surface mismatch sources:

- If the user saw a narrow share card on desktop, they were likely on stale/non-authoritative local dev, cached deploy, or an older branch. Current production build `96d16238` renders `1180px` share width.
- If the user clicked `편집` and judged the full edit experience, that is not stale. The current production edit surface is no longer sticky, but it is still long internally and remains a bounded UX follow-up.
- Static 0 / 108 contract passes should not be treated as proof for this workflow-level gate unless they also measure generated document readiness, document height ratio, editor entry y-position, sticky overlap, and desktop share width.

## Evidence

- Raw current geometry: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- Current probe script: `evaluation/workspace-docs-share-production-gate-2026-07-20/run-current-geometry-probe.mjs`
- Screenshots:
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-editor.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-share.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-editor.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-share.png`

## Next Remediation Gate

Remaining follow-up target: document-specific field editors, not the old overlong default textarea/rail surface.

- Keep the shipped default review/share geometry.
- Preserve the shipped collapsed section model for risk assessment.
- Add document-specific field editors for TBM, permit, education, and foreign-worker documents in a separate product workstream.
- Keep one visible stage at a time.
- Preserve existing workpack/document persistence and provenance data.

## Local Remediation Result

After the bounded edit-mode patch, the same probe was rerun against local production server `http://localhost:3019` after `npm.cmd run build`.

| Viewport | Stage | Page height before | Page height after | Key change |
| --- | --- | ---: | ---: | --- |
| 390x844 | Document edit | 1856 | 1152 | Mobile edit no longer shows the operations/checklist rail over the document body |
| 390x844 | Documents review | 1417 | 1417 | Unchanged |
| 390x844 | Share | 1487 | 1487 | Unchanged |
| 1440x900 | Share | 1174 | 1174 | Unchanged desktop share composition |

The local screenshot `mobile-day-current-editor.png` now shows only the document editor and the compact `현장 판단과 확인 항목` drawer in the default mobile edit surface. The previous mid-screen operational rail/checklist is removed on mobile edit mode.

Verification:

- `npm.cmd test -- tests\workspace-layout-regression.test.ts -t "keeps the generated document edit flow inside the workspace design system" --maxWorkers=1 --fileParallelism=false` — 1/1 PASS
- `npm.cmd test -- tests\ask-public-surface.test.ts tests\answer-panel-display.test.ts tests\kosha-current-review-run-ask.test.ts --maxWorkers=1 --fileParallelism=false` — 3 files / 44 tests PASS
- `npm.cmd run typecheck` — PASS after build completed
- `npm.cmd run build` — 28/28 static pages PASS

## Post-Deploy Verification

After commit `45faccac787858e4085db65651f3921c5b5b4bbf` was deployed to production, the same geometry probe was rerun against `https://www.safeclaw.kr`.

- Served commit: `45faccac787858e4085db65651f3921c5b5b4bbf`
- Desktop documents review: page height 1147, horizontal overflow false
- Desktop share: 1180px share surface, one primary CTA, horizontal overflow false
- Mobile documents review: page height 1417, horizontal overflow false
- Desktop document edit: page height 2210, editor panel 1433, horizontal overflow false, first textarea y=374
- Mobile document edit: page height 1981, editor panel 1359, horizontal overflow false, first textarea y=361
- Mobile share: page height 1487, one primary CTA, horizontal overflow false

Raw evidence was refreshed in `current-geometry.json` and the `*-current-*.png` screenshots.

## Current Verification

- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` — PASS, served commit `96d16238ae71896aa608d93ee9db25d455bd6894`, generated-state wait included.
- `node -e "JSON.parse(...current-geometry.json); JSON.parse(...mismatch-investigation-2026-07-20.json)"` — PASS.
- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` — 2 files / 28 tests PASS, 1 skipped. Duration 201.93s.
- `git diff --check` — PASS, line-ending warnings only.
