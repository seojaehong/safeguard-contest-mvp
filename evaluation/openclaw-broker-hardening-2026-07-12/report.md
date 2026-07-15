# OpenClaw Fresh Security Review Remediation

## Scope

This same-branch follow-up remediates the fresh independent findings reported against `fix/openclaw-broker-hardening` at `170cf785f90c2440454344b6fc215a825fdd6e76`. It changes only the OpenClaw broker/chat/context/engine adapter, `FieldOperationsWorkspace`, their tests, design docs, and this evidence. It does not merge the branch into main or change DB, environment, deployment, OAuth credentials, or unrelated product code.

## Security closures

1. OAuth preflight now calls `models status --agent <configured-agent> --json`. The parser rejects OpenAI auth stores with any token/API-key mixture and rejects a usable runtime route unless its effective path is `profiles`; the cache key already includes the same agent used by execution.
2. `GET /api/agent/context` now applies a coarse per-IP limiter before Supabase authentication.
3. Browser context state is token-tagged. A changed token renders no old options immediately, aborts the previous fetch, and only allows the current request generation to commit site names or `ready`. `ClawChat` applies auth/site changes in a layout effect and checks active-controller identity before every async state update.
4. `checkAvailability` and `run` share one guarded `maxConcurrent` counter. Availability receives the caller signal, and the OAuth status child kills on abort but releases the slot only after child `close`, matching chat-child semantics.
5. Missing/invalid credentials remain `401`; a resolved user without site ownership remains `403`. Auth backend failures return `AUTH_BACKEND_UNAVAILABLE`/`503`, and site query/list failures return `SITE_BACKEND_UNAVAILABLE`/`503`.
6. The design contract now states `authentication -> fine limiter -> request parsing -> site validation`, after the coarse pre-auth limiter.

## TDD evidence

- Baseline before new tests: the prior four-file set passed `40/40`.
- Fresh RED after adding the new assertions: 4 files failed, with 14 failed assertions, 38 passes, and 2 expected unhandled rejections from the missing abort propagation. The failures directly showed the missing `--agent`, accepted mixed/effective non-OAuth auth, unguarded preflight, absent context limiter, outage misclassification, and missing stale-generation guards.
- Final prior-four-file set plus new regressions: 4 files, `52/52` passed.
- New finding tests only: `12/12` passed, with the prior 40 skipped by the test-name filter.

## Verification

- Expanded dependency set (the previous 75-test set plus 12 new regressions): 8 files, `87/87` passed.
- Strict typecheck: passed with `tsc --noEmit --incremental false`.
- One sequential production build after typecheck: passed; static pages `27/27`.
- Build log: `evaluation/openclaw-broker-hardening-2026-07-12/build.stdout.log`.
- Test logs: `prior40-plus-new.stdout.log`, `expanded75-plus-new.stdout.log`, and `new-security-tests.stdout.log` in the same evidence directory.
- Typecheck log: `evaluation/openclaw-broker-hardening-2026-07-12/typecheck.stdout.log`.
- Final whitespace and owned-scope diff checks: passed.

The complete repository test suite was not run. No live deployment, OAuth login, credential-evaluating status check, agent turn, paid call, schema change, data mutation, `.env` edit, main-worktree operation, merge, or whole-branch integration occurred. The local CLI inspection was help-only.
