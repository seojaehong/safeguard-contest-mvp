# HWP export failures can disclose absolute server paths

- Severity: `low`
- Confidence: `high`
- Rule: `information-exposure.error-detail`

## Summary

The public HWP route embeds absolute WASM candidate paths in an exception and returns that message verbatim.

## Attack Path

POST /api/export/hwp crosses the broken control into JSON 500 error response.

## Impact

The public HWP route embeds absolute WASM candidate paths in an exception and returns that message verbatim.

## Source Locations

- `app/api/export/hwp/route.ts:49` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Log internal details and return a fixed public error code and generic message.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.