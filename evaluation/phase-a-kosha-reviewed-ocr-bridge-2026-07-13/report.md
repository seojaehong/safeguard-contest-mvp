# Phase A KOSHA reviewed OCR bridge

- Status: **VERIFIED_WITH_LAUNCH_BLOCKERS**
- Launch readiness: **false**
- Read-only: **true**
- DB/Supabase mutation performed: **false**
- Migration performed: **false**

## Source and candidate

The current local corpus remains 1,040 items with 1,039 native successes, one OCR boundary, 20,520 chunks, and one failure-ledger row. The source report is `evaluation/kosha-corpus-body-recovery-2026-07-12-v3/report.json`.

The unchanged B-E-3 candidate is still `draft`, `human_confirmed=false`, and rejected with `ocr_candidate_not_human_confirmed`. Its file SHA-256 is `5d06ba7a04329e32e8fafb30b9311f6fb2ea70e248dfcb706aaa883e3632753b`; its canonical immutable-content SHA-256 is `e18c2ae92e938f564c5dff20f9c90fb76170bf27122ec71c9f03f5531719577e`.

The checked file currently contains generator provenance and `render_dpi=180`; validation stops earlier at the human-confirmation gate. No candidate bytes were edited, attested, imported, or copied into the corpus.

## Implemented contract

- A snapshot run accepts at most one declared reviewed candidate and overlays only its exact native-empty boundary item.
- Candidate file identity, validated content SHA-256, and attestation SHA-256 are part of generation and resume policy.
- Corpus records preserve `body_origin=human-reviewed-ocr` and reviewed candidate/page provenance.
- Runtime reviewed OCR is searchable only as `bodyKind=unknown`, `quality=review_required`, `directEligible=false`, and `evidenceRef=null`.
- The production/local bridge matches only `payload.zipFile + payload.internalPath` to `source_zip + source_member` and explicitly uses GET.
- Bridge construction rechecks snapshot, item body, chunk text, raw-source binding, and candidate content hashes. Output remains `humanConfirmation=pending`, `dbMutationPerformed=false`, and `launchReadiness=false`.

## Verification

| Check | Passed | Failed | Elapsed |
|---|---:|---:|---:|
| Focused Python | 61 | 0 | 10.946s |
| Focused TypeScript | 86 | 0 | 20.010s |
| Ontology evidence regression | 45 | 0 | 1.520s |
| Strict TypeScript typecheck | yes | no | 22.654s |
| `git diff --cached --check` | yes | no | n/a |

Final automated test total: **192 passed, 0 failed**. Test elapsed time was 32.476s; tests plus strict typecheck took 55.130s before the final diff check.

RED evidence is preserved in `red-python.log` and `red-typescript.log`: the new contracts initially produced three Python and six TypeScript failures before implementation.

## Remaining blockers

- B-E-3 has no trusted human confirmation or valid review attestation for import.
- The local corpus still has one body boundary and no B-E-3 chunks.
- No DB write, migration, upload, or production mutation was performed.
- This result must not be interpreted as corpus or product launch readiness.
