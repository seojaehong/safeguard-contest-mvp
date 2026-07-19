# Supabase RLS Live HEAD Probe

Generated at: 2026-07-19 21:46 KST
Source HEAD at probe: `6e51fa1687688019b33743b8a4174671aa163c6b`

## Verdict

`BLOCKED / READ-ONLY SNAPSHOT ONLY`

The live Supabase REST catalog was reachable with both service-role and anon credentials, and the probe performed only `HEAD` requests. No SQL, migration, RPC, insert, update, delete, storage operation, provider send, or corpus upload was performed.

This snapshot improves the North Star evidence, but it does not prove launch-ready RLS isolation. Tenant A/B negative tests, storage isolation, service-role route invariance, and LLM Wiki publication gates remain approval-gated.

## Probe Summary

| Metric | Value |
| --- | --- |
| Tables requested | 22 |
| Credentials | service_role, anon |
| Requests attempted | 44 |
| Methods used | HEAD only |
| Status counts | 200: 30, 206: 4, 404: 10 |
| Mutation performed | false |
| Secret values stored | false |

Raw result: `evaluation/rls-live-head-probe-current-2026-07-19/live-probe-result.json`

## Positive Isolation Signals

The following tenant-scoped tables are visible to service-role but return zero rows to anon in this count-only probe:

| Table | service_role count | anon count |
| --- | ---: | ---: |
| organizations | 4 | 0 |
| sites | 6 | 0 |
| workers | 5 | 0 |
| workpacks | 5 | 0 |
| education_records | 4 | 0 |
| dispatch_logs | 6 | 0 |
| mcp_tokens | 1 | 0 |

These are useful signals, but they are not a substitute for authenticated tenant A/B negative tests. HEAD counts do not prove row-level ownership predicates, write policies, storage object isolation, or service-role route safety.

## Public / Published Knowledge Surfaces

| Table | service_role count | anon count | Interpretation |
| --- | ---: | ---: | --- |
| safety_reference_sources | 1063 | 1063 | Public reference catalog is exposed as intended. |
| safety_reference_items | 9920 | 9920 | Public reference corpus is exposed as intended. |
| safety_reference_ingestion_runs | 2 | 2 | Ingestion run metadata is anon-visible and should remain reviewed before launch claims. |
| safety_ontology_nodes | 171 | 166 | Published subset appears anon-visible while additional service-role rows remain private. |
| safety_ontology_edges | 182 | 169 | Published subset appears anon-visible while additional service-role rows remain private. |

## Missing Production Tables

The following expected Phase B / approval-gated tables returned 404 for both service-role and anon:

| Table | Impact |
| --- | --- |
| workpack_share_sessions | Real persistent recipient share sessions cannot be claimed launch-ready from the live DB. |
| workpack_read_confirmations | Real production invited-recipient ACK storage cannot be claimed launch-ready. |
| workpack_improvements | Before/after improvement history is not backed by the production table yet. |
| workpack_improvement_photos | Photo-backed improvement evidence is not backed by the production table yet. |
| safety_reference_embeddings | SIF/KOSHA vector runtime remains migration/approval-gated. |

This matches the current product boundary: UI/API contracts and non-mutating route tests exist, but real production ACK, improvement photo persistence, and embedding runtime require explicit schema approval before launch claims.

## Safe Claims

- Live Supabase is configured and reachable.
- The current production tenant tables have useful service-role vs anon count separation signals.
- SIF/KOSHA public reference and published ontology surfaces are reachable.
- Share/ACK, improvement-photo, and embedding storage are not live-schema proven.

## Forbidden Claims

- RLS launch isolation is proven.
- Authenticated tenant A/B cross-access denial is proven.
- Storage object isolation is proven.
- Real production invited-recipient ACK is proven.
- Before/after improvement photos are production-persisted.
- SIF/KOSHA embeddings are production-active.
- LLM Wiki publication RPC/RLS/ledger is launch-ready.

