# Share read admission security remediation

## Verdict

PASS_CURRENT_SOURCE_SHARE_READ_CALLER_ADMISSION_LIVE_AND_RESCAN_PENDING

Product commit b9c41f4f prevents caller-controlled Share session and worker IDs
from creating unlimited fresh read-rate buckets. Every request now consumes a
stable caller quota and a separately hashed capability quota. Service-role
Share reads are also protected by a distributed production concurrency lease.

## Verification

- Focused Vitest: 3 files, 79 tests passed, 0 failed.
- Strict TypeScript typecheck: PASS.
- A regression test sends 61 requests from one caller across distinct Share
  capability IDs and proves the final request is rejected before session lookup.
- Distributed keys do not contain plaintext session or worker identifiers.

## Live state

The production marker reported 69ce78c451da37e2670bc973c9e2e41a8b2969ad
when checked. Product commit b9c41f4f is pushed to master but is not yet proven
live.

This artifact does not close the scan finding. A fresh security re-scan after
deployment is required.

## Preserved boundaries

- Exact saved /share/[sessionId]: MISSING_EVIDENCE.
- No Share session was created and no DB record was read for user-specific
  geometry evidence.
- No DB, provider dispatch, vector, wiki, or KOSHA registry mutation occurred.
- Approval-gated launch boundaries remain open.
