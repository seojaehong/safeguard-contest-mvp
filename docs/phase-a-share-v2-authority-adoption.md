# Phase A and Share v2 authority adoption plan

## Status

- Phase A remediation and Share v2 remain separate review units.
- Share v2 review head `22de1180d69263f7c08ac0ed0cfda0894e2db7f5` (product parent `fc2bd1783fcc413981306f689d67bb6c659a985e`) is still under review. This branch does not merge, cherry-pick, or claim semantic integration with it.
- During remediation the moving integration authority advanced beyond `62128cf196329a4dcd6b9c2ffe4a92e40464db15` and `3a74107e3d8363f437815b877533f7342fd02c45`; both descend from the reviewed floor `67d2c9e28e7278c58f46b46c2512c7133d88d1d3`. Product and evidence commits must resolve and bind the exact current ref again after rebase instead of treating either observed SHA as final.

## Joint contract

`lib/phase-a-share-authority-contract.ts` is the typed handoff boundary. A joint authority is ready only when all of these values describe the same server state:

The exported review/product head constants bind this contract to the exact Share evidence reviewed here. A later Share head requires a fresh contract diff before adoption.

- Phase A: `workpackId`, exact server `revision`, current generation seal, and the full exact confirmation (`confirmationId`, `confirmedAt`, reviewer principal, `chainId`, and `planDigest`).
- Share v2 workpack context: `updatedAt` and the complete `evidenceSummary` object.
- Share v2 dispatch context: validated `dispatchBinding` and `canonicalWorkpackRevision`.
- The Phase A revision must equal Share v2 `updatedAt`. The generation seal and exact confirmation persisted in `evidenceSummary` must equal the Phase A values.
- The dispatch binding must name the same workpack and canonical revision. A Share v2 binding-validation failure is propagated as a closed authority gate.

Share v2 remains responsible for cryptographic validation of `dispatchBinding` through its reviewed `validateShareDispatchBinding` implementation. The joint contract consumes that typed validation result; it does not replace or fork the Share validator.

## Conflict adoption

Against the Share product series `f45bba17bcce0d8ebb2690f82d014dbe42ae8191..fc2bd1783fcc413981306f689d67bb6c659a985e`, the Phase A remediation dirty tree has exactly five overlapping product paths. After both series receive independent approval, create a new integration branch from the then-current reviewed authority and adopt these paths manually. Do not choose either side wholesale:

| Path | Phase A behavior to preserve | Share v2 behavior to preserve |
| --- | --- | --- |
| `app/api/workpacks/[id]/route.ts` | scoped row revalidation, HMAC generation seal verification, exact row revision authority, fail-closed reopen | canonical localization revision and reviewed-envelope projection |
| `lib/workpack-commercial-store.ts` | `revision`, `createdBy`, authenticated scope binding, exact Phase A confirmation gate | `updatedAt`, complete `evidenceSummary`, parsed `dispatchBinding` |
| `components/FieldOperationsWorkspace.tsx` | request epochs, aborts, post-response binding checks, exact save/confirmation authority | authenticated Share authority loading and recipient/locale binding |
| `components/SafeGuardCommandCenter.tsx` | generation/revalidation epochs, local-only restore, exact server authority state | Share step URL restoration, document/language return navigation, stale recovery |
| `tests/workpack-generation-evidence-route.test.ts` | deterministic creator-generation identity, PK collision fail-close, exact row authority | reviewed localization envelope and canonical revision route coverage |

The following non-overlapping files still require semantic composition in the adoption commit: `app/api/workpacks/route.ts` and `lib/workpack-store.ts` must preserve `reviewedLocalizationEnvelopes` while adding the Phase A idempotency binding; `lib/reporting-downloads.ts` must retain local-only labeling while projecting only approved localization evidence; Share route/panel files must consume the joint authority before session creation or dispatch.

`app/api/workpacks/[id]/phase-a-confirmation/route.ts` is Phase A-owned. Its revision compare-and-set, exact confirmation, preserved authority binding, and response authority must survive adoption even when it is not a textual conflict.

## Required adoption sequence

1. Rebase the adoption branch on the current reviewed integration authority (`67d2c9e` or later) and record the exact ancestry check.
2. Bring in the independently approved Phase A and Share v2 heads without running a semantic merge from an unreviewed Share commit.
3. Resolve the paths above by composing their contracts. Preserve KOSHA integrity-blocked aggregation, verified-current technical guidance, `naturalize_only`, and exact `PhaseAGenerationGrounding` unchanged.
4. In the Share authority loader, first validate the current workpack row and Share dispatch binding with the accepted Share v2 validators, then call `assessPhaseAShareJointAuthority`.
5. If localization review changes `workpacks.evidence_summary` and therefore `workpacks.updated_at`, discard the prior Phase A authority, refetch the exact row, verify the generation seal and confirmation again, and rebuild the joint authority. Never rewrite the old revision in the browser.
6. Block session creation, dispatch, connected export, and authority labels whenever the joint contract is not ready.
7. Run Phase A request-race, create/reopen, reload/export, confirmation, and ontology tests together with the accepted Share v2 unit and browser matrices. Recompute the merge tree and evidence manifest against the then-current authority head.

## Non-goals

- No database schema, migration, or data change.
- No final `WorkflowSharePanel` semantic merge in this series.
- No browser-local value can satisfy the server authority contract.
- No read-before-insert or local-storage hash is treated as cross-tab or cross-device uniqueness.
