# Frontend Mixed Typography Wave 5

- Base: `7def9dddb222204b81376eadca7a4e28cf2ce909`
- Source: `a9c250f2335842c5ff62d81f865adae8cb1d960c`
- Scope: split the five mixed caption/HUD and control/support selector groups and apply canonical tuples.
- Excluded: component behavior, Reports data behavior, package/lock, parser/allowlists/coverage, backend shared contracts.

## Verification

- TDD RED: five exact `mixed-typography-role` findings.
- Contract: PASS, 1 file / 1 test; mixed-role 0.
- Strict typecheck: PASS.
- Normal production build: PASS, 27/27.
- Production browser: PASS, 1 file / 1 test; Workspace Day/Night Product/HUD/control/support computed roles, Documents live form th/td roles, desktop and 390px overflow 0.
- Static audit: honest RED 2,354; mixed-role 5 -> 0; line-height 235 -> 232; tuple 612 and important 737 unchanged; coverage 0.
- Existing broader contract remains RED at unrelated `.command-primary` 14px/560/0; it is preserved for a later wave.
- 108-row audit: not run because static prerequisite remains RED.
