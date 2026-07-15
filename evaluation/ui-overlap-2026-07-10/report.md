# Workspace Overlap Detail Check

Date: 2026-07-10 KST

## Scope

- Route: `/workspace?theme=day`
- Issue: first-screen workspace text and menu appeared visually clipped/overlapped on a wide, short presentation screenshot.
- Target: keep the workspace topbar, left rail, heading, textarea, and composer physically separated across desktop, zoom-like, ultra-short, and mobile viewports.

## Finding

Local and production checks at `2048x632` did not reproduce a literal DOM overlap on the latest deployed CSS. The user screenshot looked like a cached or zoom-specific variant where the workspace shell width had expanded to the full viewport and the textarea first line appeared clipped.

Because this class of issue can return through CSS cascade order, browser zoom, or short presentation screens, the fix adds a final workspace geometry guard rather than only adjusting one visible element.

## Change

- Locked Day/Night workspace topbar and viewport width to a centered `1360px` shell on desktop.
- Re-asserted the two-column workspace grid after earlier theme overrides.
- Prevented the side rail from spilling horizontally into the main canvas.
- Re-asserted textarea box sizing, top padding, line height, and compact-height variants so filled input text cannot visually clip.
- Added regression assertions that the `2048x638` presentation viewport keeps the topbar and viewport aligned to the same centered shell.

## Browser Evidence

Captured with Playwright against local dev server:

- `evaluation/ui-overlap-2026-07-10/after-wide-short-2048x632.png`
- `evaluation/ui-overlap-2026-07-10/after-zoom-like-1365x421.png`
- `evaluation/ui-overlap-2026-07-10/after-zoom-like-1024x430.png`
- `evaluation/ui-overlap-2026-07-10/after-ultra-short-1024x319.png`
- `evaluation/ui-overlap-2026-07-10/after-mobile-390x844.png`
- Metrics: `evaluation/ui-overlap-2026-07-10/layout-metrics-after.json`

Measured result:

- Horizontal overflow: none on checked viewports.
- Topbar/text/textarea overlap: none on checked viewports.
- Sidebar/main overlap: none on checked viewports.
- Textarea/composer overlap: none on checked viewports.

## Verification

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts
```

Result:

- 1 test file passed.
- 12 layout regression tests passed.

## Post-Deploy Verification

- Deployment URL: `https://safeguard-contest-ao6weeoui-seojaehongs-projects.vercel.app`
- Alias: `https://www.safeclaw.kr`
- Loaded bundle marker: `dpl_E5hZtuTXvqJqWfpRPLzUct5Vwg3h`
- Screenshots:
  - `evaluation/ui-overlap-2026-07-10/postdeploy-wide-short-2048x632.png`
  - `evaluation/ui-overlap-2026-07-10/postdeploy-zoom-like-1024x430.png`
- Metrics: `evaluation/ui-overlap-2026-07-10/postdeploy-layout-metrics.json`

Post-deploy measured result:

- Horizontal overflow: none on checked viewports.
- Topbar/text/textarea overlap: none on checked viewports.
- Sidebar/main overlap: none on checked viewports.
- Textarea/composer overlap: none on checked viewports.

## Remaining Note

If a browser still shows the old full-width screenshot, the first thing to check is whether it is serving an older deployment/CSS cache. The committed guard still protects the current bundle from re-entering that state on the tested viewport classes.
