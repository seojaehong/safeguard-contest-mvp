# Current Security Governed-Path Compatibility

- Verdict: `PASS_CURRENT_SOURCE_LIVE_INCLUDED_SECURITY_GOVERNED_PATH_COMPATIBILITY_RESCAN_PENDING`
- Product source: `679bb91711c0afecf12aea8a0b650da8a99c03ff`
- Observed production marker: `679bb91711c0afecf12aea8a0b650da8a99c03ff`
- Covered notice gates: 10
- Governed paths: 27

## Verification

- Current route and contract regression: 22 files / 358 tests PASS
- Opt-in recipient browser suite: 1 file / 7 tests skipped; no fresh browser PASS is claimed
- Strict TypeScript typecheck: PASS
- Existing live browser evidence is preserved rather than rewritten

## Boundary

This receipt proves current source compatibility for the seven listed security notices only. It does not
replace their immutable scan findings, complete the pending post-fix repository scan, activate distributed
admission, mutate database policy, create a Share session or read confirmation, or call a provider. Exact
saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
