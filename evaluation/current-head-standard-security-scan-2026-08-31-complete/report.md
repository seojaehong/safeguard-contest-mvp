# Current-head Standard security scan

## Verdict

`NOTICE_CURRENT_HEAD_STANDARD_SCAN_18_FINDINGS_PARTIAL_COVERAGE`

The sealed Standard scan `f218c713-1a1c-4f4e-9777-8095926be1df` completed against source revision `b5f145120766cd2ef904fce38ef32ed1a9facf74`. Production now reports the same commit.

The scan records 18 reportable findings: 13 medium and 5 low. Canonical coverage remains `partial`, with 17 recorded surface rows and 19 deferred candidate rows. Scan completion is therefore not a security-complete claim.

## Disposition

- 8 approval-free product-source findings remain open for bounded remediation.
- 9 database, RLS, or atomicity findings remain approval-gated.
- 1 public Share bearer-capability finding remains separate and approval-sensitive.
- The previously cited five-path parser occurrence is recorded as source-remediated; independently reachable sibling scanners remain findings.

## Preserved evidence

- The immutable original 18-finding baseline and completed scan `8fe9c06a-018c-446f-aa98-1b37df95287a` are unchanged.
- The later 9-finding partial scan `8d7fd844-d4cb-49ab-b984-36ed6ab0beba` is unchanged and is not reinterpreted.
- Canonical manifest, findings, coverage, generated scan report, 18 finding write-ups, and 18 supporting evidence files are copied under this directory.

## Boundaries

No database, provider, share-session, vector, wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Provider persistence, LLM wiki publication, SIF vector runtime, KOSHA exact promotion, and database security remediation remain approval-gated.
