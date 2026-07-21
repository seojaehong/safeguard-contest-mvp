# Workspace IA Live 64e Refinement

- Checked at: 2026-07-21T17:01:41.438Z
- Source SHA: `64e80b218134f4e840453c2b4f77a5cccfc92999`
- Live commit checked: `64e80b218134f4e840453c2b4f77a5cccfc92999`
- Verdict: `IA_BLOCKER_REFINED_CURRENT_LIVE`
- Route split alone accepted as fix: false
- Provider dispatch live claimed: false

## Closed

### Default Documents Cockpit

- Desktop short 1440x723: body 723/723, workbench bottom 710, visible previews 0, overflowX false, outside 0.
- Mobile 390x844: body 844/844, workbench bottom 786, visible previews 0, overflowX false, outside 0.

### Default Share Cockpit

- Desktop short 1440x723: body 723/723, share root bottom 716, form width 636, preview width 520, preview bottom 571, primary CTA bottom 389.
- Mobile 390x844: body 844/844, share root bottom 810, preview bottom 683, primary CTA bottom 742.

### Selected Editor Field-Level Landing

- Desktop short 1440x723: first risk-row header 522-579, first hazard field 615-675, raw textarea 1094-1267.
- Desktop 1440x900: first risk-row header 510-567, first hazard field 604-664, raw textarea 1083-1256.
- Mobile 390x844: first risk-row header 526-583, first hazard field 607-657, raw textarea 987-1160.

## Still Open

- Selected editor raw textarea/full long-form authoring remains secondary drilldown.
- Share desktop perceived narrow-workbench refinement remains optional and should be pursued only if reproduced in the user-visible generated session.

## Structural Conclusion

Page or route split helps orientation but does not solve long Documents/Share content by itself. The launch UX contract is first-viewport cockpit plus bounded drilldown/detail. Current live evidence closes the default cockpit and selected risk-row field landing; raw textarea/full authoring depth remains explicit secondary drilldown.
