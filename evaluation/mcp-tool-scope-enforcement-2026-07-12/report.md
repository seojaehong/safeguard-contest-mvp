# MCP Tool Scope Enforcement

## Verdict

Status: `review_pending`

Independent review: `pending`

- Authoritative base: `24c19c17cc8c932a333fdae8785426218e57ae15`
- Remediation RED test commit: `7054bb03f6e367d43cd3cf872937336eee8a5031`
- Remediation product commit: `8c62499e5da2e260defe5d5656a45a166bb0f533`

The branch is rebased onto the authoritative backend containing the scenario/protocol and frontend launch changes. It does not include the separate future KOSHA branch and makes no DB, migration, env, or data change.

## Security Behavior

- `normalizeScopes` grants permissions only when every array member is a known non-empty string after trimming. Any malformed, mixed-type, whitespace-empty, overlong, or unknown member denies the entire array.
- All 10 MCP tools register through typed `registerScopedTool`. Its executable callback authorizes before handler work, logs non-authorization exceptions with the repository logger, and owns safe error conversion.
- Authorization callers receive only `MCP_TOOL_FORBIDDEN` and `도구 권한이 없습니다.`.
- Other failures receive only `MCP_TOOL_INTERNAL_ERROR` and `도구 실행 중 오류가 발생했습니다.`. Transport messages, Supabase-like bodies, internal codes, and secret fields are absent from caller payloads.
- The TypeScript AST contract rejects direct registration, dynamic tool names, comment-only matches, and handler-before-guard fixtures.

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

## Final Gates

- Focused MCP tests: 4 files passed, 71 tests passed, exit 0.
- Strict typecheck: `npm.cmd run typecheck`, exit 0.
- Diff check: `git diff --check 24c19c17cc8c932a333fdae8785426218e57ae15 --`, exit 0.
- Build preflight: global Node build processes `0`.
- Sequential production build: one invocation after preflight, exit 0, static generation `27/27`, build ID `ZJRVHMPheqa6pINj2wz-S`. It ran before the verified metadata-only `e040ce0` to `24c19c1` rebase and was not repeated, preserving the requested single build invocation.

Logs are in `evaluation/mcp-tool-scope-enforcement-2026-07-12/`: `remediation-red-test.log`, `green-test.log`, `typecheck.log`, `diff-check.log`, `build-preflight.log`, and `build.log`.

## Residual Risk

Existing DB tokens and legacy env credentials that explicitly carry `tools:*` remain full-trust for compatibility. Migration `007_mcp_tokens.sql` still has a wildcard default; changing it remains approval-gated. The separate KOSHA work is not integrated.
