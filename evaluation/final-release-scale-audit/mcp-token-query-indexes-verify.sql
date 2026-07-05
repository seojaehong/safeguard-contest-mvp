-- SafeClaw MCP token query index verification
--
-- Run this after the approved index SQL has been applied.
-- This query is read-only and should return one row per required index.

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'mcp_tokens'
  and indexname in (
    'idx_mcp_tokens_org_created_id',
    'idx_mcp_tokens_site_created_id',
    'idx_mcp_tokens_site_active_count'
  )
order by indexname;
