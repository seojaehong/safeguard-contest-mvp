# Frontend design contract Wave 2 deterministic verification

This evidence supersedes `21bb393` and the first `0fdaed4` verification. It is bound to source commit `0c37547018c6516b811c8a2ccd88ef2c4ccc071e`.

## Deterministic computed-style matrix

The test waits for the expected Day or Night shell class, a visible textarea, `document.fonts.ready`, and two animation frames. It then checks both themes across six viewport bands. All four padding sides and the rendered theme are asserted in addition to display, min-height, overflow, font size, line height, and resize.

The 12-combination matrix passed twice consecutively: 24 checked combinations, 0 failures. Persistent logs are `browser-matrix-run1.log` and `browser-matrix-run2.log`.

## Bound identities

- Lock SHA-256: `116da99b26a160322d632df067fe9177a14bb6152a3ab05dc543e7919c059ccd`
- Next.js: `15.5.20`
- BUILD_ID: `y5B0IgyNkl-xRcSlIL_U6`
- Source identity: `b6c70c9b091aa6425f5aec2289640a25aad7fb033185b53ec6c8e0b1345ed4f3`
- Build identity: `05d42fe75d2fdafc701e7ecb9398de4960415fcce97797d80034b10f10399a17`
- Production Night workspace probe: HTTP 200, 26,672 bytes

Static declaration contract 2/2, strict typecheck, and production build 27/27 passed. The touched CSS range has zero bare-LF lines and normalized media indentation.

## Honest residual state

Static audit remains RED at 2,352 violations and 710 `!important` declarations, with coverage issues 0. The 108-row gate was not run. The product commits remain selective-port candidates only and do not authorize importing the unapproved Reports ancestry.
