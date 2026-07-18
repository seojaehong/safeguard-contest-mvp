# Share Recipient Portal Polish - 2026-07-18

## Summary

This patch keeps the existing `/share/[sessionId]` recipient portal contract and tightens the worker-facing presentation for demo capture.

The recipient portal already exists on current master. The patch removes default exposure of internal worker/session wording from the happy path and replaces the raw confirmation id with a user-facing saved-history message.

## Changes

- `/share/[sessionId]` now describes the page as a worker document confirmation surface, not an implementation detail.
- Invited worker links with a valid `workerId` no longer show the manual worker id card by default.
- The manual identity card remains available only when the invited session cannot resolve a selected worker.
- Confirmation success no longer prints the raw confirmation id on the worker surface.
- Browser contract now locks that the invited worker page does not expose `작업자 ID`, `세션 방식`, or `확인 ID:`.

## Verification

- `npm.cmd test -- tests/workpack-share-authority-routes.test.ts tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - Result: 1 passed, 1 skipped; 33 passed, 1 skipped before production build.
- `npm.cmd run typecheck`
  - Result: PASS.
- `npm.cmd run build`
  - Result: PASS; 28/28 static pages generated; `/share/[sessionId]` included as dynamic route.
- `npm.cmd test -- tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`
  - Result: 1 file / 1 test PASS with production build.

## Notes

- No database schema or data mutation.
- Existing public share session security contract remains unchanged: invited sessions still require a known worker snapshot unless explicitly configured otherwise.
