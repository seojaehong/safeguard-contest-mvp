# SafeClaw Release Scale Audit (2026-07-05)

## Scope

Final release readiness for both tracks:

- Existing SafeClaw web workflow: document generation, workspace, settings, and production smoke path.
- AI connection workflow: external AI clients such as OpenClaw/Codex/Claude connect through tenant-scoped MCP tokens.

## Current Evidence

- Existing production flow was previously smoke-tested with `/settings/ai-connect`, unauthenticated token/MCP guards, and `/api/ask` document generation.
- OpenClaw + OpenAI OAuth was previously verified against production MCP with 8 tools and an Ansan outdoor welding TBM live turn.
- Magic-link callback handling now uses `/auth/callback?next=...` so AI connection login can return to `/settings/ai-connect`.
- MCP token listing is bounded and cursor-based:
  - Default list limit: 25.
  - Public max list limit: 50.
  - `nextCursor` enables older-token pagination without offset pagination.
  - Tokens remain organization/site scoped and plaintext tokens are never stored.

## Scaling Position

This is no longer a single-account AI PoC. The current product path supports many users by separating:

- User identity: Supabase Auth session.
- Tenant ownership: `organizations` and `sites`.
- AI access: hashed `mcp_tokens` scoped to `org_id` and `site_id`.
- Client setup: per-user/per-site token issuance from `/settings/ai-connect`.

The API returns only bounded pages of token summaries, so a user or organization with many issued AI connections does not force unbounded UI reads.

## Remaining Release Gates

- Supabase Auth dashboard must use production callback settings:
  - Site URL: `https://www.safeclaw.kr`
  - Redirect URL: `https://www.safeclaw.kr/auth/callback` or `https://www.safeclaw.kr/**`
- Before 10,000-user operation, add approved DB indexes for token management queries:
  - `mcp_tokens(org_id, created_at desc)`
  - `mcp_tokens(site_id, created_at desc)`

The DB index work is intentionally not applied in this pass because schema changes require explicit approval.

## Verification Commands

- `npm.cmd test -- tests/mcp-token-service.test.ts`
- `npm.cmd run typecheck`
- `npm.cmd run build`

