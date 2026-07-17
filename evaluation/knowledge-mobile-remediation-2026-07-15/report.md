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
4. The browser contract clicks every rendered disclosure summary, verifies the native closed-to-open transition, validates query links as same-origin `/knowledge?reference=` URLs, and rejects overlapping targets.
5. Existing disclosure behavior, evidence links, provenance content, and no-publish-control contract remain intact.

## TDD Evidence

- RED: 4 expected failures reproduced the missing presentation boundary and the measured `18px` mobile targets.
- Strengthened browser run: 2 files, 11 tests passed with real disclosure clicks, safe query-href validation, no target overlap, and minimum target geometry.
- Final evidence run: 3 files, 18 tests passed with Vitest `4.1.10`.
- Strict TypeScript: passed with `tsc --noEmit --incremental false`.
- Dependency sync: `npm.cmd install` completed; `pdf-lib@1.17.1` and `@pdf-lib/fontkit@1.1.1` are installed.
- Package source integrity: `package.json` and `package-lock.json` SHA-256 values were unchanged before and after install; source diff is empty.
- Range diff check: `git diff --check a00e99d91ec5d04d9efbda29e369b04904fd5b49..HEAD` passes after removing the report EOF blank line.

### Fresh Independent Review P1 Remediation

- RED: strict typecheck reproduced `TS2339` at both disclosure-state callbacks because Playwright exposed `HTMLElement | SVGElement`.
- GREEN: each callback now requires `HTMLDetailsElement` with an explicit fail-fast error before reading `.open`; no `any` is used.
- Focused browser contract: 2 files, 11 tests passed.
- Strict TypeScript: passed after the narrowing change.

Commands:

```powershell
npm.cmd install
npm.cmd ls pdf-lib @pdf-lib/fontkit --depth=0
npm.cmd test -- tests/knowledge-governance-ui-contract.test.ts tests/knowledge-page-layout.test.ts
npm.cmd test -- tests/user-visible-korean-copy.test.ts tests/knowledge-governance-ui-contract.test.ts tests/knowledge-page-layout.test.ts
npm.cmd run typecheck
git diff -- package.json package-lock.json
git diff --check a00e99d91ec5d04d9efbda29e369b04904fd5b49..HEAD
```

## Deferred Information Architecture Item

The live audit measured an approximately `8,890px` mobile document height. This bounded remediation does not delete content, add route splits, or introduce disclosure state. A later product pass should evaluate a task index or section-level progressive disclosure with separate browser and accessibility contracts.

## Verification Boundary

- Focused source and browser tests: complete
- Strict typecheck: complete
- Full production build: not run for this bounded patch
- Live deployment verification: pending integration and deployment
