# SafeClaw UI State Root-Cause Audit

Date: 2026-07-10

Scope: current `feature/backend-harness-gate` worktree and relevant git history only. No production code, database state, or existing artifacts were changed.

## Evidence

- `npm.cmd test -- tests/workspace-generation-progress.test.ts tests/workspace-layout-regression.test.ts`: 2 files, 19 tests passed (77.45s).
- Local Playwright reproduction against the current worktree's dev server:
  - input shell checked in Day/Night at `1440x720`, `1024x319`, and `390x844`, before and after scrolling;
  - generated a template workpack, clicked `편집`, and inspected computed styles in Day and Night at `1440x900`.
- The audit observed unrelated untracked `docs/superpowers/`, `evaluation/crunch/`, and `output/playwright/2026-07-10/` paths, plus an external modification to `tests/workspace-layout-regression.test.ts`. They were not changed by this audit.

## Findings

### P1 - Night edit surface is a white-on-white legacy style collision

`편집` does not navigate to a legacy route. `focusWorkpackEditor` selects the document key, switches the page to `document`, increments the focus token, and scrolls to the top at `components/SafeGuardCommandCenter.tsx:1094-1100`. The document page passes those props into `FieldOperationsWorkspace` at `components/SafeGuardCommandCenter.tsx:2404-2409`, which mounts the same `WorkpackEditor` at `components/FieldOperationsWorkspace.tsx:1041-1046`. Its focus effect selects the requested tab and focuses the textarea at `components/WorkpackEditor.tsx:1898-1918`.

The break is CSS scope, not navigation or React focus state:

- Night root tokens set `--workspace-ink: #f7f8f8` at `app/globals.css:11214-11230`.
- The legacy editor base makes its panel white and clips overflow at `app/globals.css:4925-4934`.
- The current workbench bridge overrides that legacy editor only under `.workspace-theme-day` at `app/globals.css:16030-16135`; there is no corresponding Night selector.

Actual Night reproduction after clicking `편집`: `.document-editor` was `background: rgb(255, 255, 255)`, `color: rgb(247, 248, 248)`, `overflow: hidden`, `border-radius: 4px`; `.document-editor .h2` was also `rgb(247, 248, 248)`. The document title is therefore effectively invisible on the white panel. Day had the intended bridge: transparent workpack shell, white editor with `rgb(23, 25, 29)` text, visible overflow, and 10px panel radius.

Smallest failing browser test to add in `tests/workspace-layout-regression.test.ts`:

1. Reuse the existing mocked template workpack and `편집` click flow at `tests/workspace-layout-regression.test.ts:836-1018`.
2. Parameterize it for `theme=day` and `theme=night`.
3. For both themes assert editor foreground contrast, not a palette-specific value: editor title color must differ from editor background; `.document-editor` must not be `overflow: hidden`; focus must remain on `.document-textarea`.

This fails immediately for current Night and protects the actual click path rather than an isolated CSS selector.

### P1 - "12/12 complete" is driven by payload presence, while QA/share remains blocked

The final payload state transition conflates generation completion with readiness. `applyGeneratedPayload` persists the payload, sets `data`, changes `state` to `ready`, and opens the document page without consulting QA/readiness at `components/SafeGuardCommandCenter.tsx:1535-1544`. `assessWorkpackReadiness` independently blocks sharing for ontology verdict, quality contract, DB-harness evidence, and approval placeholders at `lib/workpack-readiness.ts:45-67`.

The progress model receives neither readiness nor QA status. Its first branch is `hasData`, which always returns `12/12` and "문서팩 준비가 끝났습니다." at `lib/workspace-generation-progress.ts:38-45`. The view feeds it only `hasData`, `state`, console lines, total, and citations at `components/SafeGuardCommandCenter.tsx:1660-1685`, then renders that 100% meter at `components/SafeGuardCommandCenter.tsx:2045-2074`.

In the same rendered result, QA correctly says "검수 필요": `buildGenerationStages` makes the safety-check stage warning when quality is not ready at `components/SafeGuardCommandCenter.tsx:495-537`; the share page remains blocked via `lib/workspace-pages.ts:42-69`. There is no evidence of a sharing-permission bypass. The defect is contradictory operator state: completion looks final at the progress meter while the workpack is explicitly not shareable.

Smallest failing tests to add:

1. Extend `tests/workspace-generation-progress.test.ts:90-102` with a final payload whose ontology QA is reviewable/non-passing, quality is degraded, DB harness has missing evidence, and approval placeholders remain. The expected post-payload surface must distinguish `generation complete` from `share ready`; do not accept unconditional completion copy.
2. Add one Playwright assertion to the existing generated-workpack flow: for that blocked payload, the progress summary must not present a bare `12/12` completion state without an adjacent blocked/QA qualifier, while the share navigation remains blocked.

### P2 - Template mode has no repaintable progress source; enhanced/full do

`generateWorkpack` explicitly sends template mode through the legacy `/api/ask` request at `components/SafeGuardCommandCenter.tsx:1559-1572`; it does not emit console lines. During that await, `buildGenerationProgressState` has no data and no lines, so it produces the synthetic `3/12` baseline at `lib/workspace-generation-progress.ts:47-73`, then jumps to `12/12` when the payload arrives. There is no intermediate progress to repaint.

Enhanced/full uses `/api/ask/stream`, reduces each SSE event with `nextConsoleLines`, and updates React state at `components/SafeGuardCommandCenter.tsx:1574-1578`. The reducer upserts stage and document rows at `lib/agent-console-copy.ts:99-148`, so the enhanced/full path has a valid repaint loop. The existing pure tests cover the reducer/progress calculation but not that rendered SSE wiring: `tests/workspace-generation-progress.test.ts:25-102` and `tests/agent-console-copy.test.ts:31-114`.

Smallest failing browser test to add:

1. Route `/api/ask/stream` with staged SSE chunks separated by short delays.
2. Start enhanced generation and assert the visible meter advances after the first stage event, the agent console changes from active to terminal on its matching event, and it stays below `12/12` until the final payload is applied.
3. Separately choose and test the template product contract: either label its meter as indeterminate while `/api/ask` is pending, or add an actual streaming/progress source. A test expecting an intermediate numeric repaint in the current template path will fail by design.

### Header and sticky-position audit - historical root cause is guarded in the current tree

The prior overlap root cause was a cascade of presentation passes that could turn the workspace chrome into a positioned overlay. The current explicit guard was added in history by `95b8414` / `2d54116` / `f287865`: `app/globals.css:14948-15026` forces the workspace topbar to `position: relative !important`, clears all inset properties and transforms, gives it `z-index: 2`, and places the viewport at `z-index: 1`. The base topbar is also relative at `app/globals.css:699-715`.

Current computed-style evidence found no active header/content overlap: for all six Day/Night and desktop/short/mobile combinations above, the topbar was `relative`, its bottom preceded the viewport by 26-32px before scroll, and it scrolled away instead of covering content. Existing coverage includes Night desktop scroll at `tests/workspace-layout-regression.test.ts:61-103` and Day short-screen checks later in that file, but does not run the full viewport matrix for both themes.

Remaining sticky elements are scoped to content, not the workspace header: `.workspace-side` at `app/globals.css:5616-5619` and `.document-evidence-panel` at `app/globals.css:12227-12230` / `12668-12677`. The Night outer layout still uses `overflow: hidden` at `app/globals.css:11363-11372`, which confines nested sticky behavior and increases cascade fragility, but it did not reproduce a header overlap in the current build.

Regression test to retain/add: parameterize the existing topbar scroll geometry check for both themes at desktop, `1024x319`, and mobile. Assert computed `position === "relative"`, `topbar.bottom <= viewport.top - 8` before scroll, and `topbar.bottom <= 0` after scrolling when the page can scroll.

## Minimal Repair Direction

1. Make the generated-editor bridge theme-neutral, then apply Day/Night token values at the theme root; do not duplicate the workpack component or route `편집` elsewhere.
2. Model `generationComplete` and `shareReady` as separate UI concepts. QA/readiness must be an input to the final progress copy/status, not a secondary warning rendered after a universal 100% completion claim.
3. Keep the current topbar guard; consolidate the multiple workspace visual passes before changing sticky/fixed behavior.
