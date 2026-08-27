# Current Full-Repository Security Scan

## Verdict

`NOTICE_CURRENT_HEAD_STANDARD_SCAN_19_FINDINGS_PARTIAL_COVERAGE_REMEDIATION_REQUIRED`

The sealed Standard scan ran against source and production commit `4e3e7e5d9ebad7e91f428a856019122431410be4`. It reported 19 findings: 14 medium and 5 low. The immutable original 18-finding baseline remains preserved.

This is not a security-complete result. Canonical coverage is `partial`, with nine reviewed surfaces and 26 deferred coverage items. Finding counts from scans with different grouping and coverage are not treated as a simple regression score.

## Disposition

- 12 findings require database, RLS, or atomicity remediation and remain approval-gated.
- The sealed scan classified seven source-side candidates at `4e3e7e5d`. Current source at `f95773c2` has bounded fixes and focused regression coverage for six of them: Share ACK admission, safety-reference status cancellation, HWPX input/output budgets, and stable public weather/XLSX/HWPX errors.
- The remaining `public-share-object-id-credential` finding needs an unforgeable recipient capability and storage/session design, so it is retained as an approval-sensitive Share boundary rather than claimed fixed.
- A fresh full-repository scan is still required before any of the six source fixes are promoted from tested remediation to security closure.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.

## Evidence

- Scan ID: `da97e400-1f4d-40b9-a434-ab5ab013fdb3`
- Sealed at: `2026-08-27T16:44:19.760101Z`
- Production marker: `4e3e7e5d9ebad7e91f428a856019122431410be4`
- Canonical manifest: `canonical/scan-manifest.json`
- Canonical findings: `canonical/findings.json`
- Canonical coverage: `canonical/coverage.json`
- Generated scan projection: `scan-report.md`
- SARIF: `exports/results.sarif`
- Northstar focused verification: 3 files / 174 tests PASS
- Product remediation verification: 6 files / 94 tests PASS
- Strict TypeScript check: PASS

## Northstar Integration

The regenerated open-gate audit is intentionally `contradicted`: 49 gates are proven, 10 are notice, eight are contradicted, and seven are approval-gated. The eight contradictions are older security receipts whose governed paths changed after their evidence and were not fully covered by this partial scan. Current-source remediation does not override those receipts or the partial scan. The next runway remains `OPEN_APPROVAL_GATED`.

## Mutation Boundary

No database, provider dispatch, Share-session, embedding/vector, wiki publication, or KOSHA exact-registry mutation was performed.
