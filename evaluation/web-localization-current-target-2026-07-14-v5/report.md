# Web Localization Current Target v5

- Candidate product SHA: `534a0ea55ae3f3f4de15aa52c2e26b2794ef4604`
- Production build ID: `qhU1pj4ss3rFtDiv3LFJI`
- Verdict: `HOLD_FOR_INDEPENDENT_REVIEW`
- Final evidence selection: this v5 directory only, excluding `superseded/`

## Remediation

The published static ontology surface now renders 32 labeled nodes and 27 labeled relationship rows. Every node exposes its canonical ID, visible Korean label, Korean accessibility name, degree, review-required state, and measured geometry. Every relationship exposes source and target IDs, a Korean relation label, a Korean accessibility name containing both endpoint IDs, and measured geometry. The browser test targets `.ontology-static-node` and `.ontology-static-edge`; it no longer substitutes the OperationMemory graph for the static ontology surface.

Typed presentation maps now cover report source mode/scope/time basis/limitations, period, risk level, improvement status, governance memory fields, classification group, ontology relations, and operation-memory metadata. Canonical JSON and graph values remain unchanged. CSV, Markdown, learning JSONL, learning Markdown, ontology labels, and operation-memory display rows emit `분류 검토 필요` for unknown values and do not emit the unknown raw token.

The mixed typography test hunk from `f15e88d` was detached in `4431de1` and reapplied as clean test-only commit `534a0ea`. `4431de1` is not required for selective integration. A detached temporary worktree confirmed that the minimal order below applies cleanly to `77d8641` and retains the `-0.3` hover-card tracking contract without selecting `f15e88d`.

## Selective Integration

Apply these commits in this exact order:

1. `aca2f1db878e8597fd946ce99cabc9ecd4fe0345`
2. `14dc197e9c253c45a5ea79476acddbf6ac0f1a33`
3. `188b3b38de48c102f199cfd0942a93d59d56d7fa`
4. `d9aae1291ef0ef3ae66f86bbc4203b3482d0a655`
5. `828f1d81a83df589405d7bb292cc858614b5dc14`
6. `534a0ea55ae3f3f4de15aa52c2e26b2794ef4604`
7. `804833c4291ef01360928ee59b19e903a3b928bb`
8. `fc1028a8af793ccf0e83d115a4ee9e09e7a6d4e1`
9. `6d0b4dd8c0a54b235169217f9d0d2fcd170636c3`
10. Final v5 evidence commit

Do not select `1835d9f`, `1cd4d36`, `f15e88d`, or `2fb3cc8`. They are superseded evidence commits. Do not select normalization commit `4431de1`; clean replacement `534a0ea` carries the required hunk directly after `828f1d8`.

## Verification

Focused command:

```text
npm.cmd test -- tests/current-target-localization-contract.test.ts tests/reporting-downloads.test.ts tests/reports-download-center.test.ts tests/operation-memory-visualization.test.ts tests/workspace-operation-graph.test.ts tests/ontology-typography-production-matrix.test.ts
```

- Focused result: 6 files, 5 passed and 1 skipped; 69 tests, 68 passed and 1 skipped.
- Strict typecheck: `npm.cmd run typecheck`, exit code 0.
- Candidate build: `npm.cmd run build`, Next.js 15.5.20, 27/27 static pages.
- Production typography: 1 file and 1 test passed.
- Production localization browser: 1 file and 24 tests passed.
- Browser artifacts: 16 PNG files, 16 route metric JSON files, and `browser-contracts.json`.

Across all 16 route variants, horizontal overflow, scoped overlap, unnamed interactive controls, issue overlays, and recoverable hydration errors are zero. The four ontology variants each report 32 nodes, 27 edges, zero inaccessible nodes, zero inaccessible edges, zero unmarked disconnected nodes, zero node overlaps, and zero clipped nodes. The four workspace variants each report three real SVG edges with endpoint identities, Korean accessibility names, nonzero geometry, no missing connected node, and no clipped node.

Hydration restore ran twice. Both runs read before any write and every observed write preserved `worker-canonical-restored`. Valid RFC3339 generated/read timestamps were preserved; an invalid generated timestamp became canonical `null` while the presentation row displayed `생성 시각 확인 전`.

## TDD Record

RED cases were reproduced before implementation for the static ontology selector mismatch, missing endpoint/accessibility identities, raw report source values, raw governance corpus values, unknown period/risk/status values, unknown operation-memory metadata keys, and missing known improvement status presentation. GREEN coverage includes all-known and unknown-negative cases across CSV, report Markdown, learning JSONL, learning Markdown, ontology relations, and operation-memory metadata.

Preserved regression contracts include Reports fail-closed association behavior, Korean 개선 전/개선 후 presentation, canonical corpus event keys, workspace hydration write gating, RFC3339/null timestamp handling, and real OperationMemory edge geometry.

## Review Notes

Contrast is measured in every sidecar. Low-contrast samples remain on ontology Day/Night, reports Day, and workspace Night; the lowest measured ratios are recorded in `evidence-validation.log`. This remediation did not modify `app/globals.css`, so those observations remain for independent review rather than being represented as closed.

The final selected candidate has one sequential production build followed only by production harnesses. Three earlier build attempts are retained under `superseded/`: one was invalidated when a focused browser test started `next dev`, one was superseded by the expanded sidecar contract, and one was superseded by the clean lineage repair. None is part of the final selection.

No package file, `app/globals.css`, database/schema/migration file, secret, or unrelated backend authority was changed by the new remediation commits.

## Artifacts

- `candidate.json`: immutable source SHA and build ID
- `browser-contracts.json`: hydration restore and timestamp/null evidence
- `evidence-validation.log`: sidecar identity, geometry, accessibility, contrast, and count audit
- `lineage-validation.log`: clean cherry-pick simulation
- `focused-tests.log`, `typecheck.log`, `build.log`, `typography-production.log`, `browser-production.log`: exact execution logs
- `*-day-*.json`, `*-night-*.json`: route metrics and graph contracts
- `*-day-*.png`, `*-night-*.png`: current Day/Night desktop/mobile captures

## Verdict

`HOLD_FOR_INDEPENDENT_REVIEW`

