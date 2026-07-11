# Frontend design contract Wave 2 verification

This evidence supersedes the non-portable `21bb393` report. The product delta is limited to the workspace textarea cascade and its regression contracts; Reports files and package manifests are not part of the portable patch.

## Source and dependency identity

- Source commit: `0fdaed4048252b812a82a47982db9ad80874718e`
- Lock SHA-256: `116da99b26a160322d632df067fe9177a14bb6152a3ab05dc543e7919c059ccd`
- Next.js: `15.5.20`
- Production BUILD_ID: `3PrUUfsEcsHga0TxNOVqt`
- Source identity: `b6c70c9b091aa6425f5aec2289640a25aad7fb033185b53ec6c8e0b1345ed4f3`
- Build identity: `7e128e8d400530a9de7177d85536f10517d41b225681698eb3ee2abaa3bf962f`

## Verified contracts

- Submission-guard CSS touched range: bare LF `0`; media selector indentation normalized.
- Static declaration contract: `2/2` PASS.
- Computed-style matrix: Day/Night across `1440x900`, `1440x500`, `1440x410`, `1440x360`, `1440x320`, and `390x844`; all 12 combinations PASS.
- Exact properties: display, min-height, padding, overflow-y, font-size, line-height, resize.
- Strict typecheck: PASS.
- Normal production build: 27/27 static pages, 97 chunks, audit marker 0.
- Production `/workspace?theme=day` probe: HTTP 200, response length 26,686 bytes, matching BUILD_ID evidence.

## Honest residual state

Static audit remains RED: 2,352 violations, 710 `!important` declarations, coverage issues 0. The 108-row browser audit remains fail-closed and was not run.

This verification is pending fresh independent review and is not authorization to merge the unapproved Reports ancestry.
