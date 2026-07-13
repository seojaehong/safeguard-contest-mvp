# Phase A ontology target-ready evidence

- Generated: `2026-07-14T05:56:43.9740702+09:00`
- Status: `HOLD_PENDING_FRESH_REVIEW`
- Branch: `fix/phase-a-ontology-target-ready`
- Original Phase A base: `02295b5a7d2b068eb5ea560f4cc9a34392fd7c21`
- Authoritative integration target: `f98ae7d16746dfe9fedbeea892e5af7ebb56f9a5`
- Preserved reviewed source: `9539f04896698f548bd01e33ff24ab70415bc68e`
- Rejected product/evidence pair: `35283baaf3aad4e14fa20da4df803b4cc3c046f2` / `f613f5d73118bb81e6199a5ff057e850b3859692`
- Product parent: `f613f5d73118bb81e6199a5ff057e850b3859692`
- Product candidate: `31767959b5904afbab77ab5ee36f24da6d15b1c8`
- Product tree: `5d52b3bc22ebb49909110773e2c2d5b88b5401c6`
- Main integration: not performed
- Launch readiness: `false`
- DB, schema, migration, data, seed, package, and lock files: unchanged

The report and logs are committed only in the evidence child. The evidence commit cannot truthfully contain its own Git hash. A fresh reviewer or PR must bind that child SHA externally. `evidence-manifest.json` instead binds the exact product parent, product tree, commands, counts, and Git blob IDs, and can be checked from the evidence commit with Git.

## Construction

The target-ready branch remains based on `f98ae7d`. It retains the previously reviewed 11-commit mapping and the documented `9539f04` HWP conflict resolution: target `splitParagraph`, `nextParaIdx`, and `insertHwpTable` behavior plus the candidate pending marker/title were preserved. This remediation is one narrow product commit:

`31767959b5904afbab77ab5ee36f24da6d15b1c8 fix: restore phase a export and confirmation contracts`

## Findings Closed

### PDF failure contract

Only typed font asset/read/embed/subset failures are converted to the controlled `PDF_FONT_ASSET_UNAVAILABLE` 500 response. Generic `PDFDocument.create`, page/content construction, and `pdf.save` failures are logged with only `errorType` and internal `errorCode`, then the original error object is rethrown. They are never returned as a misleading `PDF_EXPORT_FAILED` JSON payload.

The regression injects distinct create, page, save, and embed failures. It proves that generic errors preserve object identity on rejection, font embed failures use the font code, and neither public output nor structured logs expose candidate paths or secret-like text.

### Atomic confirmation persistence

The confirmation route now reads the existing workpack `updated_at` revision and performs a single conditional update over workpack ID, organization ID, and that exact revision. A zero-row update is an explicit revision conflict, not success. The route then reloads the owned workpack, verifies the server generation-evidence HMAC, and validates the exact reviewer/workpack/chain/plan binding before returning the stored server-issued confirmation ID in a 409. Retrying with that ID is idempotent and performs no second write.

The concurrent regression starts two first confirmations from the same pending revision, evidence fingerprint, and authenticated reviewer. Exactly one returns 200 and persists; the other returns 409 with the winner's ID; the bound retry returns 200 with the same ID. No process-local mutex or client-owned actor, timestamp, or ID is used.

No schema or confirmation table was added. Multi-instance safety relies on PostgreSQL/PostgREST conditional update atomicity and on all workpack writers advancing the existing `updated_at` revision. There is still no separate durable revocation/audit ledger; confirmation remains in existing workpack JSON protected by ownership checks and the generation-evidence HMAC.

## Preserved Invariants

- Authority order remains `SIF -> KOSHA guidance -> current law validation`.
- SIF remains hazard priority only; KOSHA remains guidance; current law validates mandates.
- Three chains/aliases, `naturalize_only`, full materialization coverage, one request-scoped snapshot, four review states, 7 node kinds, and 7 edge relations remain intact.
- KOSHA counts and draft gate, workspace empty-input/sidebar behavior, and HWP/HWPX/PDF/XLSX localization/layout remain unchanged.
- Pending authority markers, HWP conflict resolution, PDF pagination/font/signature/risk-row behavior, and privacy boundaries remain covered.

## TDD Evidence

The initial RED was captured before production edits against parent `f613f5d`: 3 files, 4 failed, 21 passed. Failures covered generic PDF swallowing, embed misclassification, the stale public PDF payload source contract, and two concurrent 200 confirmations. See `remediation-red.log`.

Final product-tree verification:

| Gate | Result | Artifact |
|---|---|---|
| New remediation tests | 3 files, 25 passed | `remediation-green.log` |
| Prior contract set | 8 files, 143 passed | `prior-contract-tests.log` |
| Focused ontology/generation | 29 files, 360 passed | `focused-tests.log` |
| KOSHA/export/workspace/confirmation | 28 files, 291 passed, 1 skipped | `combined-tests.log` |
| Strict TypeScript | PASS, `tsc --noEmit --incremental false` | `typecheck.log` |
| Frontend route probe | 36 passed, 1 stale `sourceIdentity` RED at line 693 | `frontend-route-probe.log` |
| `git diff --check` | PASS | `diff-check.log` |

One earlier combined attempt had a 30-second visibility timeout in the unrelated non-streaming workspace progress test. That exact test passed alone, and the final full product-tree combined run passed 291 with one existing skip. The final passing combined log is the committed artifact.

The exact serial commands are recorded in `report.json` and `evidence-manifest.json`.

## Changed Files

The product commit changes exactly six files:

```text
app/api/export/pdf/route.ts
app/api/workpacks/[id]/phase-a-confirmation/route.ts
lib/workpack-commercial-store.ts
tests/pdf-font-failure.test.ts
tests/pdf-korean-font-integration.test.ts
tests/phase-a-confirmation-route.test.ts
```

At the product candidate, `f98ae7d..3176795` contains 81 changed files and `02295b5..3176795` contains 144 changed files. These counts include inherited target-ready product and evidence history; this remediation product commit itself remains six files.

## Gate

This is not an integration completion claim. The branch remains `HOLD_PENDING_FRESH_REVIEW` pending another independent whole-candidate review.
