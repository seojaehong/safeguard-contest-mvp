# Workspace IA Live F297 Recheck

Verdict: `IA_BLOCKER_REFINED_CURRENT_LIVE`

Checked at: `2026-07-21T15:35:06.700Z`

Live commit checked: `f297fe04497ea79f0fa1f8a9f95510fea6ab6759`

## Structural Conclusion

The user is right that page or route splitting alone is not the fix. Documents and Share artifacts are inherently long. The launch UX contract is:

- step split for orientation,
- first-viewport cockpit for the default task,
- bounded drilldown/detail for long documents, raw text, logs, and message variants,
- persistent local context inside the drilldown.

## Current Live Split

### Closed

Default `/workspace` Documents cockpit:

- Desktop short `1440x723`: body `723/723`, document workbench bottom `710`, previews open `0`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, document workbench bottom `786`, previews open `0`, overflowX `false`, outside `0`.

Default `/workspace` Share cockpit:

- Desktop short `1440x723`: body `723/723`, share root bottom `716`, form width `636`, preview width `520`, preview bottom `571`, primary CTA bottom `389`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, share root bottom `810`, preview width `318`, preview bottom `683`, primary CTA bottom `742`, overflowX `false`, outside `0`.

Selected `위험성평가표` editor field-level landing:

- Desktop short `1440x723`: first risk row header `522-579`, first hazard field `615-675`, row header includes `근거` and `확인`.
- Desktop `1440x900`: first risk row header `510-567`, first hazard field `604-664`, row header includes `근거` and `확인`.
- Mobile `390x844`: first risk row header `526-583`, first hazard field `607-657`, row header includes `근거` and `확인`.

### Still Open

Selected editor raw textarea/full authoring depth remains a secondary drilldown:

- Desktop short `1440x723`: raw textarea `1094-1267`.
- Desktop `1440x900`: raw textarea `1083-1256`.
- Mobile `390x844`: raw textarea `987-1160`.

This is not a contradiction with the field-level landing PASS. It means the first practical risk-row work surface is visible, while the long raw textarea remains below the first viewport by design.

Share desktop is not a literal mobile stack by raw geometry. If the user still perceives it as mobile-like, the next acceptance should judge deliberate workbench breadth and visual composition rather than simply checking whether two columns exist.

## Next Acceptance

- Keep default Documents and Share cockpits first-viewport bounded.
- Keep selected editor first risk-row header and first hazard field immediately visible.
- Do not claim full raw textarea or all-document authoring is short.
- If Share composition is revisited, measure desktop workbench breadth, preview/form balance, and generated-session perception separately from provider live dispatch.
