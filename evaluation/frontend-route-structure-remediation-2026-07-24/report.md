# SafeClaw Documents and Share Structure Remediation Note

Checked at: 2026-07-24

Current local and production commit: `680f6ecbbe945302518dc634f3d2b0ebbca17612`

## Verdict

The remaining user-visible problem is not solved by splitting pages alone.

`/documents` and `/share` can still feel like long mobile pages if each route renders every control, every document body, every channel card, and every provenance block in the main document flow. The right product fix is a viewport-first cockpit/workbench structure:

- each route gets one clear first viewport;
- only the selected document or selected share preview is open by default;
- long text belongs inside a bounded workbench scroll region;
- secondary documents, provenance, and advanced delivery settings start collapsed;
- desktop share must own an explicit two or three pane grid, not inherit the mobile card stack.

## Why the user can still be seeing the issue

The codebase already contains part of the intended direction:

- `components/CurrentWorkpackModules.tsx:778` defines `DocumentCockpit`.
- `components/CurrentWorkpackModules.tsx:967` renders `.safeclaw-documents-workbench`.
- `components/FieldOperationsWorkspace.tsx:1234` switches `surface === "share"` into `field-workspace-share-only`.
- `app/globals.css:14967` and nearby selectors try to give `workspace-page-share` a desktop grid.

However, the route still has several structural risks:

1. `/documents` can have nested navigation: outer document cockpit plus inner `WorkpackEditor` sidebar. That makes the page look longer than the route split suggests.
2. `/share` uses `WorkflowSharePanel` across multiple surfaces. Desktop behavior is encoded through several route-specific selectors, so it can fall back to the mobile-like card stack if a wrapper class or exact route selector is absent.
3. Existing evidence files for documents/share were created at older source heads (`e70be8e` and `eb891f3`) while current production is `680f6ecb`. They are useful historical evidence, but they do not fully prove the current production route.
4. Exact saved `/share/[sessionId]` evidence remains missing because creating or loading a real saved share session can cross a database mutation boundary. That needs an explicit approved flow or a concrete existing saved URL.

## Recommended implementation shape

### 1. Documents route

Target mental model: "document cockpit on the left/top, selected editor on the right/below."

Desktop:

- Use a stable two-column workbench.
- Left pane: core three documents, supporting document index, export/provenance summary.
- Right pane: exactly one selected `WorkpackEditor` document.
- Hide or remove the duplicated inner `WorkpackEditor` sidebar on `/documents`.
- Keep the editor pane height bounded to the viewport and make only the editor body scroll.

Mobile:

- First viewport: core three launcher and current selected document action.
- Supporting nine documents under a collapsed details region.
- Full generated document text is not shown until the user selects a document or opens source/raw mode.
- Page body should not become a full stack of all document bodies.

Suggested route contract:

- visible selected editors: `1`
- visible full document bodies by default: `0`
- core document buttons: `3`
- horizontal overflow: `false`
- body height target: within one viewport plus a small browser rounding allowance
- editor scroll ownership: editor panel may scroll; page shell should not require multi-screen scanning before the first useful action

### 2. Share route

Target mental model: "dispatch manager, not mobile preview page."

Desktop:

- Left pane: targets, permissions, channels, primary send/export action.
- Right pane: sticky preview and persistent provenance/status.
- Optional bottom/side rail: delivery result, audit trail, missing capability warnings.
- Channel cards should be compact rows, not full mobile cards.
- Preview text may scroll inside its own panel.

Mobile:

- Keep the compact stacked flow, but use a top summary and collapse advanced target/channel details.
- Show the selected language preview early.
- Keep provenance/source identity sticky or repeated near the action.

Suggested route contract:

- at desktop width, `.share-panel.workflow-panel` must compute to grid with at least two columns;
- `[data-share-preview]` should occupy a distinct preview column;
- `.share-form-shell` should not force a single-column mobile stack at desktop width;
- first actionable delivery control must be in the first viewport;
- exact saved `/share/[sessionId]` must be measured separately from `/workspace` share step.

## What not to do

- Do not claim this is fixed from route split alone.
- Do not hide failures by lowering the audit thresholds.
- Do not wholesale merge `app/globals.css`, `SafeGuardCommandCenter`, `WorkpackEditor`, or backend-owned shared files from stale branches.
- Do not treat `/workspace` share-step evidence as proof for exact saved `/share/[sessionId]`.

## Current dirty-state note

This worktree currently has three uncommitted files:

- `app/globals.css`
- `evaluation/documents-cockpit-workbench-geometry-2026-07-22/run-documents-cockpit-workbench-geometry.mjs`
- `tests/documents-editor-layout.test.ts`

The visible CSS diff appears to hide the duplicated inner `.workpack-sidebar` on `/documents` and force the document editor area into one column. That direction matches the cockpit/workbench recommendation, but it is a frontend product edit and should not be pushed from this read-only coordination lane unless the main session explicitly assigns ownership.

## Message to main session

Please verify whether current production `680f6ecb` actually contains the intended Documents and Share structural remediation.

Observed request context:

- User still sees Documents as too long.
- User still sees Share as mobile-like on desktop.
- User is asking whether the fix is present but not visible, or whether it was not actually fixed.

Requested checks:

1. Re-run current-production browser geometry for `/documents`, `/dispatch`, workspace share step, and exact saved `/share/[sessionId]` if an approved existing URL is available.
2. For `/documents`, assert selected-only workbench and no duplicated inner editor navigator.
3. For `/share`, assert desktop two/three pane grid and a distinct preview column at desktop width.
4. Keep exact saved share evidence separate from workspace share-step evidence.
5. If still failing, implement a bounded viewport-first cockpit/workbench remediation rather than another page split only patch.

