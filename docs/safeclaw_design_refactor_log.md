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

## What Changed

- Added a dedicated `SafeClawLanding` component based on the approved dark HUD brand direction.
- Removed the embedded landing block from the command-center workspace.
- Preserved the existing API orchestration, document generation, evidence, export, and dispatch UI under `/workspace`.
- Added link styling for the new landing navigation, CTA, and terminal-style action buttons.

## What Is Not Yet Done

- The full 16-screen prototype has not been fully migrated yet.
- Workspace, document editor, evidence library, workers, dispatch, TBM mode, archive, knowledge DB, API, and settings still need the SafeClaw shell treatment.
- The old command-center CSS remains in use inside `/workspace` until the next screen-by-screen refactor pass.

## Next Pass

1. Replace the `/workspace` shell with the SafeClaw app shell.
2. Split major operational areas into product routes: documents, evidence, workers, dispatch, TBM, archive, knowledge, API, and settings.
3. Keep all existing working features while replacing the presentation layer.
4. Add browser screenshot evidence for desktop and mobile after each screen migration.
