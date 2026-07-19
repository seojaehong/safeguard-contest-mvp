# Document Quality Grounding Current Gate

Date: 2026-07-19
Source HEAD: `cebff70c4725391899323f4234e4ea65f7298154`

## Purpose

This gate checks whether the current document-generation contract still protects the product-quality direction:

- fixed SIF/KOSHA/law/work-history evidence before LLM prose;
- `naturalize_only` model role;
- rejection of provider-authored hazards/controls outside the Phase A packet;
- explicit multi-process risk-row coverage;
- `qualityContract` and `ontologyQa` readiness boundaries;
- deterministic DB-harness risk rows and TBM links.

## Verification

Command:

```powershell
npm.cmd test -- tests\ai-deliverables-generation-trace.test.ts tests\ai-deliverables-scope.test.ts tests\grounded-generation-contract.test.ts tests\quality-contract.test.ts tests\workpack-ontology-qa.test.ts tests\commercial-harness.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 6 passed / 6
- Tests: 131 passed / 131
- Duration: 20.76s

## Verified Product Claims

- Provider text cannot introduce new unsupported hazard/control prose at the Phase A deliverables boundary.
- Explicit multi-process work is covered by structured risk-row rules instead of being collapsed into a fixed 5-7 row single-process output.
- Review-required Phase A paths remain separated from production-ready claims.
- `qualityContract` blocks placeholder-heavy or structurally incomplete outputs.
- `workpack-ontology-qa` and the commercial harness keep DB-harness evidence, risk rows, and TBM structures connected.

## Important Boundary

This is stronger than a visual review of one generated document, but it is not the same as proving every live model sample is excellent.

What this gate proves:

- The current code contract rejects major classes of hallucinated or ungrounded output.
- Deterministic rows and QA gates are still wired.
- The KOSHA/SIF-first direction is technically preserved in the focused generation suite.

What still needs separate proof:

- a fresh live `/api/ask` sample for each demo scenario;
- side-by-side before/after sample quality review;
- human review of wording quality, concision, and field usability;
- provider-backed quality when a paid model is enabled in production.
