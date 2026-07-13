# Phase A KOSHA reviewed OCR bridge HOLD remediation

- Status: **HOLD_PENDING_FRESH_REVIEW**
- Launch readiness: **false**
- DB/Supabase/API/schema/migration mutation: **false**
- Production GET performed: **false**

## Fixed snapshot truth

The fixed generator rebuilt the offline corpus from the local ZIP source in 1,929.811 seconds. A zero-work resume validation completed in 2.950 seconds with `processed_this_run=0`.

| Measure | Actual |
|---|---:|
| Inventory / completed | 1,040 / 1,040 |
| Native successes | 1,039 |
| OCR boundaries / hard failures | 1 / 0 |
| Failure-ledger rows | 1 |
| Chunks | 20,520 |
| Reviewed OCR imports | 0 |

The fixed identities all recompute exactly:

| Identity | SHA-256 |
|---|---|
| Source | `1db732ff3843adc12f1aa42130b82c45f4fe3497229aecd41b9be6a12fe5bc3d` |
| Generation policy | `54840fedece9d4b347ad7fd88808866f7ca1b41c5a08b9c6ca47b284c9411b1f` |
| Snapshot | `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282` |
| Manifest | `702202bf50155f083006155700735b6ea262932ed66117f2cd0d4795c6937519` |

The fixed `items.jsonl`, `chunks.jsonl`, and `failures.jsonl` hashes match the prior bytes. `checkpoint.json` changed because the fixed source and policy identities are now bound into a newly generated checkpoint; no hash constant was overwritten.

## Stale snapshot finding

The prior artifact declared source `6d13d26f...`, but its parsed manifest material recomputes to `419fd79e...`. Keeping the prior declared policy while replacing only that source identity produces the reviewer-observed snapshot `18b4b4e0...`.

Applying the same semantic canonicalization to policy as well yields policy `8e41acbf...` and full stale-artifact snapshot `f2f1991f...`. The fixed generator therefore rebuilt source, policy, checkpoint, manifest, and current pointer together instead of patching the intermediate `18b4b4e0...` value.

## P1 smoke order

| Case | First terminal code | Credential check | GET | Elapsed |
|---|---|---:|---:|---:|
| Stale snapshot + missing credential | `kosha-bridge-manifest-source-identity-mismatch` | no | no | 14.892s |
| Fixed snapshot + missing credential | `supabase-read-credentials-unavailable` | yes | no | 13.538s |

Neither failed run records `snapshotIntegrityVerifiedBeforeFetch=true`. That field is emitted only after a successful GET and bridge artifact build; no successful production run is claimed here.

## Candidate and multiplicity

The unchanged B-E-3 candidate is still `draft`, `human_confirmed=false`, and rejected with `ocr_candidate_not_human_confirmed`. Its exact file/content/attestation hashes remain unchanged. The fixed corpus item remains `boundary`, with no body, zero chunks, and zero imports. The candidate also has no source `render_dpi`; it was not edited or promoted.

Snapshot import now permits reviewed candidates for distinct item IDs. It fails closed on two candidates for the same item and on a duplicate canonical attestation. Tests cover the two-item success and both collision paths.

## Privacy

Audit failures now serialize only `fatal_type` and `fatal_code`, never a stack. Fourteen evaluation logs were scanned with zero absolute local path matches and zero raw secret/HMAC matches.

## Verification

| Check | Passed | Failed | Elapsed |
|---|---:|---:|---:|
| Focused Python | 64 | 0 | 11.827s |
| Focused TypeScript | 106 | 0 | 43.920s |
| Ontology evidence regression | 45 | 0 | 5.125s command wall |
| Strict TypeScript typecheck | yes | no | 32.602s command wall |
| `git diff --check` | yes | no | n/a |

Final automated test total: **215 passed, 0 failed**. RED evidence remains separate: Python 4/4 expected failures and TypeScript 5 expected failures out of 91 tests before implementation.

## Remaining hold

- Fresh independent review is required. No integration approval is claimed.
- B-E-3 remains unconfirmed and unimported.
- One OCR boundary remains, so `launchReadiness=false`.
- No production GET or deployment identity was established.
- `dbMutationPerformed=false` remains unchanged.
