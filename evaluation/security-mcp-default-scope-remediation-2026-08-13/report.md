# MCP Default Scope Remediation

## Verdict

`PASS_LIVE_DEPLOYED_SOURCE_MCP_READ_ONLY_DEFAULT`

Product and production marker: `86f2cb5372dd09b7dc30287a75de7d5a7f40569f` on `master` / `production` (`safeguard-contest-5p7yjzcrn-seojaehongs-projects.vercel.app`). This proves deployed-source alignment only; no live token was issued.

## Remediation

New MCP tokens issued by the authenticated web route or operator CLI now receive only `tools:read`. Generation/write tools are not granted by default, and no implicit write opt-in was added.

## Verification

- MCP token, authentication, route-scope, CLI, and work-budget contracts: 5 files, 80 tests PASS.
- TypeScript strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Diff check and targeted secret scan: PASS.

## Boundaries

Existing token rows were not changed. No DB schema/data mutation or external provider action was performed. Token expiry remains a separate security finding. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`. The production marker confirms deployment of the read-only default source but does not replace a separately approved live issuance check.
