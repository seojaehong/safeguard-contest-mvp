# SafeClaw SaaS v1 Task A - Auth/Archive/Reopen Audit

Date: 2026-05-05
Scope: 관리자 로그인, `/archive`, `/api/workpacks`, saved workpack detail/reopen.

## What changed

- Added authenticated workpack detail API: `GET /api/workpacks/[id]`.
- Changed archive list `reopenHref` from generic `/documents` to `/documents?workpackId=<id>`.
- Added client-side reopen handling in current workpack modules: when `workpackId` is present, the documents page reads the Supabase session, fetches the saved detail, stores the reopened payload into `safeclaw.currentWorkpack.v1`, and shows an explicit success/blocker notice.
- Updated `POST /api/workpacks` to preserve full `AskResponse` evidence in existing JSON columns when callers send `data`, without schema changes or migrations.

## Audit findings

- Auth is token-based through the browser Supabase session and server-side `getWorkspaceUser()`. API protection is present, but a dedicated administrator login UI is still not implemented in this patch.
- `/api/workpacks` previously returned saved rows but could not reopen a specific saved workpack because there was no detail endpoint and all archive links pointed to `/documents`.
- Existing saved rows can only be reopened if their stored JSON has enough data to reconstruct `AskResponse`: `scenario`, `deliverables`, `evidence_summary.externalData`, `evidence_summary.riskSummary`, and `status`.
- Older rows saved before this patch may return `canReopen: false` with blockers instead of silently showing local browser data as if it were the server row.

## Verification

- `npm.cmd run typecheck` passed.
- `npm.cmd run build` compiled successfully but failed during page-data collection with existing Next build blocker: `PageNotFoundError: Cannot find module for page: /_document`.
- Build log artifact: `evaluation/safeclaw-auth-archive-reopen-build.log`.

## Remaining blockers

- Administrator login entry point remains product-incomplete: pages refer to login/session, but there is no dedicated Supabase sign-in/sign-out flow in this task scope.
- Workspace generation currently writes local storage; server save requires an authenticated caller to call `POST /api/workpacks`. This patch made the API capable of storing full reopen data, but did not add a new DB mutation flow from the workspace UI.
- Reopen for older workpacks depends on whether previous saves included enough JSON. The new detail API reports exact missing fields instead of faking success.
