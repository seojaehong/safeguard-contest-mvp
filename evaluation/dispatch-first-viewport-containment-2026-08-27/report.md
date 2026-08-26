# Standalone Dispatch First-Viewport Containment

Verdict: `PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_FIRST_VIEWPORT_CONTAINMENT`

Product and production are aligned at `79718c2bf35e6d5ac6163eb375346ddb0e39d74c`.

## Result

The previous 1440x723 production surface had a nominal two-pane grid, but the left controls still behaved like a tall mobile card stack inside a hidden scroll area. Root content was 614px inside a 382px client area, headings inherited 40px hero typography, channel cards occupied three vertical rows, and the last channel action ended at 892px.

The live remediation keeps `/dispatch` route-scoped and now proves:

- Desktop Day/Night root scroll debt is at most 1px (`399/398`).
- Primary action, preview, and the final channel action end at 448px, 639px, and 706px in a 723px viewport.
- Channel cards use three readable 193px columns on one row.
- Title/status/card typography is 20px/12px/12px rather than inherited 40px hero text.
- Mobile Day/Night keeps the summary and primary action inside the first viewport and leaves configuration collapsed.
- Long message content remains available through preview-local scroll.

## Verification

- Share browser contracts: 2 files, 16 tests passed.
- Strict TypeScript typecheck: PASS.
- Next.js production build: PASS, 28 static pages generated.
- Fresh live geometry: 4/4 Day/Night desktop/mobile rows passed.
- Northstar open-gate, rollup, and runway contracts: 3 files, 160 tests passed.
- Production deployment: `safeguard-contest-p99nvd26m-seojaehongs-projects.vercel.app`.

## Boundary

No database mutation, Share session creation, provider dispatch, embedding/vector mutation, wiki publication, or KOSHA registry mutation was performed.

This evidence covers the standalone `/dispatch` route only. It does not substitute workspace Share or fixture evidence for an exact saved user `/share/[sessionId]`; that surface remains `MISSING_EVIDENCE`. Route separation alone is not accepted as the UX fix.
