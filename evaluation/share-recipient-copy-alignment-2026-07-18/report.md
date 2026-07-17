# Share Recipient Copy Alignment

Date: 2026-07-18
Base HEAD before change: 5fef985e

## Scope

The share workflow already has a worker recipient viewer route and API:

- `/share/[sessionId]`
- `/api/share-sessions/[sessionId]`

This patch aligns the manager-side share copy and source tests with the current product contract. The previous sentence said the worker shared-view link would open in a separately approved portal, which made the implemented worker preview flow look unfinished during demos.

## Changes

- Updated the share panel header copy to state that workers open a personal link, review the document pack, and leave confirmation.
- Kept the manager primary CTA focused on dispatch, not a raw share-link CTA.
- Kept the safe preview action as a secondary action: `작업자 화면 미리보기`.
- Updated source-contract tests so they no longer lock the old “별도 승인된 포털” wording.

## Verification

- `npm.cmd test -- tests\workspace-share-simplification.test.ts tests\workflow-share-panel-behavior.test.ts tests\workpack-share-authority-routes.test.ts`
  - 3 files passed
  - 51 tests passed
- `npm.cmd run typecheck`
  - PASS

## Non-goals

- No DB schema change.
- No provider dispatch behavior change.
- No anonymous public sharing change.
- No commit of old `output/playwright/2026-07-10/module-shell-hardening/*.png` screenshot diffs.
