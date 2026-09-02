# Required CI baseline remediation

## Verdict

`PASS_CURRENT_SOURCE_REQUIRED_CI_CONTRACTS_REMOTE_PENDING`

The 16 PR failures were reproduced and separated into one real CSS typography defect, stale delegated-route and copy assertions, a stale frontend audit, a knowledge-promotion test that conflicted with the established authentication-first boundary, shallow CI history, and Windows-only Git-fixture timing.

## Remediation

- Restored the required HUD typography tuple and removed an invalid pseudo-element typography override.
- Taught route coverage to follow Ask, Search, and Ontology delegated live-page owners.
- Kept authentication before request-body parsing while preserving the malformed promotion command no-mutation boundary.
- Regenerated the frontend consistency audit with zero violations.
- Configured GitHub checkout with full history for Northstar ancestry checks.
- Scoped a 15-second timeout to the two slow Windows Git-fixture suites.

## Verification

- Original focused CI group: 8 files, 92 tests passed.
- Northstar open-gate audit: 205 tests passed in 1897.48 seconds.
- Windows fixture suites: 2 files, 34 tests passed without a CLI timeout override.
- Clean-tree report provenance: 12 tests passed in 43.24 seconds.
- TypeScript strict typecheck: PASS.
- Frontend consistency audit: PASS, 0 violations.
- Next.js 15.5.22 production build: PASS, 29 static pages generated.

The exact full-suite run before the final closures took 3276.39 seconds. It reported nine failures: seven default-timeout failures and two clean-tree provenance failures caused by the then-uncommitted CSS change. Both classes passed after their bounded fixes. Remote GitHub CI remains the final integration gate.

## Boundaries

No database schema or data mutation, provider dispatch, share-session creation, embedding/vector mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` evidence remains `MISSING_EVIDENCE`, and approval-gated operations remain closed.
