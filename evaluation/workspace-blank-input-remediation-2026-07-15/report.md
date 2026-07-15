# Workspace blank input remediation

## Scope

- Route: `/workspace`
- Viewport: 390 x 844, Day theme
- Product issue: blank generation silently returned without a visible error or focus recovery.

## Change

- Blank submit renders `현장 상황을 입력해 주세요.` as a live alert.
- The situation textarea receives `aria-invalid=true` and focus.
- Editing clears the error state.
- Blank submit does not call `/api/ask`.
- The compact mobile layout continues to hide the normal helper copy; only the error exception is visible.

## Verification

- TDD RED: alert was missing from the product surface.
- Focused browser test: 1 passed, 24 skipped.
- Strict TypeScript: passed.
- Frontend static contract: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- `git diff --check`: passed.

## Files

- `components/SafeGuardCommandCenter.tsx`
- `app/globals.css`
- `tests/workspace-layout-regression.test.ts`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`

