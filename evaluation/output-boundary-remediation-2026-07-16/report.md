# SafeClaw P1 Output Boundary Remediation

Date: 2026-07-16
Branch: `fix/naturalize-output-contract`
Worktree: `C:\Users\iceam\dev\safeguard-contest-mvp\.worktrees\naturalize-output-contract`

## Finding

The Phase A output boundary previously checked citation-shaped tokens only. Provider-authored hazard and control prose without a UID, law article, or KOSHA code could therefore pass through `response.answer` and structured deliverables.

## Remediation

- Phase A v1 answers are reconstructed on the server as explicit `현장 확인 필요` sections; provider prose and caller-relabeled allowlists are not exposed.
- No-key, provider-rejection, template, and outer `lib/search.ts` fallback paths use the same answer boundary. Unresolved or missing grounding returns only `현장 확인 필요` answer sections.
- Phase A fallback deliverables are reconstructed from the canonical answer and expose no generic structured rows. Calls without `phaseAGrounding` keep their previous fallback behavior.
- The final `lib/search.ts` boundary runs after legal, weather, KOSHA, accident, and foreign-worker appendices. Every Phase A prose deliverable is reset to the exact canonical answer, so no appendix can reopen the boundary.
- Phase A v1 has no positive structured-row acceptance path. Canonical-looking or caller-relabeled hazard/control/evidence bindings remain review-required until the deferred trusted resolver gate exists.
- Unstructured Phase A deliverable prose is rejected fail-closed because it cannot carry the required control/evidence binding.
- Nested work-plan, TBM briefing, TBM log, and education hazard/control claims are inspected and rejected as review-required provider assertions.
- Nested work/action/equipment/verification, stop criteria, confirmation topics, worker confirmations, education topics/materials/TBM links, and related safety-meaning fields are rejected unless server-canonicalized.
- Phase A `tbmRiskLinks` remain review-required; index and cross-row inconsistencies are additionally reported and no v1 positive acceptance path exists.
- Provider-authored risk-row `equipment`, `verification`, `whyLikelihood`, and `whySeverity`, plus TBM-link `weatherSignal`, `confirmQuestion`, and `verification`, are rejected unless reduced to `현장 확인 필요`.
- The final Phase A search boundary removes Phase A provider risk rows and links. `materializePhaseAProductIntoResponse` adds zero rows/links and leaves any preexisting unrelated arrays byte-for-byte unchanged.
- `buildPhaseAProductMaterialization` emits a content-free review artifact only: `review_required`, empty canonical provenance arrays, no task/hazard/control/UID/label/classification/document rows, and mandatory human confirmation.
- `buildPhaseAGenerationGrounding` treats every supplied Phase A pack as review-required and exposes no production allowlist. Synthetic callers cannot create resolved grounding.
- The structured validator returns only `review_required`, rejects caller relabeling, and treats `likelihood`, `severity`, and `riskLevel` as unsupported Phase A assertions.
- Caller-controlled stable keys, Task/SIF/Hazard/Control labels and node IDs, cited UIDs, classifications, and applicability prose are not persisted in `phaseAProduct` or prepended to user-facing documents.
- The actual loader/resolver/MCP persistence/reopen path returns the same empty-provenance review artifact and zero scored rows under the current unresolved KOSHA corpus.
- Automatic Phase A scoring is explicitly deferred. Reopening requires a separate DB provenance migration and approval plus a new trusted resolver contract; that work is not part of this patch.
- A `not_registered` Phase A query no longer falls through to fuzzy published Task/Hazard lookup. The knowledge payload and MCP tool path return `found:false`, while registered canonical and alias tasks retain their exact matching path.
- Final `riskSummary.title`, `topRisk`, `immediateActions`, and `practicalPoints` are rebuilt from canonical values or `현장 확인 필요`. Unresolved `riskLevel` is also `현장 확인 필요` and is not converted into a low-risk report row.
- Search fallback and final assembly now share one `applyPhaseAResponseBoundary` implementation.
- Persisted report workpack validation accepts an absent or non-empty string `controlId` and rejects numeric, object, empty, or whitespace-only values.
- `RiskAssessmentRow.controlId` is optional for ordinary flows and preserved by parsing when supplied by the Phase A provider contract.
- Calls without `phaseAGrounding` retain the existing provider and fallback behavior.
- The unused public `isPhaseACitationAllowed` helper and its helper-only tests were removed; Phase A v1 exposes no citation acceptance API.

## TDD Evidence

RED command:

```text
npm.cmd test -- tests/phase-a-runtime-evidence-grounding.test.ts tests/ai-generation-trace.test.ts tests/ai-deliverables-generation-trace.test.ts
```

Observed before implementation: 3 test files failed, with failures for uncited canonical claims, answer exposure, and deliverables exposure. A later tracer test also failed because `controlId` was discarded by the structured-row parser.

Independent-review REJECT RED command:

```text
npm.cmd test -- tests/ai-generation-trace.test.ts tests/kosha-current-review-run-ask.test.ts tests/phase-a-runtime-evidence-grounding.test.ts tests/phase-a-product-materialization.test.ts tests/risk-row-normalization.test.ts
```

Observed after fixture correction: 4 test files failed and 6 tests failed for no-provider fallback, `lib/search.ts` provider failure, missing binding, cross-control references, nested structured prose, and non-canonical row preservation.

Final-review residual RED: 2 test files failed and 3 tests failed for appendix reattachment, incomplete nested semantic inspection, and missing TBM-link binding. A second nested tracer failed until work/equipment/verification, TBM questions, logged work, and education-material fields were covered.

Final residual RED command:

```text
npm.cmd test -- tests/phase-a-runtime-evidence-grounding.test.ts tests/phase-a-product-materialization.test.ts tests/kosha-current-review-run-ask.test.ts
```

Observed before the final patch: 3 test files failed, 3 tests failed, and 55 tests passed. Failures proved that cross-row TBM links were accepted, replaced rows retained stale links, and provider-failure summaries retained non-canonical prose. The same TDD case also asserts missing/out-of-range `riskRowIndex` and unchecked nested prose sentinels.

Fresh independent-review RED command:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts tests/ontology-evidence-chains.test.ts tests/kosha-current-review-run-ask.test.ts tests/reporting-downloads.test.ts
```

Observed: 3 test files failed, 3 tests failed, and 137 tests passed for unsafe materializer prose/provenance, fabricated unresolved risk level, and report schema handling. After correcting the fuzzy fixture to the actual hazard fallback input `추락 위험`, the knowledge tracer independently failed with `found:true` while 60 tests were skipped.

Latest P1/P3 RED command:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts tests/mcp-product-materialization-persistence.test.ts tests/claw-tools-phase-a-materialization.test.ts tests/reporting-downloads.test.ts
```

Observed: 3 test files failed, 6 tests failed, and 83 tests passed. Failures proved review-required direct and persisted MCP products still emitted `likelihood:3`, `severity:4`, `riskLevel:high`, and the persisted payload validator accepted four invalid `controlId` shapes.

Final boundary-bypass RED command:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts
```

Observed: 1 test file failed, 6 tests failed, and 11 tests passed. The forged review summary, four authoritative product mutations, and downgraded source review state all still emitted scored rows before the boundary revalidation patch.

Fail-closed v1 RED command:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts -t "never promotes a synthetic"
```

Observed: 1 test file failed, 1 test failed, and 18 tests were skipped. A fully relabelled synthetic evidence pack was still promoted to `verified` before the review-only v1 builder replaced the scoring path.

Final cleanup RED commands:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts -t "preserves existing unrelated"
npm.cmd test -- tests/phase-a-runtime-evidence-grounding.test.ts -t "never promotes"
npm.cmd test -- tests/phase-a-runtime-evidence-grounding.test.ts -t "rejects provider risk scoring"
```

Observed in sequence: the materializer cleared seeded unrelated rows/links; the validator promoted an empty review output to `grounded`; and provider `likelihood`, `severity`, and `riskLevel` fields were not semantically flagged. Each tracer failed once before its minimal fix.

Final P2 caller-provenance RED command:

```text
npm.cmd test -- tests/phase-a-product-materialization.test.ts -t "does not persist caller-controlled"
```

Observed: 1 test failed and 10 were skipped. Mutated task/hazard/control labels and node IDs, SIF UID, classification, applicability text, and stable key survived in both `phaseAProduct` and prepended document prose. The expanded contract transition then produced 18 expected failures with 112 passes across 7 files, all from old positive-provenance expectations.

Fresh-review GREEN focused command:

```text
npm.cmd test -- tests/ai-generation-trace.test.ts tests/ai-deliverables-generation-trace.test.ts tests/ai-deliverables-safe-parse.test.ts tests/phase-a-runtime-evidence-grounding.test.ts tests/ontology-evidence-chains.test.ts tests/phase-a-product-materialization.test.ts tests/phase-a-runtime-evidence-bridge.test.ts tests/claw-tools-phase-a-materialization.test.ts tests/mcp-product-materialization-persistence.test.ts tests/mcp-reviewed-route-task-binding.test.ts tests/risk-row-normalization.test.ts tests/risk-ref-gate-wiring.test.ts tests/kosha-current-review-run-ask.test.ts tests/reporting-downloads.test.ts
```

Result: 14 test files passed, 242 tests passed. The focused set includes the Next MCP reviewed-route task-binding path.

Typecheck command:

```text
npm.cmd run typecheck
```

Result: passed. The first attempt found missing installed `pdf-lib` dependencies in this worktree. `npm.cmd install --ignore-scripts` restored dependencies without tracked manifest or lockfile changes, and the repeated typecheck passed.

Diff checks:

- `git diff --check`: passed.
- Changed TypeScript diff `any` scan: 0 matches.
- `report.json` parse with `ConvertFrom-Json`: passed.
- `lib/ontology/graph-store.ts` semantic diff: zero; it remains unstaged as a line-ending-only worktree status entry.
- Staged files: 0.

## Contract Cases

1. New uncited hazard/control prose: rejected with `unsupported_phase_a_fact`.
2. Canonical-looking hazard/control text or caller-relabeled allowlists: review-required; no v1 positive acceptance path.
3. Missing bindings and globally allowed but cross-control references: rejected.
4. Nested structured hazard/control prose without canonical binding: rejected.
5. No-key/provider failure Phase A responses: canonical or `현장 확인 필요`; generic structured fallback removed.
6. Legal/weather/KOSHA/foreign appendices: removed by the final Phase A prose normalization boundary.
7. Phase A TBM risk links: review-required; missing/out-of-range index and row/link mismatches are explicitly reported.
8. Provider likelihood/severity/risk-level and nested row/link prose: rejected as unsupported assertions.
9. Final Phase A structured output: provider objects/rows/links removed by the search boundary; product materialization adds none and preserves existing unrelated arrays exactly.
10. Final risk summary/practical points: rebuilt from canonical facts/controls or `현장 확인 필요`.
11. Unresolved risk level: represented as `현장 확인 필요`; no fabricated high/medium/low report row.
12. Product rows: automatic scored materialization disabled for every product; review provenance remains available separately.
13. Unregistered fuzzy Task/Hazard intent: `found:false` through knowledge and MCP tool paths; registered aliases remain exact.
14. Search assembly: one Phase A boundary for fallback and final paths.
15. Review-required products: provenance set is empty; scored rows and caller fields are omitted from direct, Claw, MCP persistence, and reopen paths.
16. Current loader/resolver product: always review-required in v1; persisted and reopened rows remain empty.
17. Persisted `controlId`: absent/non-empty accepted; number/object/empty/whitespace rejected.
18. Materializer authority: no scoring or provenance authority exists in this patch; the public API uses only pack presence to emit a fixed review artifact.
19. Synthetic evidence relabeling or source UID/review-state/control mutation: scored rows remain empty and metadata remains review-required.
20. Non-canonical calls without `phaseAGrounding`: existing output behavior preserved.
21. Citation helper surface: no exported Phase A citation-acceptance predicate remains.

## Git State

No commit or push was performed. Review is pending.
