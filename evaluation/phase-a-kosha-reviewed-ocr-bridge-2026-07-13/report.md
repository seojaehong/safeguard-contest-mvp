# Phase A KOSHA reviewed OCR bridge P2 remediation

- Status: **HOLD_PENDING_FRESH_REVIEW**
- Launch readiness: **false**
- Read-only: **true**
- DB/Supabase/API mutation performed: **false**
- Migration performed: **false**

## Source and candidate truth

The unchanged corpus remains 1,040 items, 1,039 native successes, one OCR boundary, 20,520 chunks, and one failure-ledger row. `launchReady` remains false.

The unchanged B-E-3 candidate remains `draft` and `human_confirmed=false`. A fresh validator regression rejected it with `ocr_candidate_not_human_confirmed`. It has zero chunks and zero imported rows.

| Candidate identity | SHA-256 |
|---|---|
| Exact file bytes | `5d06ba7a04329e32e8fafb30b9311f6fb2ea70e248dfcb706aaa883e3632753b` |
| Canonical immutable content | `e18c2ae92e938f564c5dff20f9c90fb76170bf27122ec71c9f03f5531719577e` |
| Canonical full review attestation | `9dbb03c1ddd14dfc293b800cc4d4762244996b3cac050545d813add30d97d57d` |

The candidate file was read only. It was not edited, confirmed, attested, imported, copied into the corpus, or used for a DB/API write.

## P2 fixes

The pure snapshot verifier now receives current and manifest source identity plus generation policy identity. It hashes canonical source and policy material taken from the actual manifest bytes, preserving Python number forms such as `100.0`. It also hashes the actual bytes of `items.jsonl`, `chunks.jsonl`, `failures.jsonl`, and `checkpoint.json`, then recomputes the same content-addressed snapshot ID used by snapshot publication. Mixed source, policy, manifest, output, and stale reproducibility inputs fail before artifact construction.

The bridge now hashes candidate raw bytes before JSON parsing. It verifies separate `candidateFileSha256`, `candidateContentSha256`, and `candidateAttestationSha256` values and includes all three in the v2 artifact reproducibility hash. The attestation digest covers the complete canonical review object, including reviewer, timestamp, review state, confirmation flag, content binding, attestation schema, and HMAC signature when present.

Adversarial tests cover mixed identities, tampered source/policy/output material, a stale snapshot ID, provided digest mismatch, raw-byte tampering, and identical OCR content with distinct valid review attestations producing distinct artifact identities.

## Actual snapshot smoke

The existing snapshot `bb8dd542a0d8dc1ac37e330944bc24fcbfef6eea72e4afb106f96a9c19e63d51` passed the strengthened local verifier. Credentials were intentionally absent, so execution stopped at `Supabase read credentials are unavailable` before any production request. No network request or mutation occurred. Evidence is in `snapshot-integrity-smoke/result.json` and `snapshot-integrity-smoke/audit.log`.

## Verification

| Check | Passed | Failed | Wall elapsed |
|---|---:|---:|---:|
| Focused Python | 61 | 0 | 17.759s |
| Focused TypeScript | 100 | 0 | 33.810s |
| Ontology evidence regression | 45 | 0 | 7.376s |
| Strict TypeScript typecheck | yes | no | 35.873s |
| `git diff --check` | yes | no | n/a |

Final automated test total: **206 passed, 0 failed**. Test command wall time was 58.945s; tests plus strict typecheck took 94.818s before the final diff check.

P2 RED evidence is preserved in `p2-red-typescript.log`: 84 tests ran, 66 passed, and the 18 new expectations failed before implementation. The earlier phase RED logs remain preserved separately.

Commands:

```text
python -m unittest scripts.tests.test_recover_kosha_ocr_boundary scripts.tests.test_snapshot_kosha_guide_corpus
npm.cmd test -- --run tests/kosha-guide-offline-harness.test.ts tests/kosha-guide-corpus-audit.test.ts
npm.cmd test -- --run tests/ontology-evidence-chains.test.ts
npm.cmd run typecheck
git diff --check
```

## Remaining hold

- Fresh review of this remediation is required. No approval is claimed.
- B-E-3 has no trusted human confirmation and remains rejected from import.
- The corpus retains one OCR boundary; B-E-3 remains at chunks 0 and imported 0.
- No fresh production GET was performed, and no deployment identity is established by this task.
- `launchReadiness=false` and `dbMutationPerformed=false` remain mandatory.
