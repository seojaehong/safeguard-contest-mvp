# PDF Pagination Release Gate

- Date: 2026-07-13
- Branch: `fix/pdf-pagination-release-gate`
- Result: PASS
- Scope: PDF route resource budgets and pagination; no database changes

## Fail-Closed Budgets

| Budget | Limit | Enforcement |
| --- | ---: | --- |
| Request body | 262,144 bytes | Rejects an oversized declared `Content-Length` before reading and cancels the body stream when actual bytes cross the limit. |
| Combined input rows | 128 rows | Counts raw PDF/risk/structured row arrays and parsed `documentText` rows without truncation. |
| String field | 4,000 Unicode characters | Iteratively checks every string value in the parsed JSON payload. |
| Binary render lines | 512 lines | Counts the complete wrapped content line list before loading fonts or creating a PDF document. |
| Binary PDF pages | 8 pages | Uses the same line placement function as the renderer to reject an over-budget layout before rendering. |

Every budget failure returns status `413`, `cache-control: no-store`, and the same public response:

```json
{
  "ok": false,
  "code": "PDF_EXPORT_LIMIT_EXCEEDED",
  "message": "PDF 내보내기 요청이 허용된 크기 한도를 초과했습니다."
}
```

No over-budget request is partially rendered or truncated.

## Pagination Regression

The legitimate 64-row fixture still renders across multiple pages. The first page preserves the Korean document title, and the last page preserves sentinel `마지막행보존확인`, the approval line, and the disclaimer.

## TDD Evidence

| Phase | Command | Result |
| --- | --- | --- |
| Budget RED | `npm.cmd test -- tests/pdf-korean-font-integration.test.ts -t "rejects"` | Expected failure: 4 tests received `200`; each required deterministic `413`. |
| Budget GREEN | `npm.cmd test -- tests/pdf-korean-font-integration.test.ts -t "rejects"` | 4 passed, 0 failed, 12 skipped. |
| Pagination GREEN | `npm.cmd test -- tests/pdf-korean-font-integration.test.ts -t "paginates long content"` | 1 passed, 0 failed, 15 skipped. |

## Verification

| Command | Counts | Result |
| --- | --- | --- |
| `npm.cmd test -- tests/pdf-korean-font-integration.test.ts tests/pdf-font-failure.test.ts` | 2 files, 21 passed, 0 failed | PASS |
| `npm.cmd run typecheck` | 0 TypeScript errors | PASS |
| `npm.cmd run build` | compiled in 10.8s; 27/27 static pages generated | PASS |
| `git diff --check` | 0 whitespace errors | PASS |

The focused suite contains 16 Korean PDF integration tests and 5 font-failure tests. Missing or invalid font assets still return controlled `PDF_FONT_ASSET_UNAVAILABLE` responses. Non-font PDF creation and embedding failures are still logged and rethrown.

## Changed Files

- `app/api/export/pdf/route.ts`
- `tests/pdf-korean-font-integration.test.ts`
- `evaluation/pdf-pagination-release-gate-2026-07-13/report.md`
- `evaluation/pdf-pagination-release-gate-2026-07-13/report.json`
