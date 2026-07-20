# Workspace Documents / Share Current Verdict

Checked at: 2026-07-20 KST

## Verdict

**FIXED for the original Documents/Share geometry blocker, with a remaining product-depth follow-up.**

The current production surface no longer reproduces the old launch blocker for the default document review stage, the share desktop breakpoint, or the edit-mode first-action placement. The editor still has a long full document surface below the fold, but the first editable body now appears in the first viewport instead of being pushed below a risk-row editor.

## Authoritative Surface

- Git HEAD used for source comparison: `b1ec3635dbc0f60b4964ee5befbe2e03d311813f`
- Served URL: `https://www.safeclaw.kr/workspace`
- Build info endpoint: `https://www.safeclaw.kr/api/build-info`
- Served commit: `b1ec3635dbc0f60b4964ee5befbe2e03d311813f`
- Served branch: `master`
- Deployment URL: `safeguard-contest-5yybjwagl-seojaehongs-projects.vercel.app`

## Results

| Viewport | Stage | Page height | Stage y | Stage height | Key result |
| --- | --- | ---: | ---: | ---: | --- |
| 1440x900 | Documents review | 1149 | 229 | 800 | Fixed versus prior 2070px/723px sticky report |
| 1440x900 | Document edit | 1489 | 63 editor y / 350 textarea y | 2561 editor height | Improved; editable body is now first-viewport visible |
| 1440x900 | Share | 1174 | 189 | 921 | Fixed; 1180px desktop surface, not mobile-card width |
| 390x844 | Documents review | 1417 | 262 | 1050 | Acceptable as a compact step, no horizontal overflow |
| 390x844 | Document edit | 1152 | 84 editor y / 407 textarea y | 2696 editor height | Fixed versus the late first-body blocker; textarea starts in the first viewport |
| 390x844 | Share | 1487 | 244 | 1138 | Not the old 3836px share body; one primary CTA, no horizontal overflow |

## Interpretation

The staged `입력 -> 문서 -> 공유` routing is now real in the default flow: only one of input, documents, or share is visible at a time. The old share desktop problem is also fixed on current production because the share surface is 1180px wide at 1440px desktop.

The bounded edit remediation moved the 위험성평가 구조화 행 editor below the document body. On mobile, the first textarea now begins at y=407 in an 844px viewport; on desktop it begins at y=350. This closes the "편집 후 첫 행동이 아래로 밀리는" geometry issue while preserving the structured risk-row editor, provenance drawers, and export tools below the main body.

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

Bounded fix target: keep review/share as they are, and only compress edit mode.

- Desktop edit: editor body should fit the first viewport better, with the editable body visible without deep scrolling.
- Mobile edit: textarea or first structured field should start above y=420, and editor page height should be materially reduced.
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

After commit `b1ec3635dbc0f60b4964ee5befbe2e03d311813f` was deployed to production, the same geometry probe was rerun against `https://www.safeclaw.kr`.

- Served commit: `b1ec3635dbc0f60b4964ee5befbe2e03d311813f`
- Desktop documents review: page height 1149, horizontal overflow false
- Desktop share: 1180px share surface, one primary CTA, horizontal overflow false
- Mobile documents review: page height 1417, horizontal overflow false
- Mobile document edit: page height 1152, horizontal overflow false, no sticky/fixed overlap detected, first textarea y=407
- Mobile share: page height 1487, one primary CTA, horizontal overflow false

Raw evidence was refreshed in `current-geometry.json` and the `*-current-*.png` screenshots.
