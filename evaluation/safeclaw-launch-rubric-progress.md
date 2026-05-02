# SafeClaw launch rubric progress

## Scope
This pass closes the biggest launch-readiness gap after the 16-screen remap: product routes must not be static prototype cards. They need to read the latest generated workpack and route the user into the real document, evidence, dispatch, and archive flow.

## Changes verified by code
- `/documents` now shows a launch document cockpit before the existing editor: document index, primary three documents, evidence count, and output readiness.
- Document index clicks call the actual `WorkpackEditor` focus contract, so selecting a document moves the real editor tab instead of only changing a hash.
- `/archive` now reads the same latest current workpack snapshot used by `/documents`, `/evidence`, `/workers`, and `/dispatch`.
- Archive no longer presents only API contracts. It shows the latest workpack summary and routes back to documents, evidence, and dispatch.
- Existing `/workspace` engine remains untouched as the stable generation/edit/export baseline.

## Launch rubric status
- Workpack generation: connected through `/workspace` and local current-workpack snapshot.
- Documents: connected, with 3-pane product context plus full editor/download engine.
- Evidence: connected to current citations, KOSHA references, accident cases, and knowledge links.
- Workers: connected to current scenario-derived workers and education state display.
- Dispatch: connected to current workpack and n8n dispatch panel.
- Archive: upgraded from static API plan to current workpack continuity.

## Remaining launch gaps
- Persistent Supabase archive list requires login/session wiring and should be completed after DB confirmation.
- Prototype-only routes such as worker mobile, TBM fullscreen, and settings still need dedicated implementation or clear beta labels.
- Pixel-perfect final landing is intentionally deferred until the designer's final handoff is applied.
