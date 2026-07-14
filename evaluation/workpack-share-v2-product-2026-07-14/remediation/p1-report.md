# Share v2 P1 remediation evidence

Status: **HOLD - fresh independent Share and ontology reviews required**

## Source identity

- Historical exact base: `f45bba17bcce0d8ebb2690f82d014dbe42ae8191`
- Request-scope product: `7141baac3e0abca146ef6c110093c1c0643760a2`
- Final Share product and harness: `3162b4fe5e7ea32f139ff66bffa7835b14e29bd4`
- Final product tree: `7caa7de486db7e53e5b15fa5c18234360908594a`
- Authoritative main: `920c7f360688352156de4854b4957a9f2f1f0e43`
- Ontology product: `ed90a95dad3a28d6171758c52ac03acba83733fd`
- Ontology evidence: `2aa8aa9136a344671d50d8a815c33df8aeb40178`

The closed-schema source-binding manifest is
`evaluation/workpack-share-v2-product-2026-07-14/remediation/source-binding-manifest.json`.
The validator rejects missing, stale, wrong, or unknown product/main/ontology references.

## P1 request-scope guard

`sendCurrentPack` now binds each asynchronous request to the initiating workpack,
target, channel, authority, memo, and request version. Session and dispatch results
are applied only while that identity remains current. Stale accepted, partial,
failed, session, provider, and log outcomes cannot update a changed scope.

The actual component/browser path covers target, workpack, and channel changes while
session or dispatch requests are in flight. The original RED observed one dispatch
after a target change where zero was required. The final matrix records four scope
race checks in `day-desktop:sending:normal_100`.

## Harness hang remediation

The first full matrix printed 130 assertions passed but left pwsh, Vitest, worker,
and Next harness processes alive. It is preserved as
`p1-final-browser.log` with evidence exit `124` and is not counted as PASS.

The RED integration test proved that Windows `taskkill` failure was silently ignored.
The harness now validates taskkill status/error and waits for the child `close` event.
The same scope-race scenario then completed twice under 180-second wall-clock bounds,
each with exit `0` and zero remaining Share processes. The final bounded matrix used
a 1,800-second wall-clock timeout and also ended with zero remaining processes.

## Verification

| Gate | Result |
| --- | --- |
| Share unit/route | 23 files, 232 passed, 128 skipped, exit 0 |
| TypeScript strict typecheck | exit 0 |
| Next build | 15.5.20, 27/27 static pages, exit 0 |
| Static audit | violations 0, coverage issues 0, important declarations 0 |
| Browser runner | 130/130 passed, 1256.07 seconds, bounded exit 0 |
| Browser census | 128/128 rows, 64 exact 390x844 rows, legacy 391 rows 0 |
| Root text scaling | 64 rows, root mutation max 1, descendant/leaf mutation 0 |
| Layout | horizontal/panel overflow, overlap, nested scroll, clipping failures all 0 |
| Evidence validator | 38/38, including 37 fail-closed attacks, exit 0 |

The product commit and every browser row are bound to the exact product commit, tree,
and browser-test blob. Browser/build/typecheck/static logs carry the same product SHA.

## Generated output exclusion

The run modified one historical static-audit JSON and 16 historical module-shell PNGs.
All 17 are classified as `scope-excluded generated changes`, restored to their exact
parent/head blobs, and excluded from both product and evidence commits. The historical
Share `logs/browser-metrics.json` was also restored; the admissible current metrics are
stored separately as `p1-browser-metrics.json`.

The final product remediation consists of seven files across two product commits. The
separate evidence commit stages 40 Share remediation/test files; the staged secret scan
checks 39 files after excluding only its own recursively changing JSON and reports zero
matches and zero prohibited paths.

## Integration HOLD

Main `920c7f3` versus final Share `3162b4f` is mechanically clean: exit `0`, result
tree `0685b69a45c47b5c9545e0969b8ceaeb18122aae`, path overlap `0`.

Ontology `ed90a95` versus final Share `3162b4f` is blocked: exit `1`, result tree
`7fe39999ffa8828ee0c202ef30da36641afc6e05`, with these seven content conflicts:

1. `app/api/workpacks/[id]/route.ts`
2. `components/FieldOperationsWorkspace.tsx`
3. `components/SafeGuardCommandCenter.tsx`
4. `lib/workpack-commercial-store.ts`
5. `tests/helpers/isolated-next-browser-harness.ts`
6. `tests/workpack-generation-evidence-route.test.ts`
7. `tests/workpack-share-authority-routes.test.ts`

Integration must keep Share `canonicalWorkpackRevision` as a SHA-256 content hash
distinct from ontology `revision`/`updatedAt`, which remain the RFC3339
`workpacks.updated_at` confirmation CAS token. It must preserve the full raw
`evidence_summary` while overlaying canonical confirmation fields, retain unknown
`reviewedLocalizationEnvelopes`/dispatch/localization keys, and revalidate stale
envelopes. A localization review that updates `workpacks.updated_at` invalidates
Phase A authority and the Share request scope until the authenticated row is reread.

The final merge must also retain `initialWorkpackId`, `initialWorkpackAuthority`,
`requiresRevalidation`, theme, validated Share URL state, Share request-scope guards,
dispatch CAS, and both sides of browser harness teardown. No cross-worktree integration
was attempted. Main may adopt only after both fresh reviews and semantic conflict
resolution, followed by combined gates on the integrated tree.
