# SafeClaw Workspace UI/UX Browser Check

Date: 2026-07-08

## Scope

- Target route: `/workspace`
- Primary design target: Day/Night selectable commercial workbench.
- Night target: Linear-like dark app shell.
- Day target: light field-operations cards with the same structure for outdoor/mobile readability.
- Product structure: `입력 -> 문서 -> 공유`, with risk assessment/TBM focus, cited evidence rail, and improvement loop.
- DB principle: no schema migration in Phase 1.

## Implemented Changes

- Kept `/workspace` as a page-state workbench rather than a long scroll page.
- Reframed the shell as a Linear-style app surface: near-black canvas, left navigation, compact topbar, hairline borders, restrained lavender accent, subtle glass only on shell surfaces.
- Added in-page Day/Night theme selection. Existing `/workspace?theme=field`, `/workspace?theme=day`, and `/workspace?theme=light` open the Day mode for compatibility.
- Updated the Day mode after designer feedback: white background, rounded grouped cards, black titles, deep-gray body copy, wider menu spacing, no empty closed option boxes.
- Increased typography breathing room: letter spacing stays `0`, line-height and textarea/pre spacing were opened to reduce the cramped feeling.
- Added optional front-loaded field-photo hazard input. It creates `위험요인 후보`, not confirmed risk findings, and only appends candidates after user action.
- Replaced the document page with a single workbench: left core document list, center document preview, right cited evidence rail.
- Kept first document exposure to `위험성평가표`, `TBM 브리핑`, `TBM 기록`; the remaining documents stay behind `+ 9개 문서 더 보기`.
- Moved generation logs into a collapsible `작업 이력` block.
- Removed user-facing debug copy such as camelCase document keys, `fallback`, and `온톨로지 QA`.
- Reworked sharing as a product completion loop: permission, role, acknowledgment, evidence, and improvement capture.
- Removed phone mockup and hazard stripe UI from the new share workflow.
- Added Before/After improvement capture for the day's work. Phase 1 stores local candidates and file names; actual image persistence and full vision analysis remain Phase 2.
- Clarified KRAS direction as `KRAS 입력 준비 내보내기`: structured export/checklist for manual KRAS entry, not KRAS scraping, unofficial API use, or automatic submission.

## Browser Evidence

- Night input: `workspace-night-input-v12.png`
- Day input: `workspace-day-input-v12.png`
- Day mobile input: `workspace-day-mobile-v12.png`
- Day document completed: `workspace-day-document-ready-v9b.png`
- Day share/improvement workflow: `workspace-day-share-v9b.png`
- Machine summaries:
  - `workspace-day-night-v12-summary.json`
  - `workspace-day-share-v9b-summary.json`

## Browser Probe Results

- Desktop `/workspace`: no horizontal overflow, no phone mockup, no hazard stripe, no raw camelCase, no `fallback`/`산문` user-facing copy.
- Desktop Day/Night selection: theme toggle rendered, closed `고급 설정` and `예시 불러오기` have no empty bordered container.
- Desktop `/workspace?theme=day`: light field card mode applied, no horizontal overflow.
- Mobile `/workspace?theme=day`: viewport width 390px, no horizontal overflow, evidence cards stack to one column.
- Input photo hazard panel rendered in desktop and mobile. It is framed as candidate discovery, not automatic risk determination.
- Document completion check: `12/12`, `문서팩을 준비했습니다`, placeholder removed, evidence rail rendered, document preview contains real risk assessment text.
- Share check: share workflow title rendered, confirmation/evidence/improvement capture visible, no phone mockup or hazard stripe.
- A stale dev-server manifest error appeared once immediately after `next build`; restarting the dev server cleared it. The final strict document-ready probe had zero console errors.

## Verification Commands

- `npm.cmd test -- tests/operation-improvements.test.ts tests/agent-console-copy.test.ts tests/workpack-ontology-qa.test.ts tests/quality-contract.test.ts tests/workspace-pages.test.ts`
  - 5 files passed, 27 tests passed.
- `npm.cmd run typecheck`
  - passed.
- `npm.cmd run build`
  - passed.

## Acceptance Checks

- First screen exposes one main job: enter field situation and generate safety documents.
- Step model is three states only: input, document, share.
- The 12-document output no longer dominates the document view.
- Document view supports cited-source review beside the selected document.
- Mobile and desktop avoid horizontal overflow.
- Sharing reads as a product ending: permission, recipient/role, acknowledgment, persistence, and improvement capture.
- Narrative + photo input can surface hazard candidates before generation without claiming automatic judgment.
- The day's improvement capture supports Before/After photos as Phase 1 candidates.

## Added Phase 2 Planning Item

The new reporting/download request is additive, not a direction change. It should be added as a second module:

- Workbench remains the authoring surface.
- Reports becomes the period/filter/export surface.
- Every export should render from one canonical JSON snapshot to avoid PDF/HWPX/XLSX drift.
- KRAS should stay as manual input preparation: `KRAS 입력 준비 내보내기`, not automatic submission.
- SIF/KOSHA/workpack history should improve retrieval and QA through the evidence harness, not be described as product-level model fine-tuning.
- See `reporting-downloads-phase2.md` for the proposed IA, classification axes, export formats, and implementation split.
