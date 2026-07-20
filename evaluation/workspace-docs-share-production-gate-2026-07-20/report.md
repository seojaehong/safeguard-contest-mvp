# Workspace Documents / Share Production Gate

Checked at: 2026-07-20 KST

## Verdict

**CURRENT DEFAULT GEOMETRY: Documents desktop cockpit PASS, Documents mobile PARTIAL, Share desktop PASS.**

The previous stale report claimed a broad fixed state from older production commits. This report is refreshed to match the current geometry probe and keeps the verdicts separate.

## Product Answer

Page splitting alone does not solve long content. The fix is viewport-first information architecture: each stage must expose the decision summary, critical controls, and primary action in the first viewport, while long documents, evidence, history, logs, and all 12 outputs stay behind explicit details or deep-review surfaces.

## Flow Tested

Input used:

> 서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.

Browser path:

1. Open `/workspace?theme=day`.
2. Clear local storage and set template mode.
3. Fill the work description.
4. Click `안전 문서 생성`.
5. Wait for `.workspace-document-page` and generated-ready text.
6. Measure the default Documents closed state.
7. Click `위험성평가표 편집` and measure editor state.
8. Navigate to Share and measure Share state.

## Documents Current Geometry

| Variant | Viewport | Body | Workbench | Safety brief | Risk edit CTA | Share CTA | Detail cluster | Provenance | Deep review | Overflow | Outside |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| desktop-short-day | 1440x723 | 876 / 1.21x | bottom 722 | bottom 649 | bottom 391 | bottom 441 | bottom 711 | bottom 702 | bottom 710 | false | 0 |
| desktop-day | 1440x900 | 1053 / 1.17x | bottom 810 | bottom 723 | bottom 419 | bottom 469 | bottom 797 | bottom 788 | bottom 796 | false | 0 |
| mobile-day | 390x844 | 1205 / 1.43x | bottom 1100 | bottom 981 | bottom 542 | bottom 543 | bottom 1089 | bottom 1034 | bottom 1088 | false | 0 |

Documents desktop short-height cockpit is PASS because the safety brief, risk assessment edit CTA, share CTA, provenance summary, and deep-review summary all fit inside the `723px` fold. Full document previews remain hidden while deep review is closed (`visibleDocumentPreviews = 0`).

Documents mobile remains PARTIAL because the primary CTAs are visible early, but the full safety brief and detail entrypoints still extend beyond the first viewport.

## Share Current Geometry

| Variant | Viewport | Body | Preview | Primary CTA | Form | Overflow | Outside |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| desktop-short-day | 1440x723 | 920 / 1.27x | y 305, bottom 705, width 520 | bottom 349 | bottom 675 | false | 0 |
| desktop-day | 1440x900 | 920 / 1.02x | y 305, bottom 705, width 520 | bottom 349 | bottom 675 | false | 0 |
| mobile-day | 390x844 | 1455 / 1.72x | y 380, bottom 599, width 310 | bottom 1243 | bottom 1243 | false | 0 |

Share desktop remains PASS: it is a true desktop two-pane cockpit, not a narrow mobile-card-like preview. Mobile Share remains a longer single-column flow and is not claimed as a full mobile cockpit pass.

## Verification

- `npm.cmd run build`: PASS, 28/28 app pages.
- `npm.cmd test -- tests\north-star-document-ux.test.ts tests\workspace-layout-regression.test.ts tests\frontend-workbench-visual-contract.test.ts`: PASS, 3 files, 43 tests passed, 1 skipped.

Note: `evaluation/north-star-document-ux-24h-2026-07-14/browser-metrics.json` is explicit deep-review/editor-mode evidence. It is not the default closed-state cockpit proof.

## Evidence

- Raw current geometry: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- Probe script: `evaluation/workspace-docs-share-production-gate-2026-07-20/run-current-geometry-probe.mjs`
- Screenshots:
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-short-day-current-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-short-day-current-share.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-share.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-share.png`

## Remaining Risk

- Documents mobile density is still a follow-up if the goal is a full first-viewport mobile cockpit.
- Document-specific field editors remain separate product depth work.
- This gate does not close unrelated live issues such as ontology graph density, terminology, or legal/KOSHA source readiness.
