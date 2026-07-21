# Workspace IA Live Refinement - 2026-07-21

Verdict: `IA_BLOCKER_REFINED`

Checked live production at commit `f67a63286251b1e4611b4234c0059be043f80f8e`.

## Product Interpretation

The user's observation is best split into two separate findings:

1. The default `/workspace` Documents and Share cockpit page-height issues are closed on current live production.
2. The selected document editor/detail path still explains the "Documents feels long" complaint because the first long-form textarea is below the visible viewport after entering the edit/detail surface.

This is not a stale deploy problem anymore. It is an information architecture boundary: route/page split helps orientation, but it is not sufficient unless each route also has a first-viewport cockpit and moves long artifacts into bounded drilldown/detail surfaces.

## Closed Or Mostly Closed

### `/workspace` Documents Default Cockpit

- Desktop short `1440x723`: body `723/723`, document page bottom `710`, document workbench bottom `710`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, document page bottom `786`, document workbench bottom `786`, overflowX `false`, outside `0`.

### `/workspace` Share Default Cockpit

- Desktop short `1440x723`: body `723/723`, share root bottom `716`, preview bottom `571`, primary CTA bottom `389`, form width `636`, preview width `520`, overflowX `false`, outside `0`.
- Desktop `1440x900`: body `946/900`, share root bottom `882`, preview bottom `757`, primary CTA bottom `401`, form width `624`, preview width `520`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`, form width `318`, preview width `318`, overflowX `false`, outside `0`.

Interpretation: raw Share geometry is not a literal desktop mobile stack. If desktop Share still feels card-like, the follow-up should test perceived full-workbench composition rather than only checking that two columns exist.

## Open IA Blocker

### Selected Document Editor / Detail Landing

- Desktop short `1440x723`: editor body `882/723`, document editor bottom `695`, first textarea bottom `1267`.
- Desktop `1440x900`: editor body `1129/900`, document editor bottom `839`, first textarea bottom `1256`.
- Mobile `390x844`: editor body `1067/844`, document editor bottom `818`, first textarea bottom `1160`.

Interpretation: the outer editor frame is bounded, but the first long-form editing textarea remains below the viewport after entering the detail/editor path. The next bounded `/documents` TDD wave should require that the first meaningful editable content or field summary intersects the visible viewport or bounded pane immediately after the risk-assessment edit/detail action.

## Next Acceptance

- Default Documents cockpit remains bounded and keeps the core 3 document affordance.
- After selecting the risk-assessment edit/detail action, the first meaningful editable content or field summary intersects the visible viewport or bounded pane immediately.
- Selected editor/detail keeps sticky local context and avoids toolbar or pane-edge overlap.
- Long raw textarea/document body is explicitly secondary drilldown.
- Share desktop follow-up, if pursued, should judge full-workbench perception: recipient/channel/provenance/actions and preview should read as deliberate work regions, not narrow centered cards.
- WorkpackEditor export, canonical risk-row behavior, provider dispatch gates, and backend contracts remain unchanged.

## Structural Conclusion

Page split is useful for orientation, but it is not the length fix by itself. The launch UX contract is step split plus first-viewport cockpit plus bounded drilldown/detail with persistent local context.
