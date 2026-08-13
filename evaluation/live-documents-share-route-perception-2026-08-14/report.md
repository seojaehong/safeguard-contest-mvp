# Live Documents and Workspace Share Route Perception

Verdict: `PASS_LIVE_PRODUCTION_SCOPED_DOCUMENTS_AND_WORKSPACE_SHARE_EXACT_SESSION_GAP`

Source and production are aligned at `85abd3058d523db84cf9d19d2bc5976422550deb`.

## Documents

- Desktop 1440x723: body 723px, workbench 1172x448, core launchers 3, supporting launchers front-visible 0, sticky overlap 0, horizontal overflow false.
- Mobile 390x723: body 723px, workbench 366x495, core launchers 3, supporting launchers front-visible 0, sticky overlap 0, horizontal overflow false.
- The reported 2070px body stack was not reproduced on the current live default route. Long selected content remains contained in the workbench flow rather than extending the page body.

## Workspace Share

- Desktop 1440x723: root width 1180px with three columns of 509px configuration, 400px message preview, and 227px status rail.
- Mobile 390x723: one 304px column, desktop status rail hidden, horizontal overflow false.
- The desktop route is not using the mobile single-column presentation in this measured state.

## Boundary

This is scoped proof for the current live `/documents` default route and the generated workspace Share stage. It does not reproduce or prove a user-specific exact saved `/share/[sessionId]` session. Exact saved Share remains `MISSING_EVIDENCE`; no Share session was created and no DB, provider, vector, wiki, or KOSHA registry mutation occurred.

Route splitting alone is not accepted as the fix. The target remains a three-step route shell with a first-viewport cockpit and bounded selected detail/internal scroll.
