# Northstar Task-Question Binding Evaluation

## Scope

- Branch: `fix/northstar-task-binding-20260715`
- Authoritative base: `dc608c8d7f7f854270669e05789cad88816d0f43`
- Surface: reviewed safety docpack Phase A provenance attachment
- Non-goals: no database, schema, migration, environment, or LLM-based task inference changes

## Binding Contract

Phase A SIF, KOSHA, and law provenance is materialized only when all of the following hold:

1. The caller's `task` exactly resolves through the code-owned Phase A canonical task or alias registry.
2. The normalized question explicitly contains a canonical task or alias from that registry.
3. The question resolves to exactly one Phase A chain.
4. The requested task, question mention, and returned Phase A product share the same chain ID.

Unrelated tasks, ambiguous multi-chain questions, generic task labels, and hazard-only wording fail closed for provenance attachment. Document generation and QA review remain available. Existing `naturalize_only` evidence-chain behavior is unchanged.

## TDD Evidence

RED command:

```text
npm.cmd test -- tests/claw-tools-phase-a-materialization.test.ts
```

Result before production changes: 1 file executed, 11 tests total, 9 passed, 2 failed. Both failures demonstrated that unrelated or ambiguous task inputs attached `work-at-height-fall` provenance.

GREEN focused command:

```text
npm.cmd test -- tests/claw-tools-phase-a-materialization.test.ts tests/ontology-evidence-chains.test.ts
```

Result: 2 files passed, 57 tests passed, 0 failed.

Strict typecheck command:

```text
npm.cmd run typecheck
```

Result: exit code 0, no TypeScript errors.

Diff check command:

```text
git diff --check
```

Result: exit code 0. Git emitted only the repository's LF-to-CRLF working-copy warnings.

## Honest Boundary

This remediation proves deterministic binding only for the three Phase A chains currently present in the code-owned evidence-chain registry. It does not infer synonymous tasks beyond registered aliases, does not use an LLM to guess intent, and does not promote provenance for questions that mention multiple registered chains.

## Follow-up Intent Boundary Remediation

Fresh review of commit `6d1bdff25bbb440464eb3b9379850b5941a862e1` identified three false-positive intent cases:

- `고소작업은 하지 않고 배관 작업 수행`
- `고소작업 여부가 아직 미확정`
- `비전기작업 문서팩`

The matcher now requires a registered label at a deterministic lexical boundary. For a sentence longer than the exact task label, the matched task must have a nearby registered positive action expression. Nearby negation or uncertainty takes precedence and rejects the match. Questions naming multiple registered chains remain fail-closed. The implementation is a fixed rule set and does not use general NLP or an LLM.

The reviewed MCP route now delegates to `createGenerateReviewedSafetyDocpackHandler`, allowing the same production orchestration boundary to be tested without initializing the transport server. Existing generation, QA, attribution persistence, alias handling, and `naturalize_only` behavior remain intact.

Follow-up RED commands and results:

```text
npm.cmd test -- tests/claw-tools-phase-a-materialization.test.ts tests/ontology-evidence-chains.test.ts
```

Result before matcher remediation: 2 files executed, 63 tests total, 57 passed, 6 failed.

```text
npm.cmd test -- tests/mcp-product-materialization-persistence.test.ts
```

Result before reviewed MCP handler implementation: 1 file executed, 10 tests total, 6 passed, 4 failed.

Additional nearby-intent RED command:

```text
npm.cmd test -- tests/ontology-evidence-chains.test.ts
```

Result before expanding the nearby suffix scan: 1 file executed, 54 tests total, 52 passed, 2 failed. The failures covered `수행 여부 미확정` and `수행하지 않음` after a valid task label.

Fresh final verification:

```text
npm.cmd test -- tests/mcp-product-materialization-persistence.test.ts tests/claw-tools-phase-a-materialization.test.ts tests/ontology-evidence-chains.test.ts tests/mcp-route-scope-contract.test.ts tests/mcp-auth.test.ts
npm.cmd run typecheck
```

Result: 5 files passed, 111 tests passed, 0 failed; strict TypeScript typecheck passed.

## Full-Clause Intent Remediation

Fresh review of commit `871aecbd3e24056f3118c3c128c7d152670f4dc0` found that the 32-character suffix window did not cover prefix or remote unsupported intent. The matcher now evaluates the complete deterministic sentence clause containing each registered task span. Negation, cancellation, unresolved decisions, and action-under-review wording anywhere before or after the span take precedence over positive action wording.

Covered regressions include:

- `미확정인 고소작업을 수행합니다`
- `고소작업을 진행할지 검토`
- `고소작업은 아직 결정되지 않음`
- `하지 않는 고소작업을 위한 문서팩`
- `취소된 고소작업을 수행합니다`
- a negation more than 32 characters after the task span

The parser uses only code-owned task aliases, lexical boundaries, sentence delimiters, and fixed intent patterns. It does not call an LLM or infer an unregistered synonym. A valid canonical question with the registered `높은 곳 작업` alias remains eligible.

Full-clause RED command:

```text
npm.cmd test -- tests/ontology-evidence-chains.test.ts tests/claw-tools-phase-a-materialization.test.ts
```

Result before production changes: 2 files executed, 80 tests total, 70 passed, 10 failed. Five newly added bypass cases failed on each surface; `고소작업은 아직 결정되지 않음` was already fail-closed because it had no positive action.

Next MCP route registration RED command:

```text
npm.cmd test -- tests/mcp-reviewed-route-task-binding.test.ts
```

Result before exposing the existing route registration entry point: 1 file executed, 7 tests total, 0 passed, 7 failed with `registerTools is not a function`.

Fresh final verification:

```text
npm.cmd test -- tests/mcp-reviewed-route-task-binding.test.ts tests/mcp-product-materialization-persistence.test.ts tests/claw-tools-phase-a-materialization.test.ts tests/ontology-evidence-chains.test.ts tests/mcp-route-scope-contract.test.ts tests/mcp-auth.test.ts
npm.cmd run typecheck
```

Result: 6 files passed, 130 tests passed, 0 failed; strict TypeScript typecheck passed.

The route regression invokes the real `registerTools` registration, central scoped-tool authorization wrapper, and production reviewed-docpack handler. The MCP adapter is mocked, so this verifies Next route registration behavior rather than an HTTP JSON-RPC network round trip. No database, schema, migration, environment, or `naturalize_only` behavior changed.
