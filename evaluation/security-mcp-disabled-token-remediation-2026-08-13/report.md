# Disabled MCP Token Fallback Remediation

## Verdict

`PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_LIVE_PENDING`

Product commit: `01b286ee`

## Remediation

MCP authentication now loads the persisted token-hash row before considering the legacy environment fallback. A matching disabled row is rejected immediately, even when the same plaintext remains configured in `SAFECLAW_MCP_TOKENS`.

## Verification

- Focused MCP authentication: 1 file, 36 tests PASS.
- Adjacent MCP token, scope, route, and work-budget contracts: 5 files, 80 tests PASS.
- TypeScript strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Diff check and targeted secret scan: PASS.

## Boundaries

No DB schema/data mutation or external provider action was performed. MCP token expiry and default-scope hardening remain separate findings. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Live deployment alignment is pending.
