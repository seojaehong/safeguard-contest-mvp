# Phase A Ontology Fresh Review V3 Findings

## Bound source

- Review/evidence HEAD: `6f355ea9d357b52cf44972861446b683660b7a14`
- Product HEAD: `5dba6964e2e2089683a926a39edb1bb8896aa99d`
- Main integration target: `920c7f360688352156de4854b4957a9f2f1f0e43`
- Share product reviewed in this round: `3162b4fe5e7ea32f139ff66bffa7835b14e29bd4`
- Verdict: `HOLD`, SPEC FAIL, CODE QUALITY FAIL

## Required remediation

1. **P1 - Share handoff contract drift**
   - `lib/phase-a-share-authority-contract.ts` still binds `7141baac...` and six conflicts.
   - The reviewed Share target is `3162b4fe...` and the independent merge tree has seven conflicts.
   - Update the contract only to the next freshly reviewed Share remediation product HEAD. Do not bind to the rejected `3162b4f` if Share advances during this task.
   - Tests must derive and verify the exact target, conflict paths, and merge tree instead of preserving a stale green constant.

2. **P1 - Missing authenticated workspace scope fails open**
   - `SafeGuardCommandCenter.tsx` posts `{ data }` to `/api/workpacks` without `workspaceScope`.
   - `resolveAuthenticatedWorkspaceContext` falls back to `ensureWorkspaceContext` when scope is absent, which may create organization/site rows from scenario names.
   - The save path must use an explicit organization/site selection owned by the authenticated user. Missing, foreign, partial, or stale scope must fail closed without creating rows.
   - Do not change DB schema/data or migrations. Do not weaken existing authenticated scope checks used by other routes.
   - Tests must exercise the real resolver/call boundary; resolver-wide mocks are insufficient.

3. **P1 - Local revalidation is not bound to the current authenticated principal**
   - The current request binding is only `workpackId:generationFingerprint`.
   - Logout/account switch must invalidate or abort the request. A late response issued under an old bearer token must never commit server data, localStorage, saved authority, or share readiness.
   - Add a real browser/request-lifecycle attack test for logout/account switch plus an ignored abort response.

4. **P2 - Edited local draft persists the pre-edit generation fingerprint**
   - Deliverable edits clear authority but retain the original `generationFingerprint` in persisted local storage.
   - On every content-changing edit, derive a fingerprint from the current edited payload or explicitly store an unverified draft binding that cannot select old worker/dispatch snapshots.
   - Reload must remain `requiresRevalidation=true`; old server authority, worker snapshot, and dispatch snapshot must not be reusable.

## Invariants to preserve

- Connected export performs exact-row click-time revalidation using RFC3339 `workpacks.updated_at` plus generation seal.
- Confirmation summary preserves unknown/raw `evidence_summary` subtrees and overlays only Phase A-owned fields.
- SHA-256 canonical content revision and RFC3339 server CAS revision remain distinct.
- SIF -> KOSHA Guide -> law grounding, obligation/guidance classification, provenance/materialization, OpenClaw context, and human confirmation stay intact.
- No DB/schema/migration/package/lockfile changes. Strict TypeScript; no explicit `any`; no silent failures.

## TDD and evidence gates

- Commit intentional RED tests before production changes and preserve their logs.
- Product fix in a separate commit, then focused GREEN and integration/evidence commit.
- Required focused coverage: real workpack scope resolver/call boundary; auth-principal-switch late response; edited draft fingerprint reload; Share target/merge contract; existing connected export; confirmation overlay; 19-file Phase A suite; browser suite; strict typecheck; diff-check; scope/no-any checks.
- Recompute merge trees against the current main target and the freshly reviewed Share product target. Do not use rejected or stale Share SHAs.
- Final independent reviewer must report findings first, exact commands/counts, commit ancestry, and SPEC/CODE verdict.

