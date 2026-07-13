# PDF Pagination Release Gate

- Date: 2026-07-13
- Branch: `fix/pdf-pagination-release-gate`
- Result: PASS
- Scope: binary PDF pagination only; no database changes

## Fix

- Removed the binary PDF caps that truncated source rows and wrapped row lines.
- Added deterministic page creation when the next line would cross the 48-point bottom margin.
- Registered the existing Korean Regular/Bold subset fonts on every generated page.
- Preserved the document title on the first page and the final approval/disclaimer footer after the last source row.

## TDD Evidence

| Phase | Command | Result |
| --- | --- | --- |
| RED | `npm.cmd test -- tests/pdf-korean-font-integration.test.ts -t "paginates long content"` | Expected failure: 1 page was generated; assertion required more than 1 page. |
| GREEN | `npm.cmd test -- tests/pdf-korean-font-integration.test.ts -t "paginates long content"` | 1 passed, 0 failed, 11 skipped. |

The regression fixture submits 64 rows and verifies that the PDF has more than one page, the first-page Korean title remains extractable, and the last-page sentinel `마지막행보존확인`, approval line, and disclaimer remain extractable.

## Verification

| Command | Counts | Result |
| --- | --- | --- |
| `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/pdf-font-failure.test.ts` | 2 files, 17 passed, 0 failed | PASS |
| `npm.cmd run typecheck` | 0 TypeScript errors | PASS |
| `npm.cmd run build` | compiled in 33.9s; 27/27 static pages generated | PASS |
| `git diff --check` | 0 whitespace errors | PASS |

The focused suite includes 12 Korean PDF integration tests and 5 font-failure tests. Missing/invalid font assets still return controlled `PDF_FONT_ASSET_UNAVAILABLE` responses, while non-font PDF creation and embedding failures are still logged and rethrown.

## Changed Files

- `app/api/export/pdf/route.ts`
- `tests/pdf-korean-font-integration.test.ts`
- `evaluation/pdf-pagination-release-gate-2026-07-13/report.md`
- `evaluation/pdf-pagination-release-gate-2026-07-13/report.json`
