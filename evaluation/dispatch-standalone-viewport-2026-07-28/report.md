# Standalone Dispatch Viewport Cockpit

Verdict: `PASS_LIVE_PRODUCTION_STANDALONE_DISPATCH_VIEWPORT_COCKPIT`

Production and source are aligned at `db2e88ed6b5ab652a5717e05ae3ba984da00db3e`.

## What Changed

The standalone `/dispatch` route now uses the same task-cockpit principle as the bounded workspace flow:

- Desktop keeps a real two-pane workbench and contains the preview inside the 1440x723 first viewport.
- Mobile places the selected summary and primary action before the long preview.
- Recipient, channel, and language configuration remains collapsed by default on mobile.
- Long message content stays available through local panel scroll.
- Route separation alone is not accepted as the fix.

## Before And After

| Surface | Before | Live after |
| --- | --- | --- |
| Mobile 390x723 | Page 1109px; primary action bottom 1155px; title/status reason 32px | Page 743px; primary action bottom 581px; title 20px; status reason 12px |
| Desktop 1440x723 | Root 616px; preview bottom 794px | Root 384px with local scroll; preview bottom 717px |
| Horizontal overflow | 0 | 0 |

Day and Night mobile measurements both place the primary action at 581px in a 723px viewport.

## Verification

- Browser and static Share contracts: 2 files, 16 tests passed.
- TypeScript strict typecheck: PASS.
- Next.js production build: PASS, 28 static pages generated.
- Production marker: `db2e88ed6b5ab652a5717e05ae3ba984da00db3e`.

## Boundary

No database mutation, Share session creation, provider dispatch, embedding, or vector mutation was performed.

This proof covers the standalone `/dispatch` viewport contract. It does not prove an exact saved user `/share/[sessionId]`. That surface remains `MISSING_EVIDENCE` until a concrete existing production URL is provided or a DB-backed creation flow is explicitly approved.
