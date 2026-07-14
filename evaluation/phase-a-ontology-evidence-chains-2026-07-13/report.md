# Phase A ontology/workpack authority remediation evidence

- Status: `HOLD_FRESH_INDEPENDENT_REVIEW_REQUIRED`
- Branch: `fix/phase-a-ontology-target-ready`
- Product commit: `5dba6964e2e2089683a926a39edb1bb8896aa99d`
- Product tree: `6bf7ff2d1d98d08ab6494000348c7c27c124f2ab`
- Source base: `2aa8aa9136a344671d50d8a815c33df8aeb40178`
- Main/Share semantic merge: not performed
- DB/schema/migration/data/package/lock changes: none

## Product series

1. `8f290b2fd0bddd391548285c41462bd0ec0b782a` - harden authenticated workpack scope, restore authority, connected export, and confirmation persistence
2. `5dba6964e2e2089683a926a39edb1bb8896aa99d` - bind the evidence gate to current Share head `3162b4f`

The product changes 16 files from the clean pushed source base. This evidence child must have the final product commit as its direct parent. It does not integrate either target and does not approve the product.

## Closed findings

### Authenticated deterministic scope

- Workpack identity now hashes the authenticated user, exact organization ID, exact site ID, and complete generation seal.
- A supplied organization/site pair is accepted only after both rows are verified under the authenticated owner. Partial, malformed, foreign, and site-only selections fail closed with `409`; unauthenticated requests remain `401`.
- First-use fallback rows use deterministic organization/site UUIDs and primary-key race arbitration. The same user, scope, and seal converges across concurrent requests; different valid organizations/sites produce distinct workpack IDs.
- No arbitrary body scope is trusted and no schema or migration was introduced.

### Local restore revalidation

- Document edits and example/job changes abort the active local-restore revalidation gate and clear saved server authority.
- The browser contract deliberately ignores `AbortSignal`, releases a valid server response after an edit, and proves that the response cannot call `setData`, overwrite local storage, or revive server authority.

### Connected export

- Every connected export click performs a new authenticated GET for the exact server row.
- Export requires unchanged workpack ID, RFC3339 `workpacks.updated_at` revision, generation seal, and idempotency binding. Changed, malformed, unavailable, aborted, or stale responses do not create a download.
- Export content and filename are rebuilt from the click-time server row, never from the cached `server_verified` snapshot.

### Confirmation evidence preservation

- Confirmation keeps the complete raw `evidence_summary` and overlays only `answer`, `phaseAReview`, `qualityContract`, `generationEvidence`, `generationEvidenceSnapshot`, and `workpackAuthorityBinding` under the existing `workpacks.updated_at` compare-and-set.
- Unknown and future nested `reviewedLocalizationEnvelopes`, localization, dispatch, and Share keys survive exactly.
- Share `canonicalWorkpackRevision` remains a SHA-256 content hash. It is never substituted with ontology `revision`/`updatedAt`, which remain RFC3339 `workpacks.updated_at` authority.
- A localization review that changes `workpacks.updated_at` invalidates prior Phase A authority/request scope and requires an exact row reread. Preserved stale envelopes are data to revalidate, not authority to trust.
- Confirmation CAS remains `workpacks.updated_at`; dispatch CAS remains `workpack_share_sessions.updated_at`.

## Preserved contracts

The remediation preserves SIF -> KOSHA Guide -> law ordering, `naturalize_only`, statutory mandate versus guidance separation, generation seal verification, exact server authority, confirmation CAS, report authority, and honest HOLD evidence. It does not alter Share URL state, Share request scope, `initialWorkpackId`, `initialWorkpackAuthority`, `initialRequiresRevalidation`, or theme ownership.

## Verification

All commands below ran sequentially at product commit `5dba6964e2e2089683a926a39edb1bb8896aa99d`; no concurrent Next builds were started.

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused route/unit authority | 3 files, 28/28 passed | `remediation-v3-final-focused-unit.log` |
| Delayed local restore browser | 1 focused test passed, 12 skipped | `remediation-v3-final-focused-local-restore-browser.log` |
| Connected export changed/stale browser | 1 focused test passed, 9 skipped | `remediation-v3-final-focused-connected-export-browser.log` |
| Existing focused matrix | 19 files, 264/264 passed | `remediation-v3-final-focused-19-files.log` |
| Phase A lifecycle browser | 1 file, 13/13 passed | `remediation-v3-final-lifecycle-13.log` |
| Reports browser | 1 file, 10/10 passed | `remediation-v3-final-reports-10.log` |
| Strict TypeScript | passed | `remediation-v3-final-typecheck.log` |
| Diff/forbidden identity | 16 changed files, diff-check 0, forbidden paths 0 | `remediation-v3-final-diff-forbidden-identity.log` |

RED and GREEN logs for all four findings are included as separate artifacts. Runtime identity is Node `v24.12.0`, npm `11.6.2`, Next `15.5.20`, TypeScript `5.9.3`, and Vitest `4.1.10`.

## Target authority

Authoritative current target: `920c7f360688352156de4854b4957a9f2f1f0e43`

Authority ref: `refs/remotes/origin/feat/phase-a-evidence-integration`

Minimum authority ancestor: `67d2c9e28e7278c58f46b46c2512c7133d88d1d3`

- `920c7f360688352156de4854b4957a9f2f1f0e43`: authoritative current
- `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`: superseded authority
- `b3762867d380f20faee2a83a17354dc61557ce12`: historical rejected
- `cc9f5af297950b73b53a9ab4018bdc143830c499`: rejected/pending-unintegrated

Current-main reconciliation is HOLD on `tests/reports-download-center.test.ts`. Read-only `git merge-tree --write-tree` produced diagnostic tree `47f6c8e18c6f5cd959157f2d9c355e4eb23622d0` and did not modify the worktree.

## Share semantic adoption

Share v2 baseline `22de1180d69263f7c08ac0ed0cfda0894e2db7f5`, request-scope remediation `7141baac3e0abca146ef6c110093c1c0643760a2`, and browser teardown remediation `3162b4fe5e7ea32f139ff66bffa7835b14e29bd4` remain under review. Read-only reconciliation produced diagnostic tree `3e09ffbddecccf6bfe5e2a458fd3105d6bc563d9` with seven content conflicts:

1. `app/api/workpacks/[id]/route.ts`
2. `components/FieldOperationsWorkspace.tsx`
3. `components/SafeGuardCommandCenter.tsx`
4. `lib/workpack-commercial-store.ts`
5. `tests/helpers/isolated-next-browser-harness.ts`
6. `tests/workpack-generation-evidence-route.test.ts`
7. `tests/workpack-share-authority-routes.test.ts`

Future semantic integration must preserve Phase A server authority, full raw evidence summary, RFC3339 row revision, generation seal, and confirmation compare-and-set. It must also preserve Share URL/request-scope state, the request-scope stale-response guard, SHA-256 `canonicalWorkpackRevision`, `reviewedLocalizationEnvelopes`, `dispatchBinding`, and dispatch compare-and-set. Any localization update to `workpacks.updated_at` requires a row reread before confirmation, connected export, session, or dispatch.

## Verdict

`HOLD`. Fresh independent review of the complete product series is required. No integration or self-approval was performed.
