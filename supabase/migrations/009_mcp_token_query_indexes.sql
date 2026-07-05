-- SafeClaw MCP token query indexes
--
-- Approved for final release scale gate after operator confirmation.
-- These indexes keep AI connection token listing and active-token cap checks
-- bounded for 1, 10, 100, 1000, and 10000-user operation.
--
-- Production was applied with the approval candidate's CREATE INDEX CONCURRENTLY
-- statements. This migration omits CONCURRENTLY so it remains replayable by
-- migration runners that execute files inside a transaction.

create index if not exists idx_mcp_tokens_org_created_id
  on public.mcp_tokens (org_id, created_at desc, id desc)
  where org_id is not null;

create index if not exists idx_mcp_tokens_site_created_id
  on public.mcp_tokens (site_id, created_at desc, id desc)
  where site_id is not null;

create index if not exists idx_mcp_tokens_site_active_count
  on public.mcp_tokens (site_id)
  where disabled = false and site_id is not null;
