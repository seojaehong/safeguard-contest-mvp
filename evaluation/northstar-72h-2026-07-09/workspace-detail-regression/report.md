# Workspace Detail Regression Check

Date: 2026-07-09

## Verdict

The submitted/public URL initially served the old sticky topbar layout, but the current branch has now been deployed to production and re-checked.

The current production URL fixes the overlap: the workspace topbar scrolls as normal content, the left rail is bounded on short screens, and filled textarea content is visible with enough top padding.

## Reproduction Surface

- URL: `https://www.safeclaw.kr/workspace?theme=day`
- Viewport: `2048x638`
- Input:
  - `세이프건설 서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보, 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘.`

## Live Finding

Before redeploy, live used the old layout rules:

- `.command-topbar`: `position sticky`
- `.command-topbar`: `z-index 30`
- `.command-topbar`: `height 117px`
- After scroll, the topbar remains visible over the workspace body.

Evidence:

- `live-day-2048x638-filled-top.png`
- `live-day-2048x638-filled-scroll260.png`
- `live-day-2048x638-filled-top-metrics.json`
- `live-day-2048x638-filled-scroll260-metrics.json`

## Post-Deploy Finding

After production deploy, `https://www.safeclaw.kr/workspace?theme=day&verify=4e754fe` uses the corrected layout:

- `.command-topbar`: `position relative`
- `.command-topbar`: `z-index 2`
- `.command-topbar`: `height 60px`
- After scroll, `.command-topbar` moves above the viewport instead of covering the workspace body.
- Filled textarea remains readable with `padding-top 22px`, `line-height 30.94px`, and `scrollTop 0`.

Evidence:

- `postdeploy-day-2048x638-filled-top.png`
- `postdeploy-day-2048x638-filled-scroll260.png`
- `postdeploy-day-2048x638-filled-top-metrics.json`
- `postdeploy-day-2048x638-filled-scroll260-metrics.json`

## Local Branch Finding

Local branch uses the corrected layout:

- `.command-topbar`: `position relative`
- `.command-topbar`: `height 60px`
- `.command-viewport`: starts below the topbar.
- `.workspace-side-nav`: bounded to visible short-screen height with `overflow-y auto`.
- Filled textarea has `padding-top 22px`, `line-height 30.94px`, and `scrollTop 0`.

Evidence:

- `local-day-2048x638-filled-top.png`
- `local-day-2048x638-filled-scroll260.png`
- `local-day-2048x638-filled-top-metrics.json`
- `local-day-2048x638-filled-scroll260-metrics.json`

## Regression Gate Added

Updated `tests/workspace-layout-regression.test.ts` with a filled-input wide-short viewport case. It now verifies:

- Day topbar is relative and compact.
- Viewport starts below the topbar.
- Sidebar is bounded and scrollable.
- Main content does not overlap the sidebar.
- Filled textarea has enough padding and line-height.
- Helper text starts below the textarea.

Verification:

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts
```

Result: 6 tests passed.

## Deployment

Production deployment completed:

- Alias: `https://www.safeclaw.kr`
- Deployment URL: `https://safeguard-contest-1iuqqjent-seojaehongs-projects.vercel.app`
- Commit verified on live check: `4e754fe`
