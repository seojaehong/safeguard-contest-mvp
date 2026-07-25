# Live Frontend Shell Current

- Verdict: `PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_DISPATCH_EXACT_SHARE_GAP`
- Source/production commit: `d065aad0b5b75456e8a58a1652246202f2f567d4`
- Production deployment: `safeguard-contest-3ifnusc61-seojaehongs-projects.vercel.app`

## Documents

Fresh production `/documents?theme=day` measurements:

- Desktop 1440x723: document/body height 723px, cockpit 205-394px,
  workbench shell 205-653px, internal editor scroll 448/868px, no horizontal
  overflow.
- Mobile 390x723: document/body height 728px, core launcher 214-280px,
  workbench shell 348-680px, internal editor scroll 317/907px, first section
  action bottom 509px, supporting documents closed by default, no horizontal
  overflow.

The current default route does not reproduce a 2.9-screen body-level page.
Long document content remains contained in the selected editor shell.

## Dispatch

Fresh production `/dispatch` measurements:

- Desktop 1440x723: 1,141px root with explicit `587px 520px` columns, 520px
  preview, three 169.66px channel controls, and no horizontal overflow.
- Mobile 390x723: 341px root with one 308px column, 308px preview, desktop
  status rail hidden, and no horizontal overflow.

Desktop and mobile therefore use distinct two-column and stacked contracts.
The standalone dispatch body remains taller than one short viewport, while its
principal action is in the first viewport and the workbench itself is bounded.

## Boundary

A fresh browser opening `/workspace?share` had no generated/saved Share state,
so it is not accepted as exact saved-session evidence. No DB mutation, Share
session creation, or provider dispatch occurred. Exact saved
`/share/[sessionId]` remains `MISSING_EVIDENCE`. Route splitting alone is not
treated as the UX fix; viewport containment and progressive disclosure remain
the product contract.
