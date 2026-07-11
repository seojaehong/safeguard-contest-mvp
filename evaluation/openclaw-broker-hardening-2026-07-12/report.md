# OpenClaw Broker Hardening Report

## Result

All consolidated broker findings in the owned slice are addressed as a same-branch follow-up on top of `c1891cd`. This worktree remains on `fix/openclaw-broker-hardening`; the branch should keep advancing from that hardening commit without a whole-branch merge or a rebase onto `master`.

## Implemented gates

- `GET /api/agent/context` authenticates the bearer server-side and returns only owned-site selector `id`/`name` values. The workspace obtains that context after login and passes the selected ID to the real `ClawChat` callsite. Chat rechecks bearer and owner/site binding, preserving `401`/`400`/`403` fail-closed responses.
- Guest chat and its 10-message claim are removed. Suggestions, input, and send remain disabled until an access token and owned-site context are ready; login, loading, and unavailable-site states are explicit.
- Local OpenClaw uses the locally verified `--session-key` CLI flag with a fresh opaque key per request. It cannot reuse the persisted default `main` session across tenants.
- Static `ENGINE_TOOL_EFFECTS` metadata, relay config/types, and relay tests are removed. No tool enforcement is claimed. Local execution exposes zero executable capabilities and fails closed until a sidecar provides both site binding and executable-tool authorization before OAuth.
- Coarse IP limiting precedes JSON parsing and Supabase work; a fine limiter keys on authenticated user identity. Initial malformed anonymous requests retain `401` semantics below the coarse threshold.
- Timeout and abort retain concurrency until the underlying run confirms termination. The deterministic child seam proves the runner waits for `close`; already-aborted signals do not spawn. Raw stderr is drained without being appended, and broker logs emit stable codes only.

## Explicit non-actions

No DB schema/data mutation, live OAuth invocation, paid call, deployment, relay implementation, or full test suite run occurred. The local CLI was inspected only with `openclaw agent --help` and `openclaw sessions --help`.

## Verification

- Focused tests: 4 files, 36 tests passed.
- Strict typecheck passed.
- Normal `npm.cmd run build` passed; static pages `27/27`; `api/agent/context` is in the build route table.
- `git diff --check` is recorded after the final documentation update.
- Full suite: not run.

Build stdout: `evaluation/openclaw-broker-hardening-2026-07-12/build.stdout.log`.
