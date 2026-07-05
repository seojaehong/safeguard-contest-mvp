# SafeClaw Final Release Operator Runbook

This runbook closes the remaining non-code release gates for the existing SafeClaw web product and the AI connection product.

## Current Verdict

- Automated product gates: pass.
- Release gates: blocked until the operator completes the two items below.

The latest machine-readable evidence is in `evaluation/final-release-scale-audit/final-release-scale-audit.json`.

## Gate 1: Kakao Login Provider

The login UI already preserves email magic-link signup/login and adds Kakao as an additional OAuth option. The current production Supabase response is:

```text
Unsupported provider: provider is not enabled
```

Operator action:

1. Open Supabase project `mewqgevgdgghhatqtuos`.
2. Go to Authentication -> Providers -> Kakao.
3. Enable Kakao.
4. Set the Kakao REST API key/client id and client secret from the Kakao developer console.
5. Confirm production Auth settings:
   - Site URL: `https://www.safeclaw.kr`
   - Redirect URL: `https://www.safeclaw.kr/auth/callback`
   - A wildcard redirect such as `https://www.safeclaw.kr/**` is acceptable if the project policy allows it.
6. Run:

```powershell
npm.cmd run audit:release-scale
```

Expected proof after completion:

- `releaseGates[].name == "supabase-kakao-provider-enabled"` becomes `pass`.
- Clicking `카카오로 계속하기` from `/login?next=/settings/ai-connect` redirects to Kakao/Supabase OAuth instead of the unsupported-provider JSON error.

## Gate 2: MCP Token Query Indexes

The AI connection flow is already tenant scoped:

- Users authenticate with Supabase Auth.
- Tokens are hashed, scoped to `org_id` and `site_id`, and never re-displayed as plaintext.
- Token list reads are bounded and cursor-based.
- Token list site names are loaded only for the current page rows, not every site owned by the user.
- Active tokens are capped per site.

Before 10,000-user operation, approve and apply the index candidate:

```text
evaluation/final-release-scale-audit/mcp-token-query-indexes-approval.sql
```

The candidate intentionally lives under `evaluation/`, not `supabase/migrations/`, because DB schema changes require explicit approval before application.

After applying it, run the read-only verification query and confirm all required index names are returned:

```text
evaluation/final-release-scale-audit/mcp-token-query-indexes-verify.sql
```

Operator action after approval:

1. Apply the SQL in a production-safe path outside an explicit transaction because it uses `CREATE INDEX CONCURRENTLY`.
2. Run the verification query above and save the returned rows with the deployment notes.
3. Record the applied SQL and timestamp in the deployment notes.
4. Add the approved migration or DB evidence to the repo so the strict audit can prove it.
5. Run:

```powershell
npm.cmd run audit:release-scale:strict
```

Expected proof after completion:

- `releaseGates[].name == "mcp-token-query-indexes-approved"` becomes `pass`.
- `audit:release-scale:strict` exits successfully.

## Final Closeout

Run the final verification set:

```powershell
npm.cmd test -- tests/auth-callback.test.ts tests/mcp-token-service.test.ts
npm.cmd run typecheck
npm.cmd run audit:release-scale:strict
npm.cmd run build
```

Only mark the release complete when strict mode passes and production login/token/MCP smoke evidence is refreshed.
