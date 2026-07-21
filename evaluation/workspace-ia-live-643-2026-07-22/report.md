# Workspace IA Live 643 Recheck

Verdict: `IA_BLOCKER_REFINED_CURRENT_LIVE`

Checked at: `2026-07-21T20:07:50.972Z`

Live commit checked: `64392d2b663e2b7de89b06269ee648596b68a186`

## Structural Conclusion

Page or route split helps orientation, but it does not solve long Documents/Share content by itself. The launch UX contract remains first-viewport cockpit plus bounded drilldown/detail panes.

## Closed

Default `/workspace` Documents cockpit:

- Desktop short `1440x723`: body `723/723`, document workbench bottom `710`, previews open `0`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, document workbench bottom `786`, previews open `0`, overflowX `false`, outside `0`.

Default `/workspace` Share cockpit:

- Desktop short `1440x723`: body `723/723`, share root bottom `716`, form width `636`, preview width `520`, preview bottom `571`, primary CTA bottom `389`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`, overflowX `false`, outside `0`.

Selected `위험성평가표` editor field-level landing:

- Desktop short `1440x723`: first risk-row header `522-579`, first hazard field `615-675`, raw textarea `1094-1267`.
- Desktop `1440x900`: first risk-row header `510-567`, first hazard field `604-664`, raw textarea `1083-1256`.
- Mobile `390x844`: first risk-row header `526-583`, first hazard field `607-657`, raw textarea `987-1160`.

## Still Open

- Selected editor raw textarea/full long-form authoring remains a secondary drilldown.
- Share desktop perceived narrow-workbench refinement remains optional and should be pursued only if reproduced in the user-visible generated session.

## Product Interpretation

The current live geometry supports the user's nuanced interpretation:

- The default Documents page-height problem is closed for the cockpit state.
- The selected editor/detail can still feel long because raw textarea/full authoring is intentionally below the first viewport.
- Share desktop is not a literal mobile stack by raw geometry. If it still feels mobile-like, the next acceptance should test full-workbench visual composition, not just column existence.
- More routes help orientation only after the cockpit/drilldown boundary is enforced.
