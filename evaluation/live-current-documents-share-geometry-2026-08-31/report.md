# Live current Documents and Share geometry

## Verdict

`PASS_LIVE_PRODUCTION_CURRENT_DOCUMENTS_AND_SCOPED_WORKSPACE_SHARE_GEOMETRY`

Measured against production commit `3dda5436e672f602aa57829c1b76c739e7b04e2c` at `https://www.safeclaw.kr` on 2026-08-31. The current default Documents cockpit and authenticated Workspace Share stage pass their viewport contracts. This receipt does not prove an exact saved `/share/[sessionId]` user session.

## Documents

| Viewport | Body | Workbench | Documents | Sticky overlap | Overflow |
| --- | --- | --- | --- | --- | --- |
| 1440x723 | 723px, ratio 1.00 | 448/868px, internal `auto` scroll | core 3 visible, support 9 closed, 12 unique | 0 | none |
| 390x723 | 723px, ratio 1.00 | 352/873px, internal `auto` scroll | core 3 visible, support 9 closed, 12 unique | 0 | none |

The visible core set is `riskAssessmentDraft`, `tbmBriefing`, and `tbmLogDraft`. The reported 2070px body-height state was not reproduced on the current default route.

## Workspace Share

| Viewport | Body | Root | Layout | First action | Overflow |
| --- | --- | --- | --- | --- | --- |
| 1440x723 | 723px, ratio 1.00 | 1180x521px | 508.477 / 399.523 / 227px three-zone grid | bottom 389px | none |
| 390x723 | 723px, ratio 1.00 | 336x431px | 303px single-column mobile stack; desktop rail hidden | bottom 705.25px | none |

Desktop presents separate recipient/channel configuration, message preview, and status/provenance regions. Mobile intentionally stacks the same work inside the bounded root. The reported desktop mobile-card layout was not reproduced on this authenticated Workspace Share state.

## Boundary

- Route splitting alone is not accepted as the UX fix; the measured pass comes from viewport-bounded roots, selected-only work, collapsed support documents, and internal scroll.
- No Share session, database row, provider dispatch, vector/embedding, Wiki publication, or KOSHA registry mutation was created.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE` because no concrete saved-session URL or approved DB-backed creation flow was provided.
- A remaining user-specific reproduction must distinguish stale cache, a different/expanded route state, and an exact saved session before any additional product patch.

## Screenshots

- `documents-desktop-1440x723.png`
- `documents-mobile-390x723.png`
- `workspace-share-desktop-1440x723.png`
- `workspace-share-mobile-390x723.png`
