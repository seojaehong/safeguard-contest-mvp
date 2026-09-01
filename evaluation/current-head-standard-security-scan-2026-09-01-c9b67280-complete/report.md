# Current-head Standard security scan

## Verdict

`NOTICE_CURRENT_HEAD_STANDARD_SCAN_16_FINDINGS_PARTIAL_COVERAGE`

The sealed Standard scan `392a4135-abb0-412d-9128-0c836c94a5ca` reviewed the clean, source/live-aligned revision `c9b67280a64995b3cd26f243f404623de21a489a`. It reports 16 findings: 8 medium and 8 low, with no critical or high finding. All 16 finding write-ups and supporting evidence files are preserved beside the canonical artifacts.

## Coverage

- Repository tracked files: 7,057
- Independent discovery receipts: 4/4 complete
- Recorded coverage surfaces: 13
- Deferred coverage entries: 6
- Coverage completeness: `partial`
- Rejected/suppressed surfaces: 2

The scan is complete, but the product is not security-complete. Partial coverage and every reportable finding remain visible.

## Disposition

- Approval-gated database/RLS/atomicity findings: 7
- Approval-free product-source findings: 9
- Approval-sensitive exact saved Share finding in this scan: 0

The nine approval-free findings cover KOSHA source identity, PDF parser deadlines, HWPX anonymization and inventory admission, XLSX pre-materialization admission, bounded audit HTTP responses, public page disconnect cancellation, and release subprocess deadlines. They are remediation inputs, not closed findings.

## Boundaries

No database, provider dispatch, Share-session, embedding/vector, Wiki, or KOSHA exact-registry mutation was performed. The original 18-finding baseline and all prior sealed scans remain immutable. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; database security, provider persistence, Wiki publication, SIF vector runtime, and KOSHA exact promotion remain approval-gated.

## Canonical artifacts

- `canonical/scan-manifest.json`
- `canonical/findings.json`
- `canonical/coverage.json`
- `scan-report.md`
- `exports/results.sarif`
- `findings/<slug>/<slug>.md` and `findings/<slug>/poc/evidence.txt`
