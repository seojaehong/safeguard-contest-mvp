# Dispatch caption typography

## Verdict

`PASS_LIVE_PRODUCTION_DISPATCH_CAPTION_TYPOGRAPHY`

Current source and production `44a07ac0b269b484c233e29e945d1d0c5e25454a` align the standalone Dispatch channel heading with the canonical caption typography tuple. The focused change is `font-weight: 700` to `600`; font size, line height, letter spacing, and layout remain unchanged.

## Verification

- Frontend consistency audit: PASS, 33 routes, 24 component files, 0 coverage issues, 0 violations.
- Static design contract: 1 file, 6/6 tests passed.
- Focused browser geometry: 1 test passed across desktop 1440×723 and mobile-short 390×723 day/night cases.
- Generated-workpack desktop: root 1156×400, primary action bottom 448, preview bottom 639, channel action bottom 706, three 193px channel cards, no horizontal overflow.
- Generated-workpack mobile: primary action bottom 581, configuration cards collapsed, bounded root local scroll, no horizontal overflow.
- Live default Dispatch: body height 723, grid width 1156, two distinct columns, no horizontal overflow.
- Live computed tuple: 12px / 600 / 18px / normal (`--tracking-body` resolves to zero).

## Scope boundary

The live default route has no generated workpack and therefore renders its two-pane sample shell. The full generated WorkflowSharePanel contract is proven by the focused local browser fixture; this report does not substitute that fixture for an exact saved user session.

No DB, provider dispatch, Share-session, vector, embedding, wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, and route splitting alone is not accepted as the UX fix.
