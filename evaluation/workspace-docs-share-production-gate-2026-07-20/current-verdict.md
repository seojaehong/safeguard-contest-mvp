# Workspace Documents / Share Current Verdict

Checked at: 2026-07-20 KST

## Verdict

**PARTIALLY FIXED.**

The current production surface no longer reproduces the old launch blocker for the default document review stage or the share desktop breakpoint. The staged `입력 -> 문서 -> 공유` flow is also real in the default flow: only one stage is visible at a time.

However, the edit surface still contains a very tall internal document editor panel below the first action. So the mismatch is real: prior static/design-contract passes and the default document/share geometry gate did not fully prove the workflow-level edit experience the user expected.

## Authoritative Surface

- Git HEAD used for source comparison: `778f4601b359adc7ea716ee84eebdaa58f026115`
- Served URL: `https://www.safeclaw.kr/workspace`
- Build info endpoint: `https://www.safeclaw.kr/api/build-info`
- Served commit: `778f4601b359adc7ea716ee84eebdaa58f026115`
- Served branch: `master`
- Deployment URL: `safeguard-contest-iig0xw90t-seojaehongs-projects.vercel.app`

The current probe waits for generated document readiness (`12/12 생성` or `안전 문서팩 3종 준비 완료`) before measuring, so it does not accidentally capture the interim generating shell.

## Results

| Viewport | Stage | Page height | Stage y | Stage height | Key result |
| --- | --- | ---: | ---: | ---: | --- |
| 1440x900 | Documents review | 1147 | 229 | 798 | Fixed versus prior 2070px/723px sticky report |
| 1440x900 | Document edit | 1489 | 63 editor y / 350 textarea y | 2561 editor height | Partially fixed; first textarea is visible, but the editor surface remains overlong |
| 1440x900 | Share | 1174 | 189 | 921 | Fixed; 1180px desktop surface, not mobile-card width |
| 390x844 | Documents review | 1417 | 262 | 1050 | Acceptable as a compact step, no horizontal overflow |
| 390x844 | Document edit | 1152 | 84 editor y / 407 textarea y | 2696 editor height | Partially fixed; textarea starts in the first viewport, but hidden editor depth remains high |
| 390x844 | Share | 1487 | 244 | 1138 | Not the old 3836px share body; one primary CTA, no horizontal overflow |

## Interpretation

The original default-stage complaints are fixed on current production:

- Documents default review is `1147 / 900 = 1.27x` on desktop, not the old `2070 / 723 = 2.86x` report.
- Mobile default review is `1417 / 844 = 1.68x`, with no horizontal overflow or sticky overlap.
- Desktop share is a `1180px` surface at `1440px`, so it is no longer a narrow mobile-card layout.
- Share has one primary CTA and no horizontal overflow on desktop or mobile.

The remaining mismatch is the edit-mode product depth:

- Desktop edit body is `1489 / 900 = 1.65x`, and the editor panel itself reports `2561px` height.
- Mobile edit body is `1152 / 844 = 1.36x`, but the editor panel reports `2696px` height.
- This means the first editable textarea is near the first viewport (`y=350` desktop, `y=407` mobile), but the full edit model still carries a long below-fold surface.

That is why the prior "done" signal and the user's current perception diverged: the implemented work closed default review/share geometry and first editor entry, but did not fully redesign edit mode into a short, field-first document editor.

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

All five commits are ancestors of current HEAD `778f4601`. A separate older geometry commit `ddda375d` is not an ancestor of this branch, but the current DOM/CSS still contains the effective later fixes listed above.

## Mismatch Finding

**Reason for mismatch:** prior completion language was too broad. It should have said "default document review and share desktop layout fixed; edit mode still has product-depth work."

Possible user-surface mismatch sources:

- If the user saw a narrow share card on desktop, they were likely on stale/non-authoritative local dev, cached deploy, or an older branch. Current production build `778f4601` renders `1180px` share width.
- If the user clicked `편집` and judged the full edit experience, that is not stale. The current production edit surface is still long internally and remains a bounded UX follow-up.
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

Bounded fix target: keep default review/share as they are, and compress edit mode without changing the generation/harness contract.

- Desktop edit: keep textarea y <= 350 and reduce internal editor panel height materially from 2561px.
- Mobile edit: keep textarea y <= 420 and reduce internal editor panel height materially from 2696px.
- Replace the long single textarea/default appendix feel with field-first document editing and collapsed provenance/export tools.
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

After commit `778f4601b359adc7ea716ee84eebdaa58f026115` was deployed to production, the same geometry probe was rerun against `https://www.safeclaw.kr`.

- Served commit: `778f4601b359adc7ea716ee84eebdaa58f026115`
- Desktop documents review: page height 1147, horizontal overflow false
- Desktop share: 1180px share surface, one primary CTA, horizontal overflow false
- Mobile documents review: page height 1417, horizontal overflow false
- Mobile document edit: page height 1152, horizontal overflow false, no sticky/fixed overlap detected, first textarea y=407
- Mobile share: page height 1487, one primary CTA, horizontal overflow false

Raw evidence was refreshed in `current-geometry.json` and the `*-current-*.png` screenshots.

## Current Verification

- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` — PASS, served commit `778f4601b359adc7ea716ee84eebdaa58f026115`, generated-state wait included.
- `node -e "JSON.parse(...current-geometry.json); JSON.parse(...mismatch-investigation-2026-07-20.json)"` — PASS.
- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` — 2 files / 28 tests PASS, 1 skipped. Duration 201.93s.
- `git diff --check` — PASS, line-ending warnings only.
