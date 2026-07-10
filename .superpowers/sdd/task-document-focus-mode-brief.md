## Task 1: Replace the stacked review/editor page with a focused document surface

### Files

- Modify: `components/SafeGuardCommandCenter.tsx`
- Modify: `app/globals.css`
- Modify: `tests/workspace-layout-regression.test.ts`
- Report: `.superpowers/sdd/task-document-focus-mode-report.md`

### Required behavior

- The generated document review screen must not mount `.field-workspace` before the user clicks `편집`.
- Clicking `편집` or `다운로드 영역 열기` must switch the document step from review mode to editor mode instead of appending the editor below the review page.
- Editor mode must not mount `.document-workbench`.
- Editor mode must expose a `문서 검토로 돌아가기` button that restores the review surface without losing the generated payload or selected document.
- Returning to the input step or generating a new workpack must reset the document surface to review mode.
- The editor bridge must work in both Day and Night. Night must not render white text on a white editor; editor text and background must visibly differ and editor overflow must not be hidden.
- Keep one primary surface per document-step viewport. Do not duplicate `WorkpackEditor` or create a second editor route.

### Acceptance checks

- Existing RED assertion (`.field-workspace` count is currently 1 before edit) becomes GREEN.
- After edit, `.document-workbench` count is 0 and `.field-workspace` count is 1.
- After `문서 검토로 돌아가기`, `.field-workspace` count is 0 and `.document-workbench` count is 1.
- Add Night click-flow assertions for foreground/background contrast, visible overflow, and textarea focus.
- `npm.cmd test -- tests/workspace-layout-regression.test.ts`
- `npm.cmd run typecheck`

### Commit

Commit only the three implementation/test files and this plan/report with:

`fix: focus workspace document editing`
