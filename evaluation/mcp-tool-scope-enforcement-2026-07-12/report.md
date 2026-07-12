# MCP Tool Scope Enforcement

## Verdict

Status: `review_pending`

Independent review: `pending`

- Authoritative base: `24c19c17cc8c932a333fdae8785426218e57ae15`
- Remediation RED test commit: `7054bb03f6e367d43cd3cf872937336eee8a5031`
- Remediation product commit: `8c62499e5da2e260defe5d5656a45a166bb0f533`
- Second-review RED commit: `4d70cf0727e74778b08c6f7ce86395fdeb9f5573`
- Second-review test product commit: `4ad5455ff5c4f4d0eb3a23d07c07e6d746cd09e0`

The branch is rebased onto the authoritative backend containing the scenario/protocol and frontend launch changes. It does not include the separate future KOSHA branch and makes no DB, migration, env, or data change.

## Security Behavior

- `normalizeScopes` grants permissions only when every array member is a known non-empty string after trimming. Any malformed, mixed-type, whitespace-empty, overlong, or unknown member denies the entire array.
- All 10 MCP tools register through the canonical imported `registerScopedTool`. The structural contract resolves the TypeScript import and parameter symbols, rejects aliases, direct or computed `server.registerTool` paths, alternate-object `.registerScopedTool`, and dynamic tool names.
- The actual `registerScopedTool` callback is captured with a fake server. Missing and denied auth both return `MCP_TOOL_FORBIDDEN` with handler calls fixed at `0`; an authorized context reaches the handler exactly once.
- Authorization callers receive only `MCP_TOOL_FORBIDDEN` and `도구 권한이 없습니다.`.
- Other failures receive only `MCP_TOOL_INTERNAL_ERROR` and `도구 실행 중 오류가 발생했습니다.`. Transport messages, Supabase-like bodies, internal codes, and secret fields are absent from caller payloads.
- The former wrapper statement-order AST proof was removed; callback behavior now proves guard-before-handler execution without depending on the handler's source spelling.

## TDD Provenance

The remediation RED is exact and reachable in Git:

- Commit: `7054bb03f6e367d43cd3cf872937336eee8a5031`
- Tree: `b31bd661f823a8f996b5074052c2fe611e10ca87`
- Parent: `8bab30603699711cc7048c7b3018e2191188102d`
- Command blob: `c15be0f9bf72331844c89d68dc23a7ca0affafcc`
- Count blob: `4cd8ceb60c4348e1444a14ca1432dfd78bae5344`
- Log blob: `baf18a3ed7099c78c5843149b22b250d18abee9d`
- RED result: 4 files, 71 tests; 65 passed and 6 failed, exit 1.

The earlier feature `red-test.log` is retained only as **historical reconstructed evidence**. It was produced by restoring selected production files against the old base and does not identify an exact reachable RED tree. No exact-tree claim is made for it.

The second-review RED is also exact and reachable:

- Commit: `4d70cf0727e74778b08c6f7ce86395fdeb9f5573`
- Tree: `09e6d551c71f5ffe024caae08dda5412ebf5a223`
- Parent: `9e15d0d8c324d3451256bc15ddea21c23f8680a0`
- Command blob: `c15be0f9bf72331844c89d68dc23a7ca0affafcc`
- Count blob: `106c88793c495e22fefea7d498a858a9c0cac095`
- Log blob: `6207eaec9f745a6bbb3a3c46e694b3ed83e7be9b`
- RED result: 4 files, 77 tests; 73 passed and 4 failed, exit 1.

## Final Gates

- Focused MCP tests: 4 files passed, 77 tests passed, exit 0.
- Strict typecheck: `npm.cmd run typecheck`, exit 0 at `2026-07-12T08:42:04.4915693Z`.
- Diff check: `git diff --check 24c19c17cc8c932a333fdae8785426218e57ae15 --`, exit 0.
- Build preflight: global Node build processes `0` at `2026-07-12T08:35:02.5366276Z`.
- Sequential production build: exactly one invocation after preflight, exit 0, static generation `27/27`, build ID `3LSgmr24ZIYtKNMRLz_25`. The raw committed build log ends with `BUILD_ID=3LSgmr24ZIYtKNMRLz_25`, and the evidence test requires the report ID to match that line.

Logs are in `evaluation/mcp-tool-scope-enforcement-2026-07-12/`: `remediation-red-test.log`, `green-test.log`, `typecheck.log`, `diff-check.log`, `build-preflight.log`, and `build.log`.

## Residual Risk

Existing DB tokens and legacy env credentials that explicitly carry `tools:*` remain full-trust for compatibility. Migration `007_mcp_tokens.sql` still has a wildcard default; changing it remains approval-gated. The separate KOSHA work is not integrated.
