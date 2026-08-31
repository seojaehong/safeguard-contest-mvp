# SafeClaw KOSHA archive preflight remediation

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_KOSHA_ARCHIVE_PREFLIGHT_LIVE_PENDING`
- Product commit: `41de3997aed1907a95b794040edef542cb1f40f2`
- Production at verification: `d7f4794bef57d651a2e0d9581245e45d984185b2`
- Finding: `csf_d7f23c57f1ee89b4c6cdad17` (`resource-exhaustion.unbounded-audit-archive-preflight`, medium)

## Remediation

The KOSHA audit no longer opens every ZIP through `AdmZip.getEntries()` before the bounded Python helper. The Node runner now delegates archive inventory to a read-only Python mode with explicit member, member-size, compression-ratio, aggregate-uncompressed-byte, timeout, and output-buffer budgets.

The shared archive boundary reads only the bounded ZIP end-of-central-directory tail and a bounded central directory before `zipfile.ZipFile` can materialize its inventory. Preflight and `ZipFile` share the same open file handle, closing the path-replacement race between validation and parsing. The technical-support parser independently uses the same boundary and also enforces aggregate archive count, member count, input byte, and uncompressed byte budgets.

The inventory path preserves the prior audit meaning by considering ZIP members only when a directory also contains direct PDFs. Helper failures expose fixed error codes instead of stderr or local paths.

## Verification

- Focused Python archive, snapshot, and ingestion suites: `64/64` PASS.
- KOSHA audit contract Vitest: `112/112` PASS.
- Adjacent parser-budget Python suites: `13/13` PASS.
- Adjacent parser and offline-harness Vitest: `3` files, `37` PASS, `1` skipped, `0` failed.
- The negative runner regression tampers the ZIP EOCD to declare `10,001` members and proves failure before production/provider/DB work.
- Strict TypeScript: `npm.cmd run typecheck` PASS.
- Production build: Next.js `15.5.22`, `28/28` static pages PASS.

## Boundary

Production still reports `d7f4794b`; therefore this receipt proves current-source/local-production behavior only and remains live pending until `41de3997` is deployed. It does not reclassify the sealed finding or rewrite the immutable original 18-finding baseline. A fresh full-repository security scan remains required for broader closure.

No database, provider dispatch, Share-session, vector/embedding, Wiki, or KOSHA registry mutation occurred. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; approval-gated findings and security-complete remain open.
