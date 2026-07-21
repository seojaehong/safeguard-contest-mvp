# Workspace IA Live 419 Recheck

Verdict: `IA_BLOCKER_REFINED_CURRENT_LIVE`

Checked at: `2026-07-22 KST`

Live commit checked: `419ca8ca944c3667c24fa29407151f06a26564b6`

Source/evidence HEAD at report generation: `419ca8ca944c3667c24fa29407151f06a26564b6`

Geometry artifact: `evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json`

## Structural Answer

The user is right that route/page split alone does not solve long Documents or Share surfaces. The working launch contract is step split for orientation, first-viewport cockpit for the current decision, and bounded drilldown/detail for long documents, raw text, logs, and message variants.

## Current Live Split

### Closed

Default `/workspace` Documents cockpit:

- Desktop short `1440x723`: body `723/723`, document workbench bottom `710`, previews open `0`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, document workbench bottom `786`, previews open `0`, overflowX `false`, outside `0`.

Default `/workspace` Share cockpit:

- Desktop short `1440x723`: body `723/723`, share root bottom `716`, form width `636`, preview width `520`, preview bottom `571`, primary CTA bottom `389`, overflowX `false`, outside `0`.
- Desktop `1440x900`: form width `624`, preview width `520`, preview bottom `757`, primary CTA bottom `401`, overflowX `false`, outside `0`.
- Mobile `390x844`: body `844/844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`, overflowX `false`, outside `0`.

Selected `위험성평가표` editor field-level landing:

- Desktop short `1440x723`: first risk row header `522-579`, first hazard field `615-675`, row header includes `근거` and `확인`.
- Desktop `1440x900`: first risk row header `510-567`, first hazard field `604-664`, row header includes `근거` and `확인`.
- Mobile `390x844`: first risk row header `526-583`, first hazard field `607-657`, row header includes `근거` and `확인`.

### Still Open

Selected editor raw textarea/full authoring depth remains a secondary drilldown:

- Desktop short `1440x723`: raw textarea `1094-1267`.
- Desktop `1440x900`: raw textarea `1083-1256`.
- Mobile `390x844`: raw textarea `987-1160`.

This is not a contradiction with the field-level landing PASS. The first practical risk-row work surface is visible, while the raw long-form textarea remains below the first viewport by design.

Share desktop is not a literal mobile stack by raw geometry. If the user still perceives it as mobile-like, the next acceptance should judge deliberate full-workbench breadth and visual composition rather than simply checking whether two columns exist.

## Ledger Wording

- Documents default page height: `closed` for the current live cockpit.
- Documents selected editor/detail landing: `open for raw textarea depth`, but `closed for first risk-row field landing`.
- Share mobile compact flow: `closed` in the current live first-viewport cockpit.
- Share desktop raw geometry: `closed for literal mobile stack`, optional follow-up for perceived narrow-card workbench composition.
- Route split alone: `not accepted` as the UX fix.

## Next Acceptance

- Keep default Documents and Share cockpits first-viewport bounded.
- Keep selected editor first risk-row header and first hazard field immediately visible.
- Do not claim full raw textarea or all-document authoring is short.
- If selected editor/detail is revisited, require first meaningful editable content or field summary to intersect the visible viewport or bounded pane immediately after the user opens it.
- If Share composition is revisited, measure desktop workbench breadth, preview/form balance, and generated-session perception separately from provider live dispatch.
