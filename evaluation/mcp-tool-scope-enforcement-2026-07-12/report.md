# MCP Tool Scope Enforcement

## Verdict

Status: `review_pending`

Product commit: `ebef495df600419a21e02838c4aa1554152db233`

Base: `87798d15aea085284332942390f215f49f3399cf`

This patch makes the existing `mcp_tokens.scopes` field an enforced authorization boundary. It does not change the database schema, mutate database rows, enable the remote sidecar, or change OpenClaw runtime selection.

## Behavior

- Every one of the 10 registered SafeClaw MCP tools checks its authenticated context before doing work.
- A database token can use `tools:<exact_tool_name>`, bounded `tools:read` or `tools:write`, or the existing operator wildcard `tools:*`.
- Malformed, empty, mixed-type, and unknown-only database scope values now resolve to no permissions instead of silently becoming `tools:*`.
- New tokens receive the current 10 explicit tool scopes. A future tool is not automatically granted to an old token.
- Missing context or denied scope returns the stable public code `MCP_TOOL_FORBIDDEN` as an MCP tool error.
- Internal transport codes such as `ECONNRESET` are not promoted to public MCP error codes.

## TDD Evidence

The auditable RED tree used the committed tests from `ebef495` while restoring the four production files from base `87798d1`.

- RED: 4 files failed, 10 tests failed, 57 passed, exit 1.
- GREEN: 4 files passed, 67 tests passed, exit 0.
- Strict typecheck: exit 0.
- Production build: exit 0, static generation 27/27, build ID `OOOHOIpiuidXKnMRyy61A`.
- Dependency sync: `npm.cmd install`, package and lock hashes unchanged.
- `git diff --check`: exit 0.

Raw logs:

- `evaluation/mcp-tool-scope-enforcement-2026-07-12/red-test.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/green-test.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/typecheck.log`
- `evaluation/mcp-tool-scope-enforcement-2026-07-12/build.log`

## Compatibility And Residual Risk

Existing database tokens explicitly carrying `tools:*` remain full-trust. Legacy `SAFECLAW_MCP_TOKENS` also remain operator-level wildcard credentials. These paths are intentionally preserved for compatibility and must not be used as the dedicated sidecar credential. The signed remote transport, sidecar tool allowlist, and durable atomic nonce replay store remain separate fail-closed gates.
