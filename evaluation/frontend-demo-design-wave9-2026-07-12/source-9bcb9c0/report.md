# Wave 9 review remediation

Final source commit: `9bcb9c0b28706bf558d6ea4e10652b0f9ce6f68a`  
Patch identity: `e99dbf6c2bbcf34c297b2f32cbf4f38f21448c29`

This report supersedes the assertion depth in the initial `source-4b532b5`
report. The product design result is unchanged: rendered-owned findings are 0
and repository static audit is an honest RED 2,080.

## Reviewer remediation

- Added negative assertion fixtures proving that mutations to font size,
  weight, line height, or tracking fail exact tuple matching.
- Every owned and rendered-shared role now compares computed font size,
  weight, line height, and tracking to the resolved canonical CSS token.
- Every interactive nav, mode, and scenario control is scrolled into view and
  checked against left, right, top, and bottom viewport edges. Normal document
  scrolling is not treated as clipping.
- Seven critical surfaces are independently scrolled and checked using all
  four rect edges. A surface must have at least 44px vertical viewport
  intersection and full horizontal containment; a negative fixture rejects a
  surface wholly below the viewport.
- Active scenario, active/done/pending stages, live API indicator, and
  live/offline mode capture actual computed foreground, background, border,
  and functional rail/shadow values.
- Normal text contrast is at least 4.5:1 after RGB/alpha composition. The live
  non-text indicator is at least 3:1 against its adjacent surface. State
  tuples, active border, and functional rail must be distinct.
- `V2DemoExperience` now exposes `live` / `offline` classes on the existing
  mode badge. Scoped semantic foreground/background/border declarations make
  the two modes visually distinguishable without changing interaction logic.

## Verification

- Focused tests: 7 PASS, opt-in production lane skipped.
- Strict typecheck: PASS.
- Normal build: PASS, 27/27 static pages.
- Production browser matrix: 2 PASS (negative helper plus six real lanes).
- Static audit: 2,080 findings, 696 `!important`, coverage 0, CSS lines 18,423.
- No Night product theme is claimed; `/demo` remains a light route whose
  surface signature is stable under both light and dark media preferences.

No backend integration was performed.
