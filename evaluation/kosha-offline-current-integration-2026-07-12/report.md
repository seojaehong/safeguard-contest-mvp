# KOSHA Offline Current Integration Report

- Date: 2026-07-12
- Branch: `feat/kosha-offline-current-integration`
- Current base: `3b0edfe48c29e603f3156440362fca9304ef4d1a`
- Reviewed source truth: `fa99687929833e828cea71157440875912ab0bf9`
- Status: passed with unrelated current-base caveats recorded below
- Test commit: `730c371`
- Product commit: `a0b570e`

## Selective integration

- Added a bounded `server-only` v3 corpus loader and a thin server search wrapper.
- Kept remote search and policy ownership in the current authoritative `lib/safety-reference-catalog.ts`; no stale 1,759-line policy file was introduced.
- Local KOSHA is always `supporting`; `directEligible` remains metadata only.
- Local KOSHA cannot create a risk row. Relevant page references attach only after a non-KOSHA row is grounded.
- Supporting page references require a recognized domain match or two non-generic identity terms, are deduplicated, and are capped at two per row.
- Local `itemType` filtering occurs before score and limit.
- Retrieval mode is calculated from final returned items and preserves remote `rest-ilike`, `ranked-rpc`, or `hybrid-vector-rpc` when local results do not survive.
- DB harness counts only the necessary `localTag`, `localRanked`, and `localHybrid` retrieval sources.

## TDD evidence

Tests were added before product code. Initial RED exited 1:

- Three suites failed because the current architecture did not yet contain the new corpus loader/server wrapper boundary.
- The row-specific relevance regression expected two KOSHA references and received zero.

After selective implementation, the new integration suite passed 28/28.

## Verification

All listed Vitest runs used `--maxWorkers=1 --no-file-parallelism`.

| Gate | Result | Exit |
| --- | ---: | ---: |
| new row regression | 1/1 passed | 0 |
| bounded baseline | 26/26 passed | 0 |
| original | 8/8 passed | 0 |
| expanded | 113/113 passed | 0 |
| corpus audit | 34/34 passed | 0 |
| additional impact | 41/41 passed | 0 |
| current generation/photo/share/ontology/quality-contract/MCP | 254/254 passed | 0 |
| strict typecheck | passed | 0 |
| diff check | passed | 0 |
| sequential production build | passed, attempt 1/1, static pages 27/27 | 0 |

Before the build, the worktree-scoped matching build-process count was zero. Exactly one `npm.cmd run build` was launched.

## Integrity audit

- External v3 corpus: 6 files, 79,572,222 bytes, all SHA-256 values identical before and after.
- External access: loader opens corpus files read-only; no external files or attributes were changed.
- Forbidden changes: 0 DB, schema, env, migration, external v3, or Python snapshot files.
- Client corpus imports: 0.
- `lib/safety-reference-policy.ts`: absent.
- Current OpenClaw, generation, SIF, DB harness, UI, PDF, current-workpack, and session owners were preserved; only server search imports and retrieval metadata were extended.

## Current-base caveats

The broad discovery run also included two unrelated files and reported 13 pre-existing failures:

- `tests/frontend-shared-surfaces.test.ts`: 12 typography/UI contract failures.
- `tests/live-harness-quality-probe.test.ts`: imported probe syntax error before tests were collected.

Those two tests and all referenced UI/probe files are byte-identical to `3b0edfe` (`git diff --exit-code 3b0edfe -- ...` returned 0). They were not changed because the integration scope explicitly preserves current UI and quality surfaces. The scoped requested contract run passed 254/254.

The first same-name pull could not run because the remote feature branch did not exist before first publish. `git fetch origin` succeeded and rebase onto `origin/feature/backend-harness-gate` at `3b0edfe` reported the branch up to date.

## Evidence files

- `red.log`
- `verification.log`
- `typecheck.log`
- `build-process-before.json`
- `build.log`
- `external-v3-hashes.json`
- `diff-audit.json`
- `diff-check.log`
- `git-sync.log`
