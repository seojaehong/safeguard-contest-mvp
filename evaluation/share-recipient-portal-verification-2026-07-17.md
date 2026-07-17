# Share Recipient Portal Verification

Date: 2026-07-17
Authoritative HEAD before commit: `1692b7926da60ff066f72f64a9c1c9f169a1ad6d`

## What Changed

The worker recipient portal was hardened for the invited-worker share flow:

- The public share-session `GET` response now returns only the matching invited worker hint when `workerId` is provided.
- The recipient page no longer uses `useSearchParams()` directly, avoiding the Next.js render boundary failure observed in browser tests.
- The recipient page now has dedicated Linear/workspace-aligned styling for cards, inputs, select, and confirmation buttons.
- A production-browser smoke test now verifies the mobile recipient portal flow.

## Verification

```powershell
npm.cmd run build
```

Result:

- Production build: PASS
- Static pages: 28/28
- Routes include `/share/[sessionId]` and `/api/share-sessions/[sessionId]`

```powershell
npm.cmd test -- tests/workpack-share-authority-routes.test.ts tests/share-recipient-portal-browser.test.ts
```

Result:

- Test files: 2 passed / 2
- Tests: 31 passed / 31

```powershell
npm.cmd run typecheck
```

Result:

- TypeScript strict typecheck: PASS

## Browser Contract Covered

The new browser test runs the built production app and mocks the public share-session API.

It verifies:

- `/share/[sessionId]?workerId=...` renders below HTTP 400.
- The invited worker display name is visible.
- The invited worker language resolves to Vietnamese (`vi`).
- Mobile viewport has no page-level horizontal overflow.
- Recipient cards stay inside the viewport.
- Input/select/button controls are at least 44px tall.
- Clicking `열람 확인` posts exactly `{ workerId, displayName, languageCode }`.

## Notes

The test intentionally uses the production build when `.next/BUILD_ID` exists. Next dev-mode dynamic route compilation produced an internal worker port collision in this environment, while the production build path is the launch-relevant path for this recipient portal gate.

