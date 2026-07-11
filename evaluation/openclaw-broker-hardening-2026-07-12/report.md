# OpenClaw Release Blocker Follow-up

## Scope

This same-branch follow-up addresses exactly three independently confirmed blockers on product series `c1891cd + 0b8799e + a94f94a`. It does not merge the branch into main or change DB, environment, deployment, OAuth, or unrelated product code.

## Fixed blockers

1. `ClawChat` now owns an active `AbortController`. A changed `authToken` or `siteId` aborts the active fetch/SSE, clears turns, resets busy state, and prevents the aborted request from mutating later turns.
2. The coarse pre-auth IP limiter remains first. After successful authentication, the user limiter now runs before request JSON parsing and before owned-site DB lookup, so malformed and unowned requests consume the authenticated quota.
3. The OpenClaw owned-site context catch in `FieldOperationsWorkspace` now emits only `CLAW_CONTEXT_LOAD_FAILED`; it does not pass a raw `Error` or object to browser logging.

## TDD evidence

- Chat context RED: 1 of 5 tests failed because the active signal remained un-aborted.
- Limiter RED: 2 of 18 tests failed; observed order was `authenticate -> body -> owned-site -> fine-limit`, and the quota-following request returned `200` instead of `429`.
- Logging RED: 1 of 6 tests failed because the stable event-code reporter was absent.
- Final focused GREEN: 4 files, 40 tests passed, 0 failed.

## Verification

- Strict typecheck: passed.
- Production build: passed; static pages `27/27`.
- Build log: `evaluation/openclaw-broker-hardening-2026-07-12/build.stdout.log`.
- Final diff check: passed.
- Full suite: not run.

No live deployment, OAuth invocation, paid call, schema change, data mutation, main-worktree operation, merge, or whole-branch integration occurred.
