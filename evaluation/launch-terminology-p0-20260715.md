# Launch terminology P0 verification

- Date: 2026-07-15
- Branch: `fix/launch-terminology-p0-20260715`
- Base: `3a9d03ecf97e3ac51e5346abe035797dce043b93`
- Scope: customer-facing presentation labels in share, documents, reports, and dry-run surfaces

## Implemented boundary

- Replaced exposed operational terminology with plain Korean customer labels.
- Kept report JSON, JSONL, Markdown, and Obsidian export formats and payload fields unchanged.
- Moved three advanced report downloads under collapsed `관리자용 상세 파일` details.
- Moved dry-run paths and raw report text under collapsed `상세 점검 기록` details.
- Preserved backend diagnostics, DB harness contracts, generation prompts, machine enums, audit data, ontology, grounded-generation contracts, and DB/schema files.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused terminology/readiness/reports tests | PASS | 6 files, 67 tests passed |
| Reports browser contract | PASS | 1 file, 12 tests passed |
| Documents default rendered terminology | PASS | 1 selected browser test passed |
| Share and nested workspace terminology | PASS | 1 selected browser test passed |
| TypeScript typecheck | PASS | `tsc --noEmit --incremental false` |
| Customer-surface static audit | PASS | 0 default-visible violations; 1 collapsed-admin JSON label allowed |
| Forbidden-scope diff audit | PASS | 0 changed files |
| Diff whitespace audit | PASS | `git diff --check` |

Focused command:

```text
npx.cmd vitest run tests/customer-terminology-boundary.test.ts tests/web-safe-presentation-localization.test.ts tests/workpack-readiness.test.ts tests/workpack-share-authority.test.ts tests/reporting-downloads.test.ts tests/workspace-share-simplification.test.ts --maxWorkers=1 --no-file-parallelism
```

Reports browser command:

```text
npx.cmd vitest run tests/reports-design-remediation.test.ts --maxWorkers=1 --no-file-parallelism
```

## Honest RED

The full repository suite was started with one worker but intentionally stopped for the requested timebox. Before interruption, `tests/frontend-route-coverage.test.ts` reported one failing reconciliation test: `reconciles the complete route, theme, special-state, and generated-surface evidence`. The full suite did not complete, so no repository-wide PASS is claimed. Browser-wide verification is deferred to the integrated main branch as directed.

Pre-existing generated files under `output/playwright`, `playwright-report`, and `test-results` are excluded from this change and must not be staged, committed, or reverted.

## Independent NO-GO remediation

The follow-up review closed all three launch blockers:

1. Default rendered share and document surfaces no longer expose `Markdown`, `Supabase`, `Operation Ontology`, `Operation Graph`, `API`, or `JSON` as operational labels. Internal identifiers, serialization, content types, and export formats remain unchanged.
2. The former source-only terminology assertion was removed. Browser assertions now inspect the actual `/documents` page, the workspace share composition, and the nested field-workspace composition through rendered `innerText()`. Closed administrator details remain outside the default-visible contract.
3. The advanced report download label is now `현재 조회 결과 데이터`, accurately describing the filtered snapshot. The `.json` filename, `application/json;charset=utf-8` content type, and `buildReportJson` payload path are unchanged.

The red phase recorded the old report label and the rendered `/documents` shell label `API Law.go · KOSHA · 기상청`. After the bounded presentation changes, the focused browser checks passed.

Static review scanned five composed customer-surface files. It found 23 technical occurrences for review: 22 internal code/export references and one allowed `JSON` button inside the collapsed `editor-export-panel`. Default-visible violations were 0, and forbidden ontology/grounded-generation/DB/schema changes were 0.

Per the follow-up timebox, no full repository suite or build was run. Browser-wide integration remains assigned to the main branch.

## Reviewer P1 closure

The independent P1 re-review found that the rendered default-surface regular expressions did not include `DB 하네스` or `품질 계약`. Both `tests/documents-editor-layout.test.ts` and `tests/workspace-layout-regression.test.ts` now use a named default-visible terminology pattern containing those terms. The same pattern guards the actual `/documents` body, workspace share composition, and nested field-workspace `innerText()`.

TDD evidence:

- RED: the mutation sentinel `DB 하네스 · 품질 계약` was not matched by the prior expression in either browser test; 2 selected tests failed.
- GREEN: workspace share/nested render passed 1 selected test with 24 unrelated tests skipped.
- GREEN: documents default render passed 1 selected test with 22 unrelated tests skipped.
- Terminology unit: 4 tests passed.
- Strict typecheck: `tsc --noEmit --incremental false` passed.

One combined GREEN attempt encountered a documents harness `beforeAll` startup timeout before any documents assertion ran. The documents test then passed when rerun alone. No product file was changed for this P1 closure.
