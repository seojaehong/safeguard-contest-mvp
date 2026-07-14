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
