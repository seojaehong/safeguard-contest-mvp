# Share Recipient Confirmation Authority Fix

Date: 2026-07-18
Branch: integrate/kosha-wave3-main-20260718
Base HEAD: 499db1b755c19adf4139fd924962a6e5037326bc

## Summary

The public recipient confirmation route now treats the worker id embedded in the share link query string as authoritative over any worker id sent in the request body.

This closes a confirmation spoofing gap where an invited worker link could submit a different `workerId` in the body and record the acknowledgement against another recipient snapshot in the same share session.

## Changed Files

- app/api/share-sessions/[sessionId]/route.ts
- tests/workpack-share-authority-routes.test.ts

## TDD Evidence

RED:

- Command: `npm.cmd test -- tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: failed before the route fix because the forged body `workerId` was selected over the link `workerId`.

GREEN:

- Command: `npm.cmd test -- tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 1 file / 34 tests PASS.

Focused share regression:

- Command: `npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workflow-share-client.test.ts tests\workflow-share-panel-behavior.test.ts tests\workspace-share-simplification.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: 6 files / 85 tests PASS.

TypeScript:

- Command: `npm.cmd run typecheck`
- Result: PASS.

Build:

- Command: `npm.cmd run build`
- Result: BLOCKED on current HEAD by an unrelated Next prerender error for `/404`: `<Html> should not be imported outside of pages/_document`.
- The build was rerun after safely removing only the local `.next` artifact and failed with the same error.
- Source search found no `next/document` import or `<Html>` usage in `app`, `components`, or `lib`; this blocker is recorded separately from the share confirmation route change.

## Product Impact

- Recipient links remain invited-only.
- A recipient can still confirm from a public share URL.
- Body-provided manual identity is still allowed only when the URL has no authoritative worker id.
- Server-side recipient snapshot remains the source of truth for known workers.
