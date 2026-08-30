# HWPX Anonymization Archive Remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_CURRENT_OPERATOR_HWPX_ARCHIVE_BUDGET_RESCAN_PENDING`

Product commit `1db914b27a739cdcd036cdefd9def859f01986dd` is present in the current production source marker. The operator anonymization script no longer invokes PATH-selected `unzip` or shell `zip`, and it no longer extracts archive members to the filesystem.

## Controls

- Uses the repository's existing `adm-zip` dependency for an in-process transform.
- Rejects oversized input, output, member count, individual expanded member size, total expanded size, and elapsed processing time.
- Rejects absolute, parent-traversal, and symlink member identities before member content is decoded.
- Requires `mimetype` to remain the first uncompressed member with the exact `application/hwp+zip` payload.
- Reopens the output archive and verifies the HWPX ordering and compression contract before returning it.

## Verification

- HWPX anonymization and adjacent localization suites: 2 files, 17 tests passed, 0 failed.
- Node syntax check: passed.
- Strict TypeScript check: passed.
- Read-only committed-template probe: 93,770 input bytes, 14 members, 1,143,774 expanded bytes, unchanged 93,770-byte output, and a valid first STORED `mimetype` member.
- Production marker: `1db914b27a739cdcd036cdefd9def859f01986dd`.

## Boundaries

- This operator-script remediation remains subject to a fresh full-repository security rescan.
- No database, provider dispatch, Share-session, embedding/vector, wiki, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- Existing approval-gated launch boundaries remain unchanged.
