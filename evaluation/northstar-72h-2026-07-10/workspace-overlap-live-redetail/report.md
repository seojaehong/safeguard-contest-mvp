# Workspace Overlap Redetail Check

Date: 2026-07-10
Scope: `/workspace` first-screen Day/Night layout, especially wide short presentation captures.

## User-Reported Symptom

The reported screenshot showed the Day theme topbar and left rail visually crowding the main input area. The first typed line looked partially clipped, which can make the page feel broken even before document generation starts.

## Findings

- Current live probe at `2048x638`, Day, filled input did not reproduce topbar/input overlap.
- The user screenshot still resembled the old topbar flow where the workspace header could behave like an overlay.
- Root hardening applied: the base `.command-topbar` rule no longer uses `position: sticky`; it now starts as normal document flow (`position: relative; top: auto`) before later theme guards.
- Regression coverage expanded to the default `/workspace` route, not only `/workspace?theme=day`.

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts`
  - Result: 1 file passed, 13 tests passed.
- `npm.cmd run typecheck`
  - Result: passed.
- `npm.cmd run build`
  - Result: passed.
- Production deploy:
  - Deployment: `https://safeguard-contest-nag9155k2-seojaehongs-projects.vercel.app`
  - Alias: `https://www.safeclaw.kr`
- Postdeploy `www.safeclaw.kr` checks:
  - Default Day `2048x638`: topbar in flow, side rail separated, input text not clipped.
  - Day `1170x365`: compact presentation viewport passed.
  - Night `2048x638`: topbar in flow, side rail separated, input text not clipped.

## Evidence Files

- `live-redetail-metrics.json`
- `live-redetail-compact-metrics.json`
- `day-2048x638-filled.png`
- `day-2048x638-cdp-scale150.png`
- `day-900x300-filled.png`
- `postdeploy-www-metrics.json`
- `postdeploy-www-default-2048x638-filled.png`
- `postdeploy-www-day-1170x365-filled.png`
- `postdeploy-www-night-2048x638-filled.png`

## Remaining Risk

If a browser is still showing the old full-width/sticky layout, the most likely explanation is a cached asset or a not-yet-refreshed tab. The source now removes sticky behavior at the base rule and verifies the default route, so the next deployment should force the corrected geometry into fresh sessions.
