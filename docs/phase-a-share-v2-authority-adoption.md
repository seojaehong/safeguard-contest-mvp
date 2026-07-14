# Phase A and Share v2 authority adoption plan

## Status

- Phase A remediation and Share v2 remain separate review units.
- Share v2 review baseline `22de1180d69263f7c08ac0ed0cfda0894e2db7f5` (base product `fc2bd1783fcc413981306f689d67bb6c659a985e`) now has request-scope remediation product `7141baac3e0abca146ef6c110093c1c0643760a2`. Both series still require fresh review. This branch does not merge, cherry-pick, or claim semantic integration with either head.
- During remediation the moving integration authority advanced beyond `62128cf196329a4dcd6b9c2ffe4a92e40464db15` and `3a74107e3d8363f437815b877533f7342fd02c45`; both descend from the reviewed floor `67d2c9e28e7278c58f46b46c2512c7133d88d1d3`. Product and evidence commits must resolve and bind the exact current ref again after rebase instead of treating either observed SHA as final.

## Joint contract

`lib/phase-a-share-authority-contract.ts` is the typed handoff boundary. A joint authority is ready only when all of these values describe the same server state:

The exported baseline review, base product, remediation product, and six-path conflict constants bind this contract to the exact Share evidence reviewed here. A later Share head requires a fresh contract diff before adoption.

- Phase A: `workpackId`, exact server `revision`, current generation seal, and the full exact confirmation (`confirmationId`, `confirmedAt`, reviewer principal, `chainId`, and `planDigest`).
- Share v2 workpack context: `updatedAt` and the complete `evidenceSummary` object.
- Share v2 dispatch context: validated `dispatchBinding` and `canonicalWorkpackRevision`.
- The Phase A revision must equal Share v2 `updatedAt`. The generation seal and exact confirmation persisted in `evidenceSummary` must equal the Phase A values.
- The dispatch binding must name the same workpack and canonical revision. A Share v2 binding-validation failure is propagated as a closed authority gate.

Share v2 remains responsible for cryptographic validation of `dispatchBinding` through its reviewed `validateShareDispatchBinding` implementation. The joint contract consumes that typed validation result; it does not replace or fork the Share validator.

## Conflict adoption

User-supplied read-only `git merge-tree --write-tree` reconciliation between Phase A product checkpoint `1f9784f4087e240b009c232868e5cd387a55dd48` and Share remediation product `7141baac3e0abca146ef6c110093c1c0643760a2` reports exactly six content-conflict paths. The evidence child binds the final Phase A product HEAD and repeats this check. After both series receive independent approval, main must create a new integration branch from the then-current reviewed authority and adopt these paths manually. Do not choose either side wholesale:

| Path | Phase A behavior to preserve | Share v2 behavior to preserve |
| --- | --- | --- |
| `app/api/workpacks/[id]/route.ts` | scoped row revalidation, HMAC generation seal verification, exact row revision authority, fail-closed reopen | canonical localization revision and reviewed-envelope projection |
| `lib/workpack-commercial-store.ts` | `revision`, `createdBy`, authenticated scope binding, exact Phase A confirmation gate | `updatedAt`, complete `evidenceSummary`, parsed `dispatchBinding` |
| `components/FieldOperationsWorkspace.tsx` | request epochs, aborts, post-response binding checks, exact save/confirmation authority | authenticated Share authority loading and recipient/locale binding |
| `components/SafeGuardCommandCenter.tsx` | generation/revalidation epochs, local-only restore, exact server authority state | Share step URL restoration, document/language return navigation, stale recovery |
| `tests/workpack-generation-evidence-route.test.ts` | deterministic creator-generation identity, PK collision fail-close, exact row authority | reviewed localization envelope and canonical revision route coverage |
| `tests/workpack-share-authority-routes.test.ts` | exact Phase A row confirmation and revision authority must block stale/mismatched rows | dispatch binding validation and compare-and-set must prevent duplicate or stale provider outcomes |

The following non-overlapping files still require semantic composition in the adoption commit: `app/api/workpacks/route.ts` and `lib/workpack-store.ts` must preserve `reviewedLocalizationEnvelopes` while adding the Phase A idempotency binding; `lib/reporting-downloads.ts` must retain local-only labeling while projecting only approved localization evidence. Share remediation files `components/WorkflowSharePanel.tsx` and `components/WorkflowSharePolicy.ts` must retain `buildWorkflowShareRequestScopeKey`, request AbortController ownership, and scope-key checks before applying session, channel, dispatch, or log outcomes.

`app/api/workpacks/[id]/phase-a-confirmation/route.ts` is Phase A-owned. Its revision compare-and-set, exact confirmation, preserved authority binding, and response authority must survive adoption even when it is not a textual conflict.

## Required adoption sequence

1. Rebase the adoption branch on the current reviewed integration authority (`67d2c9e` or later) and record the exact ancestry check.
2. Bring in the independently approved Phase A and Share v2 heads without running a semantic merge from an unreviewed Share commit.
3. Resolve the paths above by composing their contracts. Preserve KOSHA integrity-blocked aggregation, verified-current technical guidance, `naturalize_only`, and exact `PhaseAGenerationGrounding` unchanged.
4. Build one server row snapshot that preserves Phase A `revision`, `updatedAt`, complete `evidenceSummary`, generation seal, authority binding, and exact confirmation together with Share `canonicalWorkpackRevision` and `dispatchBinding`. Never project either authority from a different read.
5. In the Share authority loader, first validate the current workpack row and Share dispatch binding with the accepted Share v2 validators, then call `assessPhaseAShareJointAuthority`.
6. If localization review changes `workpacks.evidence_summary` and therefore `workpacks.updated_at`, discard the prior Phase A authority, abort the prior Share request scope, refetch the exact row, verify the generation seal and confirmation again, and rebuild the joint authority. Never rewrite the old revision in the browser.
7. Preserve Share's request-scope stale-response guard for authority load, channel resolution, session creation, dispatch, and dispatch-log persistence. Every result must match the current scope key after its response before UI or evidence state changes.
8. Preserve dispatch compare-and-set in `app/api/workflow/dispatch/route.ts`: validate the exact `dispatchBinding`, update the active session only at its current `updated_at`, and fail closed on a concurrent revision instead of replaying a provider request.
9. Block session creation, dispatch, connected export, and authority labels whenever the joint contract is not ready.
10. Run Phase A request-race, create/reopen, reload/export, confirmation, and ontology tests together with the accepted Share v2 unit and browser matrices. Recompute both current-main and Share merge trees against the then-current heads before adoption.

## Non-goals

- No database schema, migration, or data change.
- No final `WorkflowSharePanel` semantic merge in this series.
- No current-main merge is performed in this series; the observed `8149c107118a54692ec53a56109c51f055b6710f` reconciliation remains HOLD on `tests/reports-download-center.test.ts`.
- No browser-local value can satisfy the server authority contract.
- No read-before-insert or local-storage hash is treated as cross-tab or cross-device uniqueness.
