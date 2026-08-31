# Current Security Governed-Path Compatibility

- Verdict: `PASS_CURRENT_SOURCE_LIVE_INCLUDED_SECURITY_GOVERNED_PATH_COMPATIBILITY_RESCAN_COMPLETE_FINDINGS_OPEN`
- Product source: `0261e05219af16310549b43e17f40a5b49968876`
- Observed production marker: `0261e05219af16310549b43e17f40a5b49968876`
- Covered notice gates: 13
- Governed paths: 33

## Verification

- Current route and contract regression: 28 files / 317 tests PASS
- Opt-in recipient browser suite: 1 file / 7 tests skipped; no fresh browser PASS is claimed
- Strict TypeScript typecheck: PASS
- Existing live browser evidence is preserved rather than rewritten

## Boundary

This receipt proves current source compatibility for the listed security notices only. Sealed Standard scan
`f218c713-1a1c-4f4e-9777-8095926be1df` completed with 18 open findings and partial coverage. It does not
replace immutable scan findings, claim security completion, activate distributed admission, mutate database
policy, create a Share session or read confirmation, or call a provider. Exact saved `/share/[sessionId]`
remains `MISSING_EVIDENCE`.
