# SafeClaw Playwright Notice Fix

Date: 2026-05-05

Verdict: `pass_with_notice`

## Fixed

- Favicon request now returns `200` with a valid `public/favicon.ico` file.
- Metadata now advertises both `favicon.ico` and `favicon.svg`.
- The foreign-worker language picker is now scroll-contained, so Playwright can select the Vietnamese message chip.
- Vietnamese selection updates the preview to `외국인 근로자 전송본 · 베트남어(Tiếng Việt)`.

## Notice

- The `PDF(브라우저 인쇄)` button is present and invokes the browser print flow.
- Playwright cannot complete through the native browser print dialog in this harness, so this remains a harness limitation rather than a product failure.
- If SafeClaw needs fully automated PDF file verification later, the next step is a server-side binary PDF renderer.

## Verification

- `npm.cmd run typecheck`: pass
- `npm.cmd run build`: pass
- Local target: `http://127.0.0.1:4317`
- Logs:
  - `evaluation/playwright-fix-local-server.log`
  - `evaluation/playwright-fix-local-server.err.log`
