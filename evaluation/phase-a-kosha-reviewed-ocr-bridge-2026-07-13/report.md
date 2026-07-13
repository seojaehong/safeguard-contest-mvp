# Phase A KOSHA reviewed OCR bridge HOLD remediation

- Status: **HOLD_PENDING_FRESH_REVIEW**
- Launch readiness: **false**
- DB/Supabase/API/schema/migration mutation: **false**
- Production GET performed: **false**

## Selective integration scope

The branch merge-base against `feat/phase-a-release-integration-v2` is `02295b5`. At reviewed head `3ed9be8`, the branch delta from that base is 15 commits and 42 files. Twelve of those commits are unrelated OAuth/RLS/XLSX ancestors through `d3ad865`; integration target `77d8641` already contains that ancestor tip.

Do not merge this branch wholesale. The selective KOSHA candidate is exactly:

```text
git cherry-pick 38cbc91 8e3b424 3ed9be8 NEW_HEAD
```

The complete bridge range is `38cbc91^..NEW_HEAD`: 4 commits and 30 files. The remediation-only range after the initial bridge commit is `38cbc91..NEW_HEAD`: 3 commits and 26 files. A committed path gate rejects any candidate file outside the assigned KOSHA source, tests, schema, or this task's evaluation directory. `NEW_HEAD` denotes the single commit containing this report; its immutable SHA is reported after push.

## Fixed snapshot truth

The historical fixed generator rebuilt the offline corpus from the local ZIP source in 1,929.811 seconds. Its exact core Python command was recovered from the actual session tool-call evidence; the 32-minute generation was not rerun in this remediation.

A fresh recorded zero-work resume completed with 2.422 seconds of script-reported validation time and 6.113 seconds of recorder wall time. It exited 0 with `processed_this_run=0`, and the current, manifest, and four snapshot output hashes were byte-identical before and after. The machine-readable command record is `zero-work-resume-command.json`; it contains ordered arguments, path aliases, environment presence flags, input/output hashes, timing, and exit code without absolute paths or secret values.

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

The unchanged B-E-3 candidate is still `draft`, `human_confirmed=false`, and rejected with `ocr_candidate_not_human_confirmed`. Its exact file/content/attestation hashes remain unchanged. The fixed corpus item remains `boundary`, with no body, zero chunks, and zero imports. The candidate source has `render_dpi=180`; DPI metadata alone does not authorize review acceptance or import. The candidate was not edited or promoted.

Snapshot import now permits reviewed candidates for distinct item IDs. It fails closed on two candidates for the same item and on a duplicate canonical attestation. Tests cover the two-item success and both collision paths.

## Privacy

Audit failures serialize only `fatal_type` and `fatal_code`, never a stack. The committed scanner now covers all 21 changed UTF-8 evaluation artifacts in `38cbc91^..NEW_HEAD`, including `.log`, `.json`, `.md`, `.txt`, and `.mjs`. It found zero absolute path, credential value, token, configured-secret, or raw HMAC matches. Explicit binary MIME/extension exclusions are allowed; invalid or unreadable text fails closed.

## Verification

| Check | Passed | Failed | Elapsed |
|---|---:|---:|---:|
| Focused Python | 64 | 0 | 10.833s framework / 12.192s wall |
| Focused TypeScript | 120 | 0 | 42.520s framework / 45.493s wall |
| Ontology evidence regression | 45 | 0 | 1.250s framework / 3.992s wall |
| Strict TypeScript typecheck | yes | no | 31.528s command wall |
| `git diff --check` | yes | no | n/a |

Final automated test total: **229 passed, 0 failed**. Focused TypeScript is the prior 106 tests plus 14 new remediation tests, including 10 scanner cases. The fresh review RED is separate in `review-red-typescript.txt`: 14 expected failures and 92 passes out of 106 tests before implementation. Earlier task RED logs remain unchanged.

## Remaining hold

- Fresh independent review is required. No integration approval is claimed.
- B-E-3 remains unconfirmed and unimported.
- One OCR boundary remains, so `launchReadiness=false`.
- No production GET or deployment identity was established.
- `dbMutationPerformed=false` remains unchanged.
