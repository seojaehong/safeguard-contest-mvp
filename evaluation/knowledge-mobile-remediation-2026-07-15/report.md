# SafeClaw Knowledge Mobile Remediation

## Scope

- Base after integration-branch rebase: `a00e99d91ec5d04d9efbda29e369b04904fd5b49`
- Route: `/knowledge`
- Product ownership: `app/knowledge/page.tsx`, `app/knowledge/KnowledgePage.module.css`
- DB, schema, data mutation: none

The repository renders the route from `app/knowledge/page.tsx`; the requested `KnowledgePage.tsx` file does not exist. The remediation therefore changes the existing server component instead of adding a duplicate page implementation.

## Resolved Findings

1. Governance presentation no longer renders `Hermes / LLM`, `human_review`, `Published ontology`, `published_ontology`, or `SafeClaw system of record` as visible copy.
2. Machine identifiers remain unchanged in `data-knowledge-stage` and `data-knowledge-authority`, and the shared governance model is not mutated.
3. Knowledge evidence disclosure summaries and detail links now use at least `44px` by `44px` clickable boxes on the 390px mobile viewport.
4. Existing disclosure behavior, evidence links, provenance content, and no-publish-control contract remain intact.

## TDD Evidence

- RED: 4 expected failures reproduced the missing presentation boundary and the measured `18px` mobile targets.
- GREEN focused run: 2 files, 11 tests passed.
- Final post-rebase related run: 3 files, 18 tests passed.
- Strict TypeScript: passed with `tsc --noEmit --incremental false`.
- Diff check: passed; line-ending notices are repository Windows normalization warnings only.

Commands:

```powershell
npm.cmd test -- tests/knowledge-governance-ui-contract.test.ts tests/knowledge-page-layout.test.ts
npm.cmd test -- tests/user-visible-korean-copy.test.ts tests/knowledge-governance-ui-contract.test.ts tests/knowledge-page-layout.test.ts
npm.cmd run typecheck
git diff --check
```

## Deferred Information Architecture Item

The live audit measured an approximately `8,890px` mobile document height. This bounded remediation does not delete content, add route splits, or introduce disclosure state. A later product pass should evaluate a task index or section-level progressive disclosure with separate browser and accessibility contracts.

## Verification Boundary

- Focused source and browser tests: complete
- Strict typecheck: complete
- Full production build: not run for this bounded patch
- Live deployment verification: pending integration and deployment

