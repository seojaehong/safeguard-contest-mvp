# Current-source HWPX inventory bounded-read remediation

## Verdict

`PASS_CURRENT_SOURCE_HWPX_INVENTORY_BOUNDED_READ_LIVE_PENDING_RESCAN_REQUIRED`

Product commit `d99c7dd4` removes the whole-file `readFileSync` path from the local HWPX inventory. The inventory now opens each candidate once, applies a 128 MiB file admission limit from the same descriptor, reads at most the 65,557-byte EOCD tail and a 1 MiB central directory, and rejects ZIP64, multi-disk, truncated, inconsistent, or over-budget metadata without returning partial entries as readable.

Malformed candidates retain the existing inventory behavior: they are recorded as `readableZip: false` while remaining candidates continue.

## Verification

| Check | Result |
| --- | --- |
| HWPX inventory and adjacent Vitest | 3 files, 25 tests PASS |
| Shared Python archive safety | 5 tests PASS |
| Node syntax check | PASS |
| Strict TypeScript check | PASS |
| Next production build | PASS, 29/29 static pages |
| Original whole-file read pattern | absent |

An independent reviewer found that the first 8 MiB candidate cap rejected a valid 16,402,848-byte default-root HWPX. The final patch uses the existing operator-scanner 128 MiB file budget while keeping memory bounded by the much smaller tail and central-directory budgets. The real 16,402,848-byte candidate remained readable with 27 entries.

## Boundaries

- This is current-source evidence. Live deployment and a fresh security rescan remain required.
- The sealed 16-finding scan and immutable original baseline are not rewritten; this receipt does not reclassify the finding.
- No database, provider, Share-session, embedding/vector, Wiki, or KOSHA registry mutation occurred.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
