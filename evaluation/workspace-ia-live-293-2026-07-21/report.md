# Workspace IA Live 293 Recheck

Verdict: `IA_BLOCKER_REFINED`

Checked at: `2026-07-21T11:34:38+09:00`

Live commit checked: `293a6d3f47124b937c663531ffe48ed8650837c8`

## User Concern

The user reports that Documents still feels long and Share still feels like a mobile screen on desktop. This is no longer best explained as a stale deployment issue for the currently checked production marker. The current live marker matches the repo-visible `293a6d3f` deployment.

The correct product answer remains:

> Route/page split helps orientation, but it is not the length fix by itself. Each stage needs a first-viewport cockpit, and long documents/messages/results must move into bounded drilldown/detail surfaces.

## Live Geometry Split

### Closed Or Mostly Closed

- `/workspace` default Documents cockpit is bounded on live:
  - Desktop short `1440x723`: body `723/723`, document workbench bottom `710`, previews open `0`, overflowX `false`, outside `0`.
  - Mobile `390x844`: body `844/844`, document workbench bottom `786`, previews open `0`, overflowX `false`, outside `0`.
- `/workspace` Share is bounded on live:
  - Desktop short `1440x723`: body `723/723`, share root bottom `716`, preview bottom `571`, primary CTA bottom `389`, overflowX `false`, outside `0`.
  - Desktop `1440x900`: body `946/900`, share root bottom `882`, preview bottom `757`, primary CTA bottom `401`, overflowX `false`, outside `0`.
  - Mobile `390x844`: body `844/844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`, overflowX `false`, outside `0`.
- Standalone `/dispatch?theme=day` sample shell is not desktop-stacked by raw geometry:
  - Desktop short `1440x723`: body `723/723`, two panels at x `284` and `979`, widths `635` and `413`, overflowX `false`.
  - Mobile `390x844`: body `893/844`, single column, overflowX `false`.

### Still Open

- Selected document editor/detail landing still explains the user's "Documents is long" perception:
  - `/workspace` editor desktop short: body `882/723`; editor flow is bounded, but selected editing is an explicit longer detail surface.
  - `/workspace` editor desktop: body `1129/900`.
  - `/workspace` editor mobile: body `1067/844`.
  - Standalone `/documents?theme=day` has a bounded outer page, but the internal editor pane remains long:
    - Desktop short: `.workpack-shell` `386/1619`, first textarea top `937`, bottom `1038`.
    - Mobile: `.workpack-shell` `320/1494`, first textarea top `1048`, bottom `1143`.
- Share desktop raw layout is already two-column, but it can still feel narrow-card if the preview/form columns read as a centered card instead of a full workbench. Treat that as visual composition/product-depth follow-up, not a raw "mobile stack" failure.

## Refined Acceptance

Do not judge the next wave by route count or total body height alone.

Next `/documents` TDD wave should prove:

- Default Documents cockpit remains bounded and keeps core 3 document affordance.
- After selecting the risk-assessment edit/detail action, the first meaningful editable content or field summary intersects the visible viewport or bounded pane immediately.
- The selected editor/detail has sticky local context and does not hide the first actionable field below a toolbar or pane edge.
- Long raw textarea/document body is explicitly secondary drilldown, not the first thing the user must hunt for.
- Existing WorkpackEditor export/canonical contracts remain unchanged.

Possible Share follow-up should prove:

- Desktop generated/share result state uses a deliberate workbench composition, not narrow centered cards.
- Recipient/channel/language/result details remain collapsed or inside bounded panes.
- Mobile compact Share remains first-viewport for summary, preview, CTA, and toggle.
- Provider live dispatch remains a separate approval-gated boundary.

## Product Conclusion

The user's structural diagnosis is right: adding more pages alone would just move long content to different URLs.

The launch UX contract should be:

- step split for orientation,
- one-screen cockpit for the default task,
- bounded drilldown/editor/detail for long artifacts,
- persistent local context inside each drilldown.

Current live evidence closes the default workspace Documents and Share cockpit height problem. It does not close selected document editor/detail landing or the deeper full-document authoring IA.
