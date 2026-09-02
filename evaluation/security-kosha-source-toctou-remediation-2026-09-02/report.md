# KOSHA source identity TOCTOU remediation

## Verdict

`PASS_CURRENT_SOURCE_KOSHA_IDENTITY_BOUND_PARSING_LIVE_PENDING`

Product commit `a85a64e6b3415870e458c09171703a2639c6527f` closes the current-source gap where KOSHA ZIP or direct PDF paths could be reopened after source identity capture. Production was still `de6d8db145a8ccdd16f4bd7930b74919a0173164` at verification time, so live closure is pending.

## Security behavior

- Direct PDF parsing verifies the exact bytes read against the captured file size and SHA-256.
- ZIP sources are copied into a private spooled snapshot while hashing, and parsing uses only that verified snapshot.
- A changed source raises `SourceIdentityError` and aborts the run instead of becoming an ordinary per-document extraction failure.
- The existing full-source check before publication remains in place.

## Verification

| Check | Result |
| --- | --- |
| Python KOSHA corpus suite | 61/61 PASS |
| TypeScript KOSHA audit contract | 112/112 PASS |
| Strict typecheck | PASS |
| Tampered archive direct probe | Exit 1, `kosha-local-inventory-failed:1`, audit log present |

The TypeScript timeout for the malformed-archive subprocess now exceeds its own 60-second child timeout. This changes only the test harness allowance; the production helper deadline remains unchanged.

## Boundaries

The sealed finding `csf_731dfce06fea0669acffcc3e` is not rewritten or reclassified by this receipt. A fresh repository security rescan and live-after-deployment verification remain required. No database, provider, Share-session, embedding, vector, wiki, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
