# Current security remediation ledger

Verdict: `NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES`

The current production marker and source head are aligned at `4301edf79780d28079aebfa4ee715610152f2323`. This ledger maps the sealed 23-finding current scan set to the remediation receipts accumulated after the immutable original Standard scan.

## Disposition

- Total current findings: 23
- Deployed-source remediation receipts: 17
- Unresolved boundaries: 6
- Approval-gated database findings: 3
- Distributed-runtime findings: 3
- Security-complete claim allowed: no

The 17 remediated rows include scoped residual boundaries where applicable. Share tuple checks, worker site checks, knowledge-ingest replay serialization, read-confirmation replay serialization, MCP generation controls, and SIF receipt enforcement do not imply that their database canaries, constraints, distributed activation, or vector runtime activation have been approved.

## Governed-path compatibility

The current source and production marker are aligned for seven previously stale Northstar security gates. A 27-file, 269-test current-source regression suite passed for public JSON budgets, photo analysis budgets, provider cancellation/admission, public generation admission, the security follow-up paths, and MCP generation budgets. This compatibility receipt does not rewrite their historical evidence or close their distributed/runtime approval boundaries.

## Open boundaries

- `dispatch-null-tenant-rls-bypass`: Supabase RLS migration and live isolation proof remain approval-gated.
- `legacy-public-tables-without-rls`: RLS migration and live catalog proof remain approval-gated.
- `tenant-owned-related-object-mismatch`: database tenant-tuple constraints remain approval-gated.
- `public-compute-instance-rate-fallback`: distributed production limiter activation remains open.
- `public-ask-local-weighted-concurrency`: distributed weighted lease activation remains open.
- `agent-chat-process-local-quotas`: distributed agent-chat admission remains open.

## Immutable and mutation boundaries

The original scan `8fe9c06a-018c-446f-aa98-1b37df95287a` remains immutable at 17 reportable findings plus one deferred candidate. The 23-finding current set is preserved separately. No database schema or data mutation, provider dispatch, Share session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
