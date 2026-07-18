# Share Recipient Portal Mobile Fit

## Summary

The worker-facing `/share/[sessionId]` portal exists and is now tuned for the launch-video mobile surface. The previous mobile header kept the shared module decision card in a narrow secondary column, leaving the recipient page feeling cramped. This patch scopes the layout correction to `data-module-route="/share"` only.

## Changed Contract

- Mobile share recipient header uses one column instead of a narrow 118px decision card.
- Mobile share recipient body starts inside a 16px inset so the main "문서팩 검토" heading and cards are not flush with the viewport edge.
- Existing route/API authority rules remain intact: invited worker session, no raw worker ID on happy path, no raw confirmation ID after acknowledgement, no horizontal overflow, and 44px minimum form controls.

## Verification

- `npm.cmd run build`: PASS, 28/28 app pages generated.
- `npm.cmd test -- tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`: PASS, 1/1.
- `npm.cmd test -- tests/workpack-share-authority-routes.test.ts tests/share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false`: PASS, 2 files / 34 tests.
- `npm.cmd run typecheck`: PASS.

## Files

- `app/globals.css`
- `tests/share-recipient-portal-browser.test.ts`

