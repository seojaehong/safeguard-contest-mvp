# Phase A ontology target-ready evidence

- Generated: `2026-07-14T04:08:25.4116596+09:00`
- Status: `HOLD_PENDING_FRESH_REVIEW`
- Branch: `fix/phase-a-ontology-target-ready`
- Authoritative integration target: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- Preserved source branch head: `fix/phase-a-ontology-review` at `9539f04896698f548bd01e33ff24ab70415bc68e`
- Product candidate: `35283baaf3aad4e14fa20da4df803b4cc3c046f2`
- Evidence artifact commit: a separate child bound to the product candidate; this report intentionally contains no self hash
- Main integration: not performed
- Launch readiness: `false`
- DB, schema, migration, data, seed, package, and lock files: unchanged

The report was generated after all fresh logs. The evidence artifacts are committed in the evidence-only child, so `outputArtifactsCommitted=true` in `report.json` is intentional.

## Construction

The branch was created exactly at `f98ae7d`. It was not produced by merging the old remediation branch. The 11 reviewed commits were cherry-picked in order:

| # | Reviewed commit | Target-ready commit | Subject |
|---:|---|---|---|
| 1 | `6be9a64201a4680753f2434f022bdca6f13424de` | `102ff66b67cc40ff16386c61a221d3815b142e1b` | `fix: remediate phase a ontology review` |
| 2 | `c0fa83f87ff1980742faf699895cc01f57b3a74c` | `d9cd92daff08b3a261fdeaa9293eeeb995bac089` | `fix: enforce ontology production evidence roles` |
| 3 | `36e26bd7100b934f44aa4931a03f8ce3cfa93957` | `7afd363d5288e05b582491e98a33eeda5d4b7398` | `fix: require exact ontology evidence citations` |
| 4 | `6f09d57e992d4867008bd83ed68cebffafa9dce9` | `1a16a3177bc10ea0861bfbd6d2e09b475068a3d1` | `fix: accept safe ontology citation punctuation` |
| 5 | `30bb0afbbf40fc29fea822622b93bd39e9e33b41` | `f4b07e4663758e20bca0c9b143da8b2f8680ab2a` | `fix: ground ontology generation with evidence pack` |
| 6 | `0b2b61f3fe095b32a55dadbf7c2eef4f3d045b99` | `835ff56a07b925270dcea215044d995f984a0cf2` | `fix: close ontology generation harness boundaries` |
| 7 | `42f39e5f8cfb47eed4b4b366cd004b65ccc3495d` | `d2f55c30dc643cc66adfa169755e5dd6db58bd08` | `fix: enforce phase a release hold gates` |
| 8 | `05a0e60c707e93bb4557e187959dea08c5b8a741` | `0b821fef29311d0cd9b265c7c7021f663b82390d` | `fix: close phase a integration review gates` |
| 9 | `c51c6c1f4e82b470885dad4884456ecc7395b4bb` | `a4134fea9fa81043db03083ac080f55df9715681` | `fix: close ontology authority leaks` |
| 10 | `a5ae9f74410ffe652205811135e9d28095419b48` | `017333f5fbbe79f064be25d0937db0896293905d` | `fix: require complete ontology materialization authority` |
| 11 | `9539f04896698f548bd01e33ff24ab70415bc68e` | `36eb8c7925b5826e1c7e88bba1dc0246cc46b8a2` | `fix: bind ontology authority to canonical evidence plans` |

There was one conflict, in `app/api/export/hwp/route.ts` while applying `9539f04`. The resolution preserved target `splitParagraph`, `nextParaIdx`, and `insertHwpTable`, while retaining the candidate title and pending markers: `공식자료 연결 후보 표 양식`, `법령 근거: 검토 필요`, and `공식자료 연결 후보`.

The narrow product remediation is one commit:

`35283baaf3aad4e14fa20da4df803b4cc3c046f2 fix: bind phase a authority and sanitize exports`

## Findings Closed

### Pending authority copy

Pending and review-required bodies now normalize authority claims on the document field or status context. This covers risk assessment, TBM, work plan, HWP/HWPX/PDF/XLSX, editor previews and downloads, public answers, and briefing copies.

The pending surface replaces `KOSHA 자료: 연결됨`, `조치가 연결됨`, `official`, `connected`, `mandated`, `verified`, and `공식자료 기반` authority claims with visible `검토 필요` or `공식자료 연결 후보` wording. The rule is not a blind prose replacement: the regression preserves the unrelated sentence `배관이 연결됨`, and raw editable submission text remains unchanged while preview/export copies are normalized.

An explicitly empty work-permit editor remains empty and does not regenerate permit sections. Its export contains only the mandatory pending authority marker rows.

### Export errors

HWP, HWPX, PDF, and XLSX failures return stable `{ ok, code, message }` payloads with `cache-control: no-store`. Server logs contain only `errorType` and `errorCode`. Tests inject candidate filesystem paths, internal messages, and secret-like values and prove they do not appear in the public response or logs.

### Human confirmation

The new confirmation route derives a typed reviewer principal from the authenticated workspace user and bearer session. Only the SHA-256 session fingerprint is persisted; the token is not. The server issues `confirmationId` and `confirmedAt`, and binds them to `workpackId`, `chainId`, `planDigest`, reviewer identity, and session fingerprint.

Only an exact retry with the same confirmation ID and all bindings is idempotent. A different ID, session, workpack, chain, or digest is rejected. Persisted review state is structurally parsed and rejects legacy client `reviewerId` fields, malformed IDs, and timestamps more than five minutes in the future. Reopened authority also requires the existing server generation-evidence HMAC and ownership checks.

No new DB table or migration was added. Consequently, there is no separate durable revocation/audit ledger for confirmations; the confirmation lives inside the existing workpack JSON and its HMAC-sealed response contract. This is the documented limitation.

### PDF integration

The integrated regression proves all of these together:

- visible pending marker and safe footer
- final risk row retained across pagination
- 작성자/검토/승인 signature line retained
- localized risk and verification enums
- current Noto Sans KR regular/bold embedding
- multipage numbering and current pagination

## Preserved Invariants

- Three canonical chains and aliases remain intact.
- Authority order remains `SIF -> KOSHA guidance -> current law validation`.
- SIF remains hazard priority only; KOSHA remains guidance; current law validates mandates.
- `naturalize_only`, exact materialization coverage, one request-scoped snapshot, four review states, 7 node kinds, and 7 edge relations remain unchanged.
- Current KOSHA counts remain 9 production documents, 13 local chunks, 5 active production documents, 4 review-only production documents, 8 active chunks, and 5 review-only chunks.
- KOSHA remains `launchReady=false`, `bodyMissingCount=1`, and production/local bridge `absent`; the draft gate was not promoted.
- Workspace empty-input and sidebar behavior, and HWP/HWPX/PDF/XLSX layouts/localization, remain covered.

## TDD Evidence

Representative RED observations before production changes:

| Scope | RED result |
|---|---:|
| Initial pending normalization | 2 files, 4 failed / 7 passed |
| Structured export/editor normalization | 2 files, 3 failed / 10 passed |
| Safe export errors | 2 files, 7 failed / 1 passed |
| HWP shared builder marker | 1 failed / 4 skipped |
| PDF safe source contract | 1 failed / 17 skipped |
| Extended authority phrase context | 2 failed / 3 passed |
| Pre-materialization confirmation removal | 1 failed / 96 passed |
| Integrated PDF semantics | 1 failed / 17 skipped |
| Combined empty-permit stale expectation | 28 files, 1 failed / 289 passed / 1 skipped |

The three new contract files contain 9 tests:

- `tests/export-error-contract.test.ts`
- `tests/phase-a-confirmation-route.test.ts`
- `tests/phase-a-server-confirmation.test.ts`

## Fresh Verification

All commands used `npm.cmd` and serial Vitest execution.

| Gate | Result | Artifact |
|---|---|---|
| Focused ontology/generation | 29 files, 360 passed | `focused-tests.log` |
| KOSHA/export/workspace/confirmation combined | 28 files, 290 passed, 1 skipped | `combined-tests.log` |
| Strict TypeScript | PASS, `tsc --noEmit --incremental false` | `typecheck.log` |
| Frontend route probe | 36 passed, 1 expected stale `sourceIdentity` RED at line 693 | `frontend-route-probe.log` |
| `git diff --check` | PASS | recorded in this report |

The exact test commands and full file lists are in `report.json`. The frontend route probe remains intentionally honest; it is the only RED and is not counted as a product failure for this candidate.

## Changed Files

The product remediation commit changes 28 files:

```text
app/api/export/hwp/route.ts
app/api/export/hwpx-template/route.ts
app/api/export/pdf/route.ts
app/api/export/xlsx/route.ts
app/api/workpacks/[id]/phase-a-confirmation/route.ts
components/WorkpackEditor.tsx
lib/export-error.ts
lib/hwp-table-builder.ts
lib/ontology/evidence-chain.ts
lib/phase-a-confirmation.ts
lib/phase-a-review.ts
lib/search.ts
lib/types.ts
tests/answer-panel-display.test.ts
tests/document-export-localization.test.ts
tests/documents-editor-layout.test.ts
tests/export-error-contract.test.ts
tests/generation-trace-privacy.test.ts
tests/ontology-evidence-chains.test.ts
tests/pdf-font-failure.test.ts
tests/pdf-korean-font-integration.test.ts
tests/phase-a-citation-authority.test.ts
tests/phase-a-confirmation-route.test.ts
tests/phase-a-document-authority.test.ts
tests/phase-a-server-confirmation.test.ts
tests/quality-contract.test.ts
tests/workpack-readiness.test.ts
tests/workpack-store.test.ts
```

At the product candidate, `f98ae7d..35283ba` contains 78 changed files. `02295b5..35283ba` contains 141 changed files. The exact 78-file target list is in `report.json`.

The evidence-only child changes six artifacts:

```text
evaluation/phase-a-ontology-evidence-chains-2026-07-13/combined-tests.log
evaluation/phase-a-ontology-evidence-chains-2026-07-13/focused-tests.log
evaluation/phase-a-ontology-evidence-chains-2026-07-13/frontend-route-probe.log
evaluation/phase-a-ontology-evidence-chains-2026-07-13/report.json
evaluation/phase-a-ontology-evidence-chains-2026-07-13/report.md
evaluation/phase-a-ontology-evidence-chains-2026-07-13/typecheck.log
```

## Gate

This is not an integration completion claim. The branch remains `HOLD_PENDING_FRESH_REVIEW` and must receive a new independent review before selective integration into main.
