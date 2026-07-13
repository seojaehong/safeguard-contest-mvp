# Phase A KOSHA reviewed OCR bridge remediation

- Status: **HOLD_PENDING_FRESH_REVIEW**
- Launch readiness: **false**
- DB/Supabase/API/schema/migration/data/package/lock mutation: **false**
- Production GET performed: **false**

## Immutable selective candidate

Integration target: `77d86416116b91809e1e0508c72564e06c8c31bc`

Product/remediation candidate: `c75acc06e3b4cc64f4a23e2f2ba46da62f65278f`

The executable product series is:

```text
git cherry-pick 38cbc9176453368237d85cb56903f782f9c09823 8e3b42492135799536913af9d1d6427256ad2ae4 3ed9be8d14b24047a8615ce1ef08361fcd0e40aa c7261b7d632e1778f3280f059d1e122308817635 c75acc06e3b4cc64f4a23e2f2ba46da62f65278f
```

The candidate starts after `d3ad86530bc786d8024206cc5b7c7db60c055278`, contains 5 commits and 31 files, and has zero out-of-scope paths. The remediation after the initial bridge commit contains 4 commits and 27 files. The product commit itself changes 3 files. A wholesale branch merge is not recommended.

This report is committed as evaluation-only evidence. It records its exact parent candidate SHA and intentionally does not embed its own commit SHA. The final evidence commit SHA must be appended to the series only after that commit exists.

## Integration simulation

The exact five-commit series above was cherry-picked without conflict onto target `77d86416116b91809e1e0508c72564e06c8c31bc` in a temporary detached worktree. These target-owned files remained present:

- `app/api/export/hwp/route.ts`
- `lib/xlsx-builder.ts`
- `tests/xlsx-export-route.test.ts`

The simulated tree passed Python 64/64, focused TypeScript 124/124, ontology 45/45, strict typecheck, and `git diff --check`. The temporary worktree was clean and removed. The machine-readable result and original-to-simulated SHA map are in `integration-simulation.json`.

## Snapshot truth

| Measure | Actual |
|---|---:|
| Inventory / completed | 1,040 / 1,040 |
| Native successes | 1,039 |
| OCR boundaries / hard failures | 1 / 0 |
| Failure-ledger rows | 1 |
| Chunks | 20,520 |
| Reviewed OCR imports | 0 |

The fixed source identity is `1db732ff3843adc12f1aa42130b82c45f4fe3497229aecd41b9be6a12fe5bc3d`, generation policy identity is `54840fedece9d4b347ad7fd88808866f7ca1b41c5a08b9c6ca47b284c9411b1f`, snapshot identity is `976068bc0f060e177be0392323a2853cd43f145c6d294e7759bcb6374f411282`, and manifest SHA-256 is `702202bf50155f083006155700735b6ea262932ed66117f2cd0d4795c6937519`.

The historical full generation took 1,929.811 seconds. Its command is recorded only because actual session tool-call evidence was recoverable; it was not independently rerun. The freshly recorded zero-work resume processed 0 items, took 2.422 seconds in the snapshot script and 6.113 seconds wall time, and left current, manifest, and all four output hashes unchanged.

## Candidate truth

B-E-3 remains `draft`, `human_confirmed=false`, and rejected with `ocr_candidate_not_human_confirmed`. It has `render_dpi=180`; DPI alone does not authorize OCR acceptance or import. The corpus item remains `boundary`, with no body, 0 chunks, and 0 imports. The candidate was not edited or promoted.

## Smoke truth

| Case | First terminal code | Credential check | GET |
|---|---|---:|---:|
| Stale snapshot + missing credential | `kosha-bridge-manifest-source-identity-mismatch` | no | no |
| Fixed snapshot + missing credential | `supabase-read-credentials-unavailable` | yes | no |

Neither failed run records `snapshotIntegrityVerifiedBeforeFetch=true`. No successful production GET is claimed.

## Scanner and CI remediation

Ordinary tests no longer read branch history or a local integration ref. Candidate path tests use explicit fixtures and retain the KOSHA path allowlist. The evaluation-only validator receives immutable target, candidate, and commit inputs.

Artifact scanning is content-first: strict UTF-8 decoding is attempted regardless of extension, and only positive binary byte signatures are excluded. Drive, UNC, common POSIX absolute paths, credential/token values, raw HMAC values, sensitive digest labels, and configured secret values fail closed. Safe public IDs and content-addressed digests remain explicit allowed cases.

## Verification

| Check | Passed | Failed | Framework / wall |
|---|---:|---:|---:|
| Focused Python | 64 | 0 | 10.647s / 12.439s |
| Focused TypeScript | 124 | 0 | 40.840s / 43.388s |
| Ontology evidence regression | 45 | 0 | 1.290s / 3.802s |
| Strict TypeScript typecheck | yes | no | n/a / 23.181s |
| `git diff --check` | yes | no | n/a |

Final automated test total: **233 passed, 0 failed**. The test framework aggregate is mechanically reconciled as `10.647 + 40.840 + 1.290 = 52.777` seconds. Test command wall time is 59.629 seconds; wall time including typecheck is 82.810 seconds. Framework and wall aggregates are intentionally separate.

Fresh RED evidence is separate for the branch-dependent integration failure, seven content-first scanner failures, and three stale report assertions. The final scanner covers all 33 task evaluation artifacts and reports zero path, credential, token, configured-secret, raw-HMAC, or sensitive-digest violations.

## Remaining hold

- Fresh independent review is required; no integration approval is claimed.
- B-E-3 remains unconfirmed and unimported.
- One OCR boundary remains, so `launchReadiness=false`.
- No production GET or deployment identity was established.
- `dbMutationPerformed=false` remains unchanged.
