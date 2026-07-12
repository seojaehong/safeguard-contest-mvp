# Release browser-audit evidence integrity remediation

- Branch: `fix/release-audit-evidence-remediation`
- Base and verification HEAD: `a1dbedb64e177a4909584274eaad87484aa732f4`
- Generated: `2026-07-13T01:46:24.6137592+09:00`
- Result: PASS for the focused remediation scope

## Remediation

- Browser reports now carry top-level `sourceSha` and `sourceIdentity` from the exact source identity validated for the invocation.
- The nested `staticAudit` summary now preserves the prerequisite `sourceSha` and `sourceIdentity`.
- Static prerequisite identity, freshness, PASS status, zero violations, zero coverage issues, 32 page files, and 23 component files remain fail-closed.
- The route-row contract is explicit: 32 routes, 3 viewports, 96 route rows, 6 workspace theme rows, 4 special rows, 2 generated rows, and 108 total rows.
- Screenshot SHA-256 is recorded for every captured browser row.

## Loading row semantics

`special:loading` is now an audit-only deterministic rendering of the checked-in `app/workspace/loading.tsx` component. The audit build activates it with `__auditBoundary=loading`; the normal production alias remains inert.

A loading row can pass only when all of these remain true at capture time:

- `[data-audit-boundary="loading"]` is present.
- `fallbackKind` is `deterministic-audit-probe`.
- The loading heading contains `작업 화면을 준비하고 있습니다`.
- The loading screenshot has a valid SHA-256 digest.
- Resolved desktop workspace comparison evidence exists.
- The loading screenshot digest differs from every resolved desktop workspace digest.

This proves the rendered loading-surface contract. It does not claim that production transition timing naturally held the framework loading state open.

## Verification

- TDD RED: 7 expected failures, including missing provenance/loading APIs, the incorrect 72px loading tuple, missing audit probe, and one pre-existing stale checked-in browser-report reconciliation failure.
- Focused remediation tests: PASS, 1 file and 6 tests.
- Bundle contract unit test: PASS, 1 file and 1 test.
- Typecheck: PASS.
- Static prerequisite: PASS, 32 page files, 23 component files, 0 coverage issues, 0 violations.
- Normal production build: PASS, 27/27 static pages, BUILD_ID `-2Q8BfqPZWYgchTUO4FaZ`, audit marker count 0.
- Audit build: PASS, 27/27 static pages, BUILD_ID `MR8Dw1Qptpwxgm229Y0Gy`, audit marker count 1.
- Focused live loading probe: PASS. Resolved marker count 0, loading marker count 1, expected heading present, and screenshot hashes differ (`3dfaaa52...` resolved versus `f157a08c...` loading).
- Full 108-row browser audit: NOT RUN. The user requested focused verification unless the full matrix became necessary; the deterministic loading probe and report-contract tests covered this remediation without rewriting canonical browser evidence.

## Evidence

- `focused-tests.log`
- `bundle-contract-tests.log`
- `typecheck.log`
- `static-audit.json` and `static-audit.log`
- `provenance-validation.log`
- `build-normal.log`, `bundle-normal.json`, and `bundle-normal.log`
- `build-audit.log`, `bundle-audit.json`, and `bundle-audit.log`
- `audit-server.log` and `loading-probe.log`

Bundle source SHA rebinding after the remediation commit is intentionally deferred to the final release orchestrator, as requested.
