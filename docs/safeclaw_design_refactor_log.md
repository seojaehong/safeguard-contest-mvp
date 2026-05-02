# SafeClaw Design Refactor Log

## Phase 1 - Landing / Workspace Split

SafeClaw now starts as a branded product site instead of opening directly into the workpack generator.

- `/` renders the new SafeClaw OS landing shell.
- `/workspace` keeps the existing workpack generation flow intact.
- `/?q=...` and `/?scenario=...` redirect to `/workspace` with the same query, so existing scenario links continue to work.
- The first landing CTA opens `/workspace`; the 30-second demo CTA opens `/demo`.

## Phase 1.1 - Copy Tone Down

The landing copy was adjusted from a strong manifesto tone to a safer product explanation tone.

- Navigation labels now describe user intent: product, problem, how it works, foreign worker guidance, evidence, and start work.
- The hero copy now describes a safety document workpack instead of using broad claims about safety itself.
- High-risk wording such as sealed receipt, stable version, and operating system claims was replaced with draft, record, connected APIs, and work history language.
- The CTA and workspace links remain unchanged, so the functional flow is preserved.

## Phase 1.2 - Sixteen-Screen Prototype Map

The designer prototype is now represented inside the app as a navigable product map at `/prototype`.

- Added the 16-screen rail from the prototype: landing A/B, login, home dashboard, workspace A/B, documents, evidence, workers, dispatch, mobile, TBM, archive, knowledge DB, API, and settings.
- Added a SafeClaw HUD shell with left rail, top status bar, active screen area, and route hints.
- Added a `화면 16` landing navigation entry that opens `/prototype`.
- This is a structural product map, not a completed implementation of every screen. Existing working functionality remains under `/workspace`, `/knowledge`, `/dryrun`, and related routes.

## Phase 1.3 - Functional Remap

The 16-screen map now shows how each designer screen maps back to the working SafeClaw product.

- Each screen is tagged as `연결됨`, `부분 연결`, or `이식 예정`.
- Connected screens link to the current working routes such as `/workspace#command`, `/workspace#workpack`, `/workspace#risk`, `/workspace#dispatch-overview`, `/knowledge`, and `/dryrun`.
- The prototype cards now show the mapped target and concrete functional scope instead of generic placeholder copy.
- The landing hero headline was locked to three deliberate lines so Chrome zoom changes no longer orphan `으로` or break the hazard-highlight line.

## Phase 1.4 - Productization Plan

The 16-screen prototype is now treated as a product blueprint instead of a finished set of independent routes.

- `Landing A/B` and `Workspace A/B` are design variants, not separate production destinations.
- The production structure is now framed as 14 product modules plus 2 variants.
- The existing `/workspace` route remains the working engine and should not be disturbed until shell routes are ready.
- Missing modules are explicitly tracked: home dashboard, worker mobile view, TBM fullscreen view, and settings.
- The next implementation pass should add route shells first, then extract working workspace panels into shared components.
- Detailed plan: `docs/safeclaw_16_screen_productization_plan.md`.
- Machine-readable artifact: `evaluation/design-refactor/prototype-productization-plan.json`.

## What Changed

- Added a dedicated `SafeClawLanding` component based on the approved dark HUD brand direction.
- Removed the embedded landing block from the command-center workspace.
- Preserved the existing API orchestration, document generation, evidence, export, and dispatch UI under `/workspace`.
- Added link styling for the new landing navigation, CTA, and terminal-style action buttons.

## What Is Not Yet Done

- The full 16-screen prototype has not been fully migrated yet.
- Workspace, document editor, evidence library, workers, dispatch, TBM mode, archive, knowledge DB, API, and settings still need the SafeClaw shell treatment.
- The old command-center CSS remains in use inside `/workspace` until the next screen-by-screen refactor pass.
- The prototype page still needs a UI pass so it reads as a product blueprint rather than a static gallery.

## Next Pass

1. Add product route shells without moving business logic.
2. Keep `/workspace` intact as the stable engine.
3. Convert `/prototype` copy to "14 modules + 2 variants" and show live/partial/missing status.
4. Extract document, evidence, workers, and dispatch panels only after shell routes are stable.
5. Add browser screenshot evidence for desktop and mobile after each screen migration.
