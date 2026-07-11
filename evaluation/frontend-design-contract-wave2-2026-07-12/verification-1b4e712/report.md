# Frontend design contract Wave 2 production verification

This evidence supersedes all prior Wave 2 reports and is bound to source `1b4e7128a6d0dd470f6bfdc594628d4e13c8b5c2`.

The exact Day/Night textarea matrix now runs only when `WORKSPACE_INPUT_PROD_MATRIX=1` and asserts that the isolated browser harness is in `prod` mode. A fresh Next production build is created before the matrix. Both consecutive production runs passed all 12 theme/viewport combinations, for 24 checked combinations and 0 failures.

Readiness requires the expected theme shell, a visible textarea, loaded fonts, two animation frames, and a bounded reviewed computed-style condition. The final assertions cover the harness mode, actual shell theme, display, minimum height, all four padding sides, overflow, font size, line height, and resize.

## Bound identities

- Lock SHA-256: `116da99b26a160322d632df067fe9177a14bb6152a3ab05dc543e7919c059ccd`
- Next.js: `15.5.20`
- BUILD_ID: `3bh_CjmANHAQrLavkzG2p`
- Source identity: `b6c70c9b091aa6425f5aec2289640a25aad7fb033185b53ec6c8e0b1345ed4f3`
- Build identity: `07b7dc4b0a85d46a3ce27da773f0006016d62ef0dad81fe3c567347de5c88785`
- Production Night workspace probe: HTTP 200, 26,672 bytes

Static contract 2/2, strict typecheck, and production build 27/27 passed. The CSS touched range has zero bare-LF lines and normalized indentation.

Static audit remains honestly RED at 2,352 violations and 710 `!important` declarations, coverage issues 0. The 108-row audit was not run. Only the listed portable product commits may be considered for selective integration; Reports ancestry remains excluded.
