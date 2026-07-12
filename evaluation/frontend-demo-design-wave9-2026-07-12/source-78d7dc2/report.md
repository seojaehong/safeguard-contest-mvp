# Wave 9 clipping and contrast remediation

Source commit: `78d7dc25a9693551822c30b48a95e1b9b7e50a87`  
Patch identity: `9f3dca8ad9146681a38939607be839d8227fe46b`

The static artifact was regenerated from a detached checkout of the exact
source commit. Its embedded `sourceSha` is
`78d7dc25a9693551822c30b48a95e1b9b7e50a87` and its source identity is
`ec723bb1d5b40d84b7e01b4a2407f535fdcb2d591e794cb3c3aa478992f47164`.

This evidence supersedes the clipping and contrast assertions in
`source-9bcb9c0`.

## Internal clipping

- Interactive controls still use `scrollIntoViewIfNeeded` and must fit all
  four viewport edges with nonzero geometry.
- Critical surfaces use all four rect edges to prove horizontal containment
  and at least 44px vertical viewport intersection after scrolling.
- A surface with computed `overflow-y: hidden|clip` additionally requires
  `scrollHeight <= clientHeight + 0.5` and zero direct rendered children beyond
  its inner border bounds.
- The negative fixture proves that the old 44px-intersection check accepts an
  internally clipped surface while the new internal-clipping check rejects it.
- Natural document scrolling remains allowed; only clipping inside a critical
  surface is classified as failure.

## Effective contrast

- The browser walks the element-to-root ancestor chain bottom-up and alpha
  composites every computed background over the browser canvas.
- The computed foreground is then alpha composited over that effective
  background before luminance and contrast are calculated.
- Foreground and background are never independently composited over white.
- The negative fixture uses translucent black foreground/background over a
  black ancestor: independent-white calculation incorrectly passes 4.5:1,
  while the ancestor-aware calculation correctly fails.
- Active scenario, active/done/pending stages, live API indicator, and
  live/offline mode meet their 4.5:1 text or 3:1 non-text requirement in all
  six production lanes.

## Final verification

- Focused: 7 PASS, production lane skipped.
- Strict typecheck: PASS.
- Build: 27/27 PASS.
- Production: 2/2 PASS across six lanes.
- Static: honest RED 2,080; `!important` 696; coverage 0; CSS lines 18,423.
- No backend integration was performed.
