# Organization owners can bypass the knowledge-review state machine through direct Supabase writes

- Severity: `medium`
- Confidence: `high`
- Rule: `authorization.workflow-state-bypass`

## Summary

Owner-wide FOR ALL RLS lets browser-authenticated owners alter review state and receipt-bearing fields outside the guarded review operation.

## Attack Path

Direct knowledge table updates crosses the broken control into Promotion evaluation of stored approved state.

## Impact

Owner-wide FOR ALL RLS lets browser-authenticated owners alter review state and receipt-bearing fields outside the guarded review operation.

## Source Locations

- `supabase/migrations/003_knowledge_runtime.sql:94` (root_control)

## Validation Boundaries

- No live DB, provider, deployment, Share-session, vector, wiki, or KOSHA registry mutation was performed.
- Optional deployment prerequisites are stated in the finding.

## Remediation

Permit client reads only and route mutations through narrow server operations with append-only decisions.

This write-up documents static current-revision evidence only. No database, provider, Share-session, vector, wiki, or KOSHA registry mutation was performed.