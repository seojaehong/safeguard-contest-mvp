# Task 6 implementation report

## Scope

- Standardized the rendered editor preview, printable/export HTML, and PDF-ready HTML on the document font stack and exact print role tuples.
- Preserved all document interpolation, field order, approval/signature markup, A4 page contract, API request parsing, binary PDF path, and response headers.
- Added tabular numerals only to document table cells. Product HUD typography is not used in document prose or tables.

## TDD evidence

- RED: `npm.cmd test -- tests/generated-document-typography.test.ts` failed 4 of 5 tests on the original divergent preview, printable, and PDF-ready typography.
- GREEN: the same command passes 6 of 6 tests after the bounded CSS changes, including a repository-wide embedded `font-size` scan of the editor/export source.

## Verification

- `npm.cmd test -- tests/generated-document-typography.test.ts tests/frontend-design-contract.test.ts`: PASS, 2 files / 24 tests.
- `npm.cmd test`: PASS, 56 files / 508 tests.
- `node scripts/frontend_consistency_audit.mjs`: PASS, 32 routes, 22 components, zero coverage issues, zero violations, zero `!important` declarations.
- `npm.cmd run typecheck`: PASS.
- `npm.cmd run build`: PASS; production `BUILD_ID` produced.
- `git diff --check`: PASS (line-ending conversion warnings only).

## Output-contract note

`tests/output-contract-smoke.test.ts` does not exist. The repository alternative is `npm.cmd run smoke:output-contract`, which requires a running SafeClaw server at `SAFECLAW_OUTPUT_CONTRACT_BASE_URL` (default `http://127.0.0.1:3110`) and writes files under `evaluation/2026-05-08-output-contract-smoke`. This server-backed smoke is deferred to the integrated browser/server verification task; source-level response contracts and the full repository suite pass here.

## Review state

F6 remains `in_progress` with `passes: false` pending independent specification and code-quality review.

## Independent-review remediation

- Added exact `title`, `section`, `body`, `table`, and `note` roles to the default binary PDF branch. The CID PDF now declares Malgun Gothic regular and bold resources and emits role-specific font size, leading, and tracking operators.
- Covered every editor-preview text owner with a document-scoped rule that defeats the earlier screen/HUD cascade, including approval, metadata labels and values, confirmation rows, tables, notes, and signatures.
- Removed the newly introduced shared `@page` declaration from `formCss`; downloadable HTML/XLS/Word/browser-print behavior retains its prior page-size behavior. The pre-existing PDF-ready HTML A4 rule remains unchanged.
- Replaced broad source substring evidence with independently delimited template checks and direct `POST` invocation for both default binary PDF and `?format=html` responses. Tests assert representative values, order, signatures, status, MIME, disposition, cache headers, PDF magic, font resources, and every typography role.
- Review RED: strengthened suite failed 5 of 9 tests before remediation.
- Review GREEN: generated plus design-contract tests pass 27/27; full suite passes 56 files / 511 tests; static audit, typecheck, build, and diff-check pass.
