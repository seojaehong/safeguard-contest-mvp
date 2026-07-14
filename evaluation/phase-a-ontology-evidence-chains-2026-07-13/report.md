# Phase A authority remediation evidence

- Status: `HOLD_FRESH_WHOLE_SERIES_REVIEW_REQUIRED`
- Branch: `fix/phase-a-ontology-target-ready`
- Remediation product: `ed90a95dad3a28d6171758c52ac03acba83733fd`
- Product tree: `315c753db35faf229daf49a447c2568d138a185a`
- Main/Share semantic merge: not performed
- DB/schema/migration/data/package/lock mutation: none

## Review series

The inherited 19-commit product series is `102ff66b67cc40ff16386c61a221d3815b142e1b..cc5ba41f96c486e87445efba470c668b36107e4f`; every exact SHA is listed in `report.json` and `evidence-manifest.json`. Its prior evidence child is `ff093fae30c331816f0068f9075b91b151d05813`.

The remediation product series is:

1. `1f9784f4087e240b009c232868e5cd387a55dd48` - harden Phase A workpack authority
2. `ed90a95dad3a28d6171758c52ac03acba83733fd` - bind current-main and Share semantic adoption conflicts

This evidence must be a direct child of the second product commit. A fresh independent review must assess the whole inherited and remediation series. No earlier HOLD is converted into approval here.

## Target authority

Authoritative current target: `920c7f360688352156de4854b4957a9f2f1f0e43`

Authority ref: `refs/remotes/origin/feat/phase-a-evidence-integration`

Minimum authority ancestor: `67d2c9e28e7278c58f46b46c2512c7133d88d1d3`

- `920c7f360688352156de4854b4957a9f2f1f0e43`: authoritative current
- `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`: superseded authority
- `b3762867d380f20faee2a83a17354dc61557ce12`: historical rejected
- `cc9f5af297950b73b53a9ab4018bdc143830c499`: rejected/pending-unintegrated

Current-main reconciliation is HOLD on `tests/reports-download-center.test.ts`. Read-only `git merge-tree --write-tree` produced diagnostic tree `d4c141c1fd1d0e6013f8cee27fff016d13357815`; it did not modify this worktree.

The diagnostic tree preserves target-owned `lib/db-harness.ts`, `lib/safety-reference-catalog.ts`, and `lib/safety-reference-catalog-server.ts` byte-for-byte. Its auto-merged `lib/search.ts` retains safe per-source rejection logging and verified-current technical guidance. The tree also retains integrity-blocked aggregate behavior, SIF -> KOSHA -> law order, `naturalize_only`, mandate/guidance separation, and exact `PhaseAGenerationGrounding`.

## Closed P1 authority gaps

- All generation, save, confirmation, revalidation, improvement-save, and report-loading operations use a request epoch, owned `AbortController`, and post-response current-binding check. Editing or a second generation invalidates prior work; textarea/example actions cannot reset generating state.
- The server derives one authenticated creator-plus-generation UUID and inserts it against the existing `workpacks.id` primary key. Concurrent tabs/devices converge through atomic PK arbitration. A `23505` response reopens only an exact creator/org/site/scope/generation/HMAC binding; every mismatch or collision fails closed.
- Local JSON restore/export is always `local_only_unverified`. Connected UI/export requires exact server row ID, revision/updatedAt, generation seal, and authority revalidation.
- Search rejection is no longer silent. The repository logger records only the safe source label and error type.

No DB approval blocker remains for this implementation because it uses the existing UUID primary key and evidence-summary binding without changing schema. No live Supabase mutation was run, so the report does not claim live-DB verification.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Phase A browser lifecycle | 1 file, 13/13 passed at `1f9784f`; final delta is contract/docs/evidence gate only | `remediation-v2-green-phase-a-browser-lifecycle-final.log` |
| Reports browser | 1 file, 10/10 passed at `1f9784f` | `remediation-v2-green-reports-browser.log` |
| Focused non-browser | 19 files, 264/264 passed; final delta only changes the evidence gate | `remediation-v2-focused-non-browser-product-final.log` |
| Strict TypeScript | passed at `ed90a95` | `remediation-v2-typecheck-product-final.log` |
| Diff/forbidden/identity | 23 changed files, diff-check 0, forbidden paths 0, ancestry 0 | `remediation-v2-diff-forbidden-identity-final.log` |
| Full suite | deferred to post-semantic-integration final HEAD | not run by explicit speed-priority instruction |
| Production build | deferred to post-semantic-integration final HEAD | not run while Share/KOSHA matrices were active |

Runtime identity: Node `v24.12.0`, npm `11.6.2`, Next `15.5.20`, TypeScript `5.9.3`, Vitest `4.1.10`. `package.json` and `package-lock.json` are unchanged.

## Share semantic adoption contract

Share v2 baseline `22de1180d69263f7c08ac0ed0cfda0894e2db7f5` and request-scope remediation `7141baac3e0abca146ef6c110093c1c0643760a2` remain under review. Read-only reconciliation against Phase A reports these six content conflicts:

1. `app/api/workpacks/[id]/route.ts`
2. `components/FieldOperationsWorkspace.tsx`
3. `components/SafeGuardCommandCenter.tsx`
4. `lib/workpack-commercial-store.ts`
5. `tests/workpack-generation-evidence-route.test.ts`
6. `tests/workpack-share-authority-routes.test.ts`

Main must resolve those files only after both fresh reviews. Preserve Phase A server authority, `revision`, `updatedAt`, complete `evidenceSummary`, generation seal, and exact confirmation compare-and-set. Preserve Share's request-scope stale-response guard, `dispatchBinding`, and dispatch compare-and-set. Build one exact server-row snapshot; any row revision, evidence summary, confirmation, generation, request scope, or dispatch binding drift invalidates the joint authority and blocks connected export/session/dispatch.

## Gate

Verdict: `HOLD`. Fresh independent whole-series review is required. The final semantic integration HEAD must resolve the documented conflicts, rerun the combined full suite and production build, and regenerate both merge-tree identities before any readiness claim.
