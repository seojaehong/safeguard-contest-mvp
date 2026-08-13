# Current security remediation ledger

Verdict: `NOTICE_LIVE_DEPLOYED_SOURCE_SECURITY_REMEDIATION_LEDGER_OPEN_BOUNDARIES`

The current production marker and source head are aligned at `674999ce1562e76c7bb384a84e1dd67ea1bf6767`. This ledger maps the sealed 23-finding current scan set to the remediation receipts accumulated after the immutable original Standard scan.

## Disposition

- Total current findings: 23
- Deployed-source remediation receipts: 17
- Unresolved boundaries: 6
- Approval-gated database findings: 3
- Distributed-runtime findings: 3
- Security-complete claim allowed: no

The 17 remediated rows include scoped residual boundaries where applicable. Share tuple checks, worker site checks, knowledge-ingest replay serialization, read-confirmation replay serialization, MCP generation controls, and SIF receipt enforcement do not imply that their database canaries, constraints, distributed activation, or vector runtime activation have been approved.

## Governed-path compatibility

The current source and production marker are aligned for seven previously stale Northstar security gates. The compatibility receipt composes the `4301edf7` baseline (27 files / 269 tests) with the only later governed product delta, `lib/openclaw-broker-route.ts`, verified by a 5-file / 39-test broker and limiter suite plus strict typecheck and production build at `674999ce`. This does not rewrite historical evidence or close distributed/runtime approval boundaries.

## Open boundaries

- `dispatch-null-tenant-rls-bypass`: Supabase RLS migration and live isolation proof remain approval-gated.
- `legacy-public-tables-without-rls`: RLS migration and live catalog proof remain approval-gated.
- `tenant-owned-related-object-mismatch`: database tenant-tuple constraints remain approval-gated.
- `public-compute-instance-rate-fallback`: distributed production limiter activation remains open.
- `public-ask-local-weighted-concurrency`: distributed weighted lease activation remains open.
- `agent-chat-process-local-quotas`: deployed source now supports separate atomic distributed counters for pre-auth IP and authenticated identity admission, but the production probe still reports `instance`, so distributed activation remains open.

## Immutable and mutation boundaries

The original scan `8fe9c06a-018c-446f-aa98-1b37df95287a` remains immutable at 17 reportable findings plus one deferred candidate. The 23-finding current set is preserved separately. No database schema or data mutation, provider dispatch, Share session creation, vector or embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
