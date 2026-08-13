# Safety-reference work survives the final client disconnect

- Severity: `medium`
- Confidence: `high`
- Rule: `resource-exhaustion.disconnect-cancellation`

## Summary

The safety-reference coalescer stores only a promise and never propagates request cancellation into embedding and Supabase searches.

## Attack Path

GET /api/safety-reference/search crosses the broken control into Embedding and Supabase reference work.

## Impact

The safety-reference coalescer stores only a promise and never propagates request cancellation into embedding and Supabase searches.

## Source Locations

- `app/api/safety-reference/search/route.ts:34` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Use consumer-counted coalescing and abort shared work after the final consumer disconnects.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.