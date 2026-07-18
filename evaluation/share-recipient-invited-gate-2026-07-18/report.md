# Share Recipient Invited Gate - 2026-07-18

## Summary

The public share-session GET route now enforces the same invited-worker boundary as the read-confirmation POST route. A share session that requires a known worker snapshot no longer exposes document bodies or recipient messages when the URL is missing `workerId` or contains an unknown worker id.

## Scope

- `app/api/share-sessions/[sessionId]/route.ts`
- `tests/workpack-share-authority-routes.test.ts`

## Behavior

- Invited worker link with a matching `workerId`: returns the one worker hint, documents, and saved worker-language recipient message.
- Anonymous-open session with `anonymousAllowed=true` and `requireKnownWorkerSnapshot=false`: returns session data without recipient hints.
- Invited session without worker identity: returns HTTP 403 and no documents.
- Invited session with an unknown worker identity: returns HTTP 403 and no documents.

## Verification

- `npm.cmd test -- tests\workpack-share-authority-routes.test.ts tests\share-recipient-portal-browser.test.ts tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts --maxWorkers=1 --fileParallelism=false`
  - 3 files passed, 1 skipped
  - 54 tests passed, 4 skipped
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run audit:frontend-consistency`
  - PASS
  - pages: 33
  - components: 23
  - coverage issues: 0
  - violations: 0
- `npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file passed
  - 39 tests passed

## Notes

The browser recipient portal suite is intentionally skipped unless a production `.next` build exists. This patch is a server authority boundary change and was verified through route authority tests plus TypeScript and static frontend consistency gates.
