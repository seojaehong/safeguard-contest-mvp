# Workspace Documents / Share Production Gate

Checked at: 2026-07-20 KST

## Verdict

**FIXED on authoritative production HEAD.**

The previously reported workspace blockers are not reproduced on the current production surface:

- Documents is no longer an overlong sticky single-page composition.
- Share desktop is no longer rendered as a narrow mobile-card-like panel.

If the old behavior is still visible, the likely cause is stale local server, stale branch, browser cache, or a non-authoritative deployment URL.

## Production Build

- URL: `https://www.safeclaw.kr/workspace`
- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `1bce421e3b2d1f07e402a9b0453961199c17f58a`
- Branch: `master`
- Environment: `production`
- Deployment URL: `safeguard-contest-xikm3xs18-seojaehongs-projects.vercel.app`

## Flow Tested

Input used:

> 서울 성수동 외벽 도장 작업, 작업자 5명, 신규 작업자 1명, 오후 강풍 예보. 이동식 비계와 자재 양중 동선 확인 필요.

Browser path:

1. Open `/workspace?theme=day`.
2. Clear local storage and set template mode.
3. Fill the work description.
4. Click `안전 문서 생성`.
5. Wait for `.workspace-document-page`.
6. Open the workspace menu and click `공유`.
7. Wait for `.workspace-share-page`.

## Geometry Metrics

| Variant | Stage | Viewport | Page height | Stage y | Stage height | Stage width | Horizontal overflow | Outside elements | Primary share CTA |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop Day | Documents | 1440x900 | 1149 | 229 | 800 | - | false | 0 | 0 |
| Desktop Day | Share | 1440x900 | 1174 | - | 921 | 1180 | false | 0 | 1 |
| Mobile Day | Documents | 390x844 | 1417 | 262 | 1050 | - | false | 0 | 0 |
| Mobile Day | Share | 390x844 | 1487 | - | 1138 | 336 | false | 0 | 1 |

## Interpretation

The reference-session failure measured approximately 2070px document height on a 723px viewport, about 2.9x one viewport, with stacked sticky regions. Current production desktop documents measured 1149px on a 900px viewport, about 1.28x, and mobile documents measured 1417px on an 844px viewport, about 1.68x. This is no longer the same launch-blocking geometry.

Share desktop now opens a 1180px-wide production surface. That is a desktop-width composition rather than a narrow mobile card.

## Evidence

- Raw metrics: `evaluation/workspace-docs-share-production-gate-2026-07-20/metrics.json`
- Measurement script: `evaluation/workspace-docs-share-production-gate-2026-07-20/run-workspace-docs-share-production-gate.mjs`
- Screenshots:
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-share.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-documents.png`
  - `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-share.png`

## Remaining Risk

This gate only checks the exact stale-vs-current blocker: workspace documents length/sticky burden and share desktop width. It does not close all broader launch issues, including remaining copy terminology, contrast, long secondary pages, or future recipient portal/product-depth work.
