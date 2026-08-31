# Current-head Standard security scan

- Scan: `f6bef30a-7250-428b-9f66-0bad1e42058c`
- Target: `9504d8db95fcbc9f37f6c5abc638e9ad0813a325`
- Verdict: `NOTICE_CURRENT_HEAD_STANDARD_SCAN_21_FINDINGS_PARTIAL_COVERAGE`
- Findings: 21 (`medium` 7, `low` 14)
- Canonical coverage: `partial`

The Standard scan completed and sealed all canonical artifacts. It does not support a security-complete claim because 21 reportable findings and deferred coverage remain.

Nine database/RLS/atomicity findings remain approval-gated. The Share object-capability finding remains separate and exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Eleven approval-free source findings form the next bounded remediation queue.

No database, provider, Share-session, vector, Wiki, embedding, or KOSHA exact-registry mutation was performed.
