# SafeClaw Workspace UI/UX Browser Check

Date: 2026-07-08

## Scope

- Target route: `/workspace`
- Implementation target: 3-step workbench (`입력 -> 문서 -> 공유`) with risk assessment/TBM focus.
- Visual target: extreme-simple white editorial workbench variation based on the Cohere-style reference document.
- DB principle: no schema migration in Phase 1.

## Implemented Changes

- Replaced the visible 6-step workspace flow with 3 steps: `입력`, `문서`, `공유`.
- Removed the workspace sidebar and moved field context into compact input chips.
- Added a `근거 준비 레일` under the input: high-risk cases, KOSHA references, ontology graph, work history, weather.
- Added staged generation feedback: weather, law, SIF/KOSHA DB, ontology QA, document generation.
- Focused the document view on `위험성평가표`, `TBM 브리핑`, `TBM 기록`.
- Collapsed remaining documents behind `+ 9개 문서 더 보기`.
- Added a document-level evidence/quality panel for direct evidence, supporting evidence, quality contract, and ontology QA.
- Expanded sharing into scope, permissions, confirmation status, persistence ledger, and improvement loop.
- Added Before/After photo attachment UI for today's improvements. Phase 1 stores the generated candidate and file names locally; actual vision-model analysis and file persistence remain Phase 2.
- Added manual language switching and acknowledgement state to the worker mobile view.
- Simplified the first screen into one large question, one textarea, one primary action, and a thin evidence-readiness rail.
- Replaced the long-scroll workspace with page-state rendering: `input`, `document`, and `share`.
- Removed first-screen DOM rendering for document, share, and empty-workspace sections.
- Moved generation feedback into the document page loading state.

## Browser Evidence

- Desktop viewport: `workspace-desktop-v5-simple-viewport.png`
- Desktop full page: `workspace-desktop-v5-simple.png`
- Mobile viewport: `workspace-mobile-v5-simple-viewport.png`
- Mobile full page: `workspace-mobile-v5-simple.png`
- Before/After photo flow: `workspace-photo-analysis-v5-simple.png`
- Page-state desktop initial: `workspace-input-page-v7.png`
- Page-state desktop document transition: `workspace-document-page-v7.png`
- Page-state mobile initial: `workspace-input-page-mobile-v7.png`

## Browser Probe Results

- Desktop `/workspace`: 3 step buttons, no visible sidebar, 5 evidence rail items, `+ 9개 문서 더 보기`, no horizontal overflow.
- Desktop layout: white canvas, centered workbench region, H1 `오늘 작업은 무엇인가요?`, primary CTA `안전 문서 생성`.
- Mobile `/workspace`: CSS-width mobile breakpoint verified with 3 grid step buttons, hidden topbar status, no horizontal overflow.
- Before/After photo test: 2 image inputs accepted test image files, 2 previews rendered, image-analysis candidate panel appeared.
- Worker `/worker`: 6 language buttons rendered, manual language switch copy visible, acknowledgement button visible.
- Page-state desktop initial probe: input page 1, document page 0, share page 0, evidence panel 0, output grid 0, dispatch panel 0, empty workspace 0, no horizontal overflow.
- Page-state desktop after submit probe: input page 0, document page 1, share page 0, evidence panel 1, output grid 1, dispatch panel 0, empty workspace 0, active step `문서`.
- Page-state mobile initial probe: input page 1, document page 0, share page 0, evidence panel 0, output grid 0, dispatch panel 0, empty workspace 0, no horizontal overflow; evidence readiness rail renders as a two-column grid.

## Acceptance Checks

- `/workspace` first screen should expose one main action: field situation input and generation.
- Step indicator should show only three steps.
- Twelve document cards should not dominate the first document view.
- Mobile layout should avoid horizontal overflow.
- Sharing should read as a product completion loop: scope, recipients, confirmation, persistence, improvement candidates.
- Today's improvement capture should allow Before/After photos and return a reviewable improvement candidate.
- First load should not render document, share, or empty-workspace sections below the input page.
- Submitting generation should move users to the document page, where loading and evidence matching are shown.

## Remaining Phase 2 Work

- Persist share sessions and read confirmations after DB approval.
- Persist Before/After improvement photos and run real image analysis.
- Promote reviewed improvements into `workpack_improvements` and, after review, the published operational ontology.
