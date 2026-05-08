# PDF export diagnosis

Date: 2026-05-08

## Diagnosis

`/api/export/pdf` is not currently returning HTML as a `.pdf` for the default POST path. The route has two explicit modes:

- Default POST `/api/export/pdf`: returns `content-type: application/pdf` with a `%PDF-1.4` binary prefix.
- POST `/api/export/pdf?format=html`: returns `content-type: text/html; charset=utf-8` with `<!doctype html>` for browser print.

The actual bug was in the UI caller. `components/WorkpackEditor.tsx` used `fetch("/api/export/pdf")`, then read the response with `response.text()` and wrote it into a print popup. Since the default API response is now a binary PDF, the UI was treating PDF bytes as HTML.

## Fix

Changed the browser-print button to call `/api/export/pdf?format=html` explicitly and added a content-type guard before writing the response into the popup. This keeps the UI honest: the button remains `PDF(브라우저 인쇄)`, and the API default remains a real binary PDF download endpoint.

No PDF library or heavy dependency was added. No XLSX, HWP, TBM, or database files were modified.

## Validation

Route smoke file: `evaluation/2026-05-08-pdf-export-diagnosis/route-smoke.json`

Observed results:

- `pdf_status`: 200
- `pdf_content_type`: `application/pdf`
- `pdf_prefix`: `%PDF-1.4`
- `html_status`: 200
- `html_content_type`: `text/html; charset=utf-8`
- `html_prefix`: `<!doctype html>`

Typecheck command:

```powershell
npm.cmd run typecheck
```

Result: failed on pre-existing/out-of-scope TypeScript errors:

- `lib/ai-deliverables.ts`: unknown values used as index/number types.
- `lib/xlsx-builder.ts`: `string | false` assigned to boolean. This file was already modified by another worker and was not touched.

## Recommended next step

Add a dedicated UI action for direct binary PDF download if product needs one. Keep browser-print on `?format=html`, and reserve default `/api/export/pdf` for real `.pdf` attachment downloads.
