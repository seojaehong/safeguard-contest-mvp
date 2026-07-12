# MCP Tool Scope Enforcement

## Verdict

Status: `review_pending`

Product commits: `ad25f99aca3251c9f5866f490b5f5b6392d51000`, `8fe1fc2084a4ce7b8d6115053e5f84d58a85c3c9`

Documentation commits: `848b23c4f629118985f052766720aa7f36a06bee`, `f18686c3f069881342787ab73f1320cbbfadf9ed`

Base: `31a44c0d972c46a47c94ad387eeeff39528d1be9`

This patch makes the existing `mcp_tokens.scopes` field an enforced authorization boundary. It does not change the database schema, mutate database rows, enable the remote sidecar, or change OpenClaw runtime selection.

## Behavior

- Every one of the 10 registered SafeClaw MCP tools checks its authenticated context before doing work.
- A database token can use `tools:<exact_tool_name>`, bounded `tools:read` or `tools:write`, or the existing operator wildcard `tools:*`.
- Malformed, empty, mixed-type, and unknown-only database scope values now resolve to no permissions instead of silently becoming `tools:*`.
- New tokens receive the current 10 explicit tool scopes. A future tool is not automatically granted to an old token.
- The operator CLI and the authenticated API use one shared immutable tool contract; neither new-token path writes `tools:*`.
- Missing context or denied scope returns the stable public code `MCP_TOOL_FORBIDDEN` as an MCP tool error.
- Internal transport codes such as `ECONNRESET` are not promoted to public MCP error codes.

## TDD Evidence

The auditable RED tree used the committed tests from `8fe1fc2` while restoring the affected production files from base `31a44c0`. RED and GREEN both used Vitest `4.1.10`.

- RED: 4 files failed, 11 tests failed, 57 passed, exit 1.
- GREEN: 4 files passed, 68 tests passed, exit 0.
- Strict typecheck: exit 0.
- Production build: exit 0, static generation 27/27, build ID `Fe2cUnGZBCZ221uM8PfJO`.
- Dependency sync: `npm.cmd install`, package and lock hashes unchanged; GREEN, typecheck, and build were rerun after sync.
- `git diff --check`: exit 0.

Raw logs:

- `evaluation/mcp-tool-scope-enforcement-2026-07-12/red-test.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/green-test.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/typecheck.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/build.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/dependency-sync.log`

## Compatibility And Residual Risk

Existing database tokens explicitly carrying `tools:*` remain full-trust. Legacy `SAFECLAW_MCP_TOKENS` also remain operator-level wildcard credentials. Migration `007_mcp_tokens.sql` still defines a wildcard column default; product and CLI inserts now bypass it with explicit scopes, but changing that database default requires a separately approved migration. These compatibility paths must not be used as the dedicated sidecar credential. The signed remote transport, sidecar tool allowlist, and durable atomic nonce replay store remain separate fail-closed gates.
