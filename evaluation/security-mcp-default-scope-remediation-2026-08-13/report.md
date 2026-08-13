# MCP Default Scope Remediation

## Verdict

`PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_LIVE_PENDING`

Product commit: `86f2cb53`

## Remediation

New MCP tokens issued by the authenticated web route or operator CLI now receive only `tools:read`. Generation/write tools are not granted by default, and no implicit write opt-in was added.

## Verification

- MCP token, authentication, route-scope, CLI, and work-budget contracts: 5 files, 80 tests PASS.
- TypeScript strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Diff check and targeted secret scan: PASS.

## Boundaries

Existing token rows were not changed. No DB schema/data mutation or external provider action was performed. Token expiry remains a separate security finding. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. Live deployment alignment is pending.
