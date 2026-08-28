# Direct knowledge-event writes can forge review approval state

**Severity:** Low

`knowledge_events` exposes `review_status` and `proposed_wiki_update` under a tenant owner `FOR ALL` policy, bypassing application receipt validation for direct PostgREST writes.

## Remediation

Protect governance fields and expose only a transactional, reviewer-bound transition.
