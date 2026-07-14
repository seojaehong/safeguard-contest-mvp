# North-star grounded generation remediation

- Date: 2026-07-15 (Asia/Seoul)
- Branch: `fix/northstar-grounded-generation-20260715`
- Base: `dc608c8`
- Remediated candidate: `875dfe1fdfd015cc56fc4a779b1c2502bbd5051f`
- Scope: general `/api/ask` full-mode deliverable generation

## Result

`runAsk` now assembles one deeply frozen `grounded-generation-v1` packet from the same public DB harness snapshot used by generation. The packet contains eligible direct/SIF evidence, parent-ready and current KOSHA supporting evidence, and the legal candidates selected for the request. A SHA-256 `sourceIdentity` binds the packet contents.

The provider prompt receives this packet as the only legal/KOSHA/control allowlist. Legacy legal/KOSHA prompt blocks are suppressed while the packet is enforced. Parsed provider output is checked before merge:

- explicit KOSHA and law article references must resolve to a packet source;
- typed `evidenceRefs` must exactly match a canonical key, while untyped aliases require normalized exact equality;
- law/KOSHA tokens are matched only against same-kind packet sources, so prefix collisions such as `제38조`/`제38조의2`, `C-12`/`C-123`, and `sif-1`/`sif-1-extra` do not authorize one another;
- control validation follows schema-specific paths (`currentControls`, `additionalControls`, `safetyMeasure`, TBM/permit control actions, and planned actions); workflow `workSteps[].action` is not treated as a control;
- violations reject the affected generation group, mark diagnostics `review_required`, reset its trace to deterministic fallback, and do not enter provider output into the document pack.

For every rejected group, critical packet controls absent from deterministic materialization are copied into DB harness `missingEvidence`, which makes the existing ontology surface `review_required`. A packet-valid legal citation remains accepted.

`sourceIdentity` hashes version, packet status, LLM role, and every source's canonicalized kind, reference key, source ID, title, summary, aliases, and controls. Source/alias/control input ordering does not change identity.

## TDD evidence

Intentional RED runs:

1. `npm.cmd test -- --run tests/grounded-generation-contract.test.ts` -> exit `1`; missing contract module.
2. `npm.cmd test -- --run tests/ai-deliverables-generation-trace.test.ts -t "fails closed when a parsed document cites a law outside"` -> exit `1`; ungrounded provider body was still accepted.
3. `npm.cmd test -- --run tests/grounded-generation-contract.test.ts -t "flags an invented control"` -> exit `1`; known key plus invented control was still accepted.
4. `npm.cmd test -- --run tests/grounded-generation-contract.test.ts -t "flags a bare article"` -> exit `1`; bare unknown article was still accepted.
5. `npm.cmd test -- --run tests/grounded-generation-contract.test.ts -t "kind-aware|workSteps action|hashes all behavior"` -> exit `1`; 3 RED cases reproduced substring collisions, workflow-action misclassification, and incomplete/order-sensitive identity hashing.
6. `npm.cmd test -- --run tests/kosha-current-review-run-ask.test.ts -t "surfaces every critical packet control"` -> exit `1`; rejected fallback omitted a critical packet control without surfacing it.

Final verification:

- `npm.cmd ci --ignore-scripts` -> exit `0`; 373 packages installed. Audit output reported 5 moderate dependency findings; no automatic mutation was run.
- `npm.cmd test -- --run tests/grounded-generation-contract.test.ts tests/ai-deliverables-generation-trace.test.ts tests/ai-deliverables-prompts.test.ts tests/kosha-current-review-run-ask.test.ts` -> exit `0`; 4 files passed, 62 tests passed.
- `npm.cmd run typecheck` -> exit `0`.

## Remaining boundary

The mechanical gate validates explicit citations and typed structured control fields. It does not claim semantic equivalence checking for every unconstrained sentence in long free-form prose. Those prose groups still fail closed when they contain an out-of-packet explicit citation; deterministic document fallbacks remain the product safety path for rejected groups.

No DB schema, migration, environment contract, or API response schema was changed.
