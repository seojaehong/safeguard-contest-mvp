# Workspace Documents / Share Current Verdict

Checked at: 2026-07-20 KST

## Verdict

**PARTIALLY FIXED.**

The current production surface no longer reproduces the old launch blocker for the default document review stage or the share desktop breakpoint. However, after the user clicks `편집`, the document editor still becomes a long single-page editing surface, especially on mobile. If the user is seeing the broken/long behavior in edit mode, that is not stale cache. It is still present on the current authoritative production commit.

## Authoritative Surface

- Git HEAD used for source comparison: `43559c89c4fe180a0867de7b47b2bab756e75990`
- Served URL: `https://www.safeclaw.kr/workspace`
- Build info endpoint: `https://www.safeclaw.kr/api/build-info`
- Served commit: `43559c89c4fe180a0867de7b47b2bab756e75990`
- Served branch: `master`
- Deployment URL: `safeguard-contest-igkzhou2l-seojaehongs-projects.vercel.app`

## Results

| Viewport | Stage | Page height | Stage y | Stage height | Key result |
| --- | --- | ---: | ---: | ---: | --- |
| 1440x900 | Documents review | 1147 | 229 | 798 | Fixed versus prior 2070px/723px sticky report |
| 1440x900 | Document edit | 1489 | 63 editor y | 2593 editor height | Still too long; sticky editor navigator remains |
| 1440x900 | Share | 1174 | 189 | 921 | Fixed; 1180px desktop surface, not mobile-card width |
| 390x844 | Documents review | 1417 | 262 | 1050 | Acceptable as a compact step, no horizontal overflow |
| 390x844 | Document edit | 1856 | 63 editor y / 688 textarea y | 2775 editor height | Still failing; first editable body starts low and creates a long page |
| 390x844 | Share | 1487 | 241 | 1138 | Not the old 3836px share body; one primary CTA, no horizontal overflow |

## Interpretation

The staged `입력 -> 문서 -> 공유` routing is now real in the default flow: only one of input, documents, or share is visible at a time. The old share desktop problem is also fixed on current production because the share surface is 1180px wide at 1440px desktop.

The remaining blocker is narrower and more concrete: the document edit mode is not yet brought into the same compact stage contract. The editor includes a long editing surface and supporting chrome after the user clicks `편집`. On mobile, the textarea begins at y=688 in an 844px viewport, while the editor surface itself measures 2775px high. That matches the user's complaint that the design can feel like it fell back into the older long-page behavior.

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

After commit `975fb3eff075e9b81d1310b3f683878cb0e40a18` was deployed to production, the same geometry probe was rerun against `https://www.safeclaw.kr`.

- Served commit: `975fb3eff075e9b81d1310b3f683878cb0e40a18`
- Desktop documents review: page height 1147, horizontal overflow false
- Desktop share: 1180px share surface, one primary CTA, horizontal overflow false
- Mobile documents review: page height 1417, horizontal overflow false
- Mobile document edit: page height 1152, horizontal overflow false, no sticky/fixed overlap detected
- Mobile share: page height 1487, one primary CTA, horizontal overflow false

Raw evidence was refreshed in `current-geometry.json` and the `*-current-*.png` screenshots.
