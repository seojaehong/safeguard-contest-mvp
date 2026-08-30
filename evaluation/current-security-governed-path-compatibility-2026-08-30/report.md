# Current Security Governed-Path Compatibility

- Verdict: `PASS_CURRENT_SOURCE_LIVE_INCLUDED_SECURITY_GOVERNED_PATH_COMPATIBILITY_RESCAN_PENDING`
- Product source: `a1a9da9bd663c05d69f8dbb00823e2761f19ad64`
- Observed production marker: `1b4d7feeb4469ab4df148615ae22ab3037e70571`
- Covered notice gates: 7
- Governed paths: 18

## Verification

- Current route and contract regression: 20 files / 233 tests PASS
- Opt-in recipient browser suite: 1 file / 7 tests skipped; no fresh browser PASS is claimed
- Strict TypeScript typecheck: PASS
- Existing live browser evidence is preserved rather than rewritten

## Boundary

This receipt proves current source compatibility for the seven listed security notices only. It does not
replace their immutable scan findings, complete the pending post-fix repository scan, activate distributed
admission, mutate database policy, create a Share session or read confirmation, or call a provider. Exact
saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
