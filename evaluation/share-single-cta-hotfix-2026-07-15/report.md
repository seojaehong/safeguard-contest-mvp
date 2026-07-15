# Share single CTA hotfix

- Source branch: `feat/phase-a-evidence-integration`
- Scope: hide the initial share action group while the send confirmation panel is open.
- Product files: `components/WorkflowSharePanel.tsx`
- Regression files: `tests/workspace-share-simplification.test.ts`
- Focused verification: 3 files, 39 tests passed.
- TypeScript: strict typecheck passed.
- Data/API/DB changes: none.

The confirmation step now exposes only `지금 전송` (or `저장 후 전송`) as its primary action. The previous `문서팩 전송하기` action and message-copy action are removed from that state.
