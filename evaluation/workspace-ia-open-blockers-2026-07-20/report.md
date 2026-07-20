# SafeClaw Workspace IA Open Blockers

- Generated: 2026-07-20T14:05:00Z
- Scope: `/workspace` generated Documents and Share surfaces
- Verdict: OPEN UX BLOCKER

## What Is Closed

The mobile rescue gate closed the hard interaction blockers:

- Horizontal overflow: none in the recorded mobile geometry
- Sticky overlap: none in the recorded mobile geometry
- Hidden full document preview while deep review is closed: recorded as hidden in the latest mobile P0 report
- Share primary CTA count: one

These facts support the `MOBILE_FIXED` label only for the bounded hard-blocker gate.

## What Remains Open

The information architecture issue is not fully closed. The user concern should not be treated as stale or visual taste until the current production surface is reconciled with a fresh browser run.

Recorded evidence currently conflicts by surface and state:

- `evaluation/mobile-p0-workspace-gate-2026-07-20/report.json`
  - Documents mobile body: 1269px on an 844px viewport
  - Share mobile body: 1451px on an 844px viewport
  - Share preview y: 380px
- `evaluation/workspace-doc-share-live-current-2026-07-20-c6b2236f/report.md`
  - Desktop 1440x723 Documents height: 1088px, preview y: 420px
  - Desktop 1440x723 Share height: 1025px, preview y: 345px, preview width: 380px
  - Mobile 390x844 Documents height: 1417px, preview y: 639px
  - Mobile 390x844 Share height: 1487px, preview y: 1068px, preview width: 310px

This means the current ledger must distinguish:

- Hard mobile blockers: closed by the mobile P0 gate
- Viewport-first IA: still open until one authoritative production check resolves the conflicting Share preview position and desktop composition evidence

## Acceptance Criteria For The Next Bounded Patch

Documents default view:

- The first viewport should contain the field-mode safety brief, top hazards, core document status, and next action.
- Full document preview and editor must remain behind an explicit deep-review disclosure by default.
- Long deep-review content is acceptable only after the user opens it.

Share desktop:

- The desktop layout must read as a desktop result/action page, not a narrow mobile card.
- At 1440px width, Share should use a two-pane composition: recipients/channel/options on one side and preview/status/warnings on the other.
- Primary controls must be visible before the fold.

Share mobile:

- Message preview and send CTA should be reachable without excessive scroll.
- Mobile can remain single-column, but details and logs should stay folded by default.

## Next Step

Run a fresh authoritative production geometry check against the current `/api/build-info` commit and reconcile the two Share preview measurements. If the narrow desktop share width or late mobile preview position still reproduces, open a bounded IA remediation branch rather than treating `MOBILE_FIXED` as full workflow completion.
