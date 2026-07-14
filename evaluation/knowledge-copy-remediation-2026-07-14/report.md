# Knowledge copy remediation

## Scope

- Replaced decorative English headings on `/knowledge` with Korean product labels.
- Reworded internal `published ontology` and `knowledge_events` terminology as reviewed, published knowledge in user-facing copy.
- Preserved KOSHA, SIF, ontology governance, provenance, and promotion-state behavior.

## Verification

- `tests/user-visible-korean-copy.test.ts`
- `tests/knowledge-governance-ui-contract.test.ts`
- `tests/knowledge-governance.test.ts`
- `tests/knowledge-page-layout.test.ts`
- Result: 4 files, 21 tests passed.
- Strict TypeScript typecheck passed.
- `git diff --check` passed.

