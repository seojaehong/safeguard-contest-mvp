# Deployment Freshness Guard

- Verdict: `PASS_LIVE_PRODUCTION_DEPLOYMENT_FRESHNESS_GUARD`
- Implementation commit: `3924782b58aa27b2c00f8281c0758d848c94b77d`
- Final source and production commit: `e4d66d547c25350ad90d2ef33233982648e3d4a2`
- Deployment: `safeguard-contest-40ik94esj-seojaehongs-projects.vercel.app`

## Result

The root layout now carries the immutable Vercel build SHA into a client-side freshness guard. The guard checks `/api/build-info` immediately, every 60 seconds, and whenever a hidden tab becomes visible. A current tab renders nothing. A tab whose embedded SHA differs from production receives a compact refresh notice.

This closes the approval-free stale-client visibility gap. It does not reinterpret route splitting as the Documents/Share UX fix. Current scoped route geometry remains independently measured in `evaluation/live-documents-share-route-perception-2026-08-14/report.json`.

## Verification

- Focused Vitest: 2 files, 4 tests passed.
- Strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages generated.
- Live current-tab browser check at 1440x723: notice absent, body/document height 723, horizontal overflow false.
- Live-page SHA-drift simulation: stale notice and refresh action visible. At 390x723 the notice bottom was 711.33px, refresh target height was 44px, body height remained 723px, and horizontal overflow remained false.
- Final design-contract rendering: desktop notice bottom 707.33px, computed radius 14px from the panel token, and no decorative shadow.
- Screenshots: `stale-notice-desktop-1440x723.png`, `stale-notice-mobile-390x723.png`.
- Canonical frontend static audit: PASS, 33 pages, 24 components, coverage issues 0, violations 0, `!important` declarations 0.
- Adjacent route evidence contract after canonical audit refresh: 41/41 PASS.

## Boundaries

- Live after-deployment verification is complete for the deployment freshness guard.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- No DB mutation, Share-session creation, provider dispatch, vector/embedding mutation, wiki publication, or KOSHA registry mutation occurred.
- The guard does not claim that every saved Share session has the scoped Workspace Share geometry.
