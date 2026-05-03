# SafeClaw Archive/PDF Closure Report

Date: 2026-05-03
Branch: `codex/document-format-cta`

## Scope

This pass closes the first two remaining operational gaps without changing database schema or mutating existing records.

1. Server-side history browser path for saved workpacks and dispatch logs.
2. Server-side PDF-ready submission output path for the document editor.

HWPX pixel-perfect reproduction remains gated on the newly provided HWPX source forms and the TBM/form parsing workstream.

## Changes

### Server archive read path

- Added `GET /api/workpacks`.
- Added `GET /api/dispatch-logs`.
- Both routes:
  - use the existing Supabase admin client and authenticated workspace user;
  - return `configured: false` when Supabase is not configured;
  - return `401` with a Korean login-required message when no authenticated user session is present;
  - scope query results to organizations owned by the logged-in user;
  - normalize response fields for the archive UI.

### Archive UI

- `/archive` can now load server history through the browser Supabase session.
- The UI clearly separates:
  - browser-local current snapshot;
  - server-backed workpack history;
  - server-backed dispatch log history.
- The route no longer implies that local snapshots are submission-grade evidence.

### PDF output path

- Added `POST /api/export/pdf`.
- The endpoint returns a server-generated A4 print-ready HTML document with:
  - approval cells;
  - site/work/weather metadata;
  - risk level and top-risk callout;
  - sectioned table rows;
  - signature and storage fields;
  - submission disclaimer.
- `WorkpackEditor` now calls the server print source first for `PDF 저장/인쇄`.
- If the server print source fails, the editor falls back to the existing client-side HTML print flow.

## Verification

- `npm.cmd run typecheck`: pass.
- `npm.cmd run build`: pass.
- `npm.cmd run smoke:quality-matrix`: pass, 100/100 local deterministic matrix.
- `npm.cmd run smoke:ui-local`: timed out. The generated artifact at `evaluation/local-smoke/local-ui-regression-smoke.json` shows the local route loaded, but document generation did not reach the expected `LLM 위키·지식 DB 확인` marker within the script timeout. This is recorded as a smoke gap, not hidden.

## Remaining Gaps

- This is not a binary PDF renderer with embedded Korean fonts. It is a server-generated print source that the browser can save as PDF.
- HWPX output still uses the current text-based `@rhwp/core` path, not a pixel-perfect reproduction of every supplied source form cell.
- Actual Supabase ingestion of newly uploaded safety forms is intentionally not performed here. Russell/Hilbert are preparing ingestion candidates only; final ingestion remains gated by review.
