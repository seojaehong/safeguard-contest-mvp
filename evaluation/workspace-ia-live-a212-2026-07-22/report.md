# Workspace IA Live Refinement

Generated from live production geometry: 2026-07-21T16:00:17.275Z

Source / live commit: `a212f1bd241921a94ab58861b575e53c431372b0`

Verdict: `IA_BLOCKER_REFINED_CURRENT_LIVE`

## Product Answer

Page or route split is useful for orientation, but it is not sufficient. If a route still expands the full safety document, transmission text, evidence ledger, or provider result log in normal page flow, the long-page problem simply moves to a new URL.

The launch UX contract is:

- first viewport cockpit for the current task,
- selected item and primary CTA visible,
- long content constrained to a bounded pane, accordion, drawer, or detail route,
- local context preserved inside the drilldown,
- provider live dispatch kept separate from UI readiness.

## Closed In Current Live Geometry

### Default Documents Cockpit

- Desktop short 1440x723: body `723`, workbench bottom `710`, visible document previews `0`, overflow closed.
- Mobile 390x844: body `844`, workbench bottom `786`, visible document previews `0`, overflow closed.

### Default Share Cockpit

- Desktop short 1440x723: body `723`, share root bottom `716`, form width `636`, preview width `520`, preview bottom `571`, primary CTA bottom `389`.
- Mobile 390x844: body `844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`.

### Selected Editor Field-Level Landing

- Desktop short 1440x723: first risk-row header `522-579`, first hazard field `615-675`, raw textarea `1094-1267`.
- Desktop 1440x900: first risk-row header `510-567`, first hazard field `604-664`, raw textarea `1083-1256`.
- Mobile 390x844: first risk-row header `526-583`, first hazard field `607-657`, raw textarea `987-1160`.

The row header text still contains evidence and verification context: `근거 2건 · 확인 확인 예정`.

## Still Open

- Selected editor raw textarea / full long-form authoring remains secondary drilldown.
- The full document edit surface should not be claimed globally short.
- Share desktop raw geometry is already two-column; perceived narrow-card workbench breadth is only a follow-up if reproduced in the user-visible generated session.

## Evidence

- Live geometry: `evaluation\workspace-docs-share-production-gate-2026-07-20\current-geometry.json`
- Screenshot refresh: `evaluation\workspace-docs-share-production-gate-2026-07-20\mobile-day-current-editor.png`
