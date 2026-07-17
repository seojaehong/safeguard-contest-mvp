# Workpack Submission Preview Completeness

## Scope

- Base: `f16d152e3c38669f69029dab45ebf2e7a645acb3`
- Product files: `components/WorkpackEditor.tsx`, `components/workpack-editor-structure.ts`
- Test files: `tests/workpack-submission-preview.test.ts`,
  `tests/editor-export-integrity.test.ts`, `tests/documents-editor-layout.test.ts`
- Export serializers, database schema, sharing, and provider dispatch were not changed.

## Finding

The on-screen submission preview silently selected only the first three document
sections and the first four rows in each section. Downloaded artifacts could
therefore contain reviewed rows that were absent from the preview.

## Remediation

The preview now renders every grouped section and every row supplied by the
same selected-document row model. The full table is mounted only after the
preview disclosure opens, so collapsed editing does not rebuild the complete
table. The underlying XLSX, HWPX, HWP, and PDF builders remain unchanged.

## Verification

- TDD RED: the completeness contract failed on both truncation expressions.
- Focused GREEN: 2 files, 4 tests passed.
- Browser containment: 1 test passed, 29 unrelated tests skipped.
- Dependency synchronization: `npm.cmd install`; package and lock files stayed unchanged.
- Strict typecheck: passed.
- Production build: passed, 28 static pages generated.
