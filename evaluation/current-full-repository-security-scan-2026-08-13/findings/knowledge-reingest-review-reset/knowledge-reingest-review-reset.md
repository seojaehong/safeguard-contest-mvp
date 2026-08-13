# Re-ingestion overwrites reviewed evidence without returning it to pending review

- Severity: `medium`
- Confidence: `high`
- Rule: `integrity.review-lifecycle-reset`

## Summary

Repeated ingestion replaces reviewed event content and provenance while preserving its prior review_status.

## Attack Path

POST /api/knowledge/ingest crosses the broken control into Existing knowledge_events update.

## Impact

Repeated ingestion replaces reviewed event content and provenance while preserving its prior review_status.

## Source Locations

- `app/api/knowledge/ingest/route.ts:125` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Version reviewed events or atomically reset changed content and invalidate dependent runs.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.