# Current-Source KOSHA Approval Path Hardening

Verdict: `PASS_CURRENT_SOURCE_LOCAL_APPROVAL_EVIDENCE_PATH_HARDENING_LIVE_PENDING`

Source commit: `c7535131fa8ff40deebeb0e84afb3ba6d4be5880`

Security scan: `87e5bcdf-c1d2-4094-8ad9-a670fd1fd521`

## Remediated Findings

- `approval-evidence.symlink-follow` (medium): approval evidence now requires a regular Git mode, rejects filesystem symlinks, verifies real-path containment, and compares current bytes with the exact `HEAD` blob SHA-256.
- `kosha.review-path-symlink` (medium): review inputs, companion evidence, output directories, and existing report destinations reject symlink traversal before read or write.

## Verification

- Focused security contracts: 2 files, 28 tests passed, 0 failed.
- Adjacent approval preflights: 5 files, 50 tests passed, 0 failed.
- Strict TypeScript typecheck: passed.
- Node syntax checks and `git diff --check`: passed.

## Preserved Boundaries

- The immutable original 18-finding baseline remains unchanged.
- No database, provider, Share-session, embedding, vector, Wiki, or exact KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Human KOSHA review and separate exact-promotion approval remain required.
- Live deployment verification is pending; this report proves current-source local behavior only.

## Follow-up Security Work

- `approval-evidence.stale-source-binding` remains open. It needs a compatible source-plus-evidence contract across the four approval workflows.
- `kosha.transitive-corpus-binding` remains open. It needs coordinated current/manifest/items/body digests across all KOSHA packet and reviewer artifacts.
