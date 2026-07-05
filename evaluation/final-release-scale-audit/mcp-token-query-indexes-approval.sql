-- SafeClaw MCP token query indexes: approval candidate
--
-- Purpose:
-- - Prepare the mcp_tokens table for 10,000-user operation.
-- - Keep /api/mcp-tokens list queries cursor-friendly by org/site scope.
-- - Keep active-token issuance caps fast by site.
--
-- Important:
-- - This file is an approval candidate, not an applied migration.
-- - Do not place this SQL under supabase/migrations or run it in production
--   until the operator approves the DB schema change.
-- - CREATE INDEX CONCURRENTLY must run outside an explicit transaction.

create index concurrently if not exists idx_mcp_tokens_org_created_id
  on public.mcp_tokens (org_id, created_at desc, id desc)
  where org_id is not null;

create index concurrently if not exists idx_mcp_tokens_site_created_id
  on public.mcp_tokens (site_id, created_at desc, id desc)
  where site_id is not null;

create index concurrently if not exists idx_mcp_tokens_site_active_count
  on public.mcp_tokens (site_id)
  where disabled = false and site_id is not null;

