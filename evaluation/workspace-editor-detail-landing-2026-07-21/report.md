# Workspace Editor Detail Landing - 2026-07-21

Verdict: `PASS_LIVE_PRODUCTION_FIELD_LEVEL`

Live production marker: `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea`

Freshness note: the same selector geometry was re-probed on live production after the Final 99 evidence marker advanced to `cd3d46a8`.

## Scope

This evidence refines the previous selected document editor/detail blocker.

It does **not** claim that the full long-form document editor or raw textarea is short. It proves the narrower launch UX contract that, after the user enters the `위험성평가표` editor/detail surface, the first meaningful row/field work surface is immediately visible in the viewport.

## Live Metrics

### Desktop Short `1440x723`

- Editor body: `882/723`
- Document editor bottom: `695`
- Toolbar: `113-195`
- First risk row header: `522-579`
- First hazard field: `615-675`
- Raw textarea: `1094-1267`
- Row header text includes: `근거 2건 · 확인 확인 예정`

### Desktop `1440x900`

- Editor body: `1129/900`
- Document editor bottom: `839`
- Toolbar: `80-184`
- First risk row header: `510-567`
- First hazard field: `604-664`
- Raw textarea: `1083-1256`
- Row header text includes: `근거 2건 · 확인 확인 예정`

### Mobile `390x844`

- Editor body: `1067/844`
- Document editor bottom: `818`
- Toolbar: `83-208`
- First risk row header: `526-583`
- First hazard field: `607-657`
- Raw textarea: `987-1160`
- Row header text includes: `근거 2건 · 확인 확인 예정`

## Interpretation

The user's broader structural diagnosis remains correct: page split alone is not the fix. The current live editor/detail path is still a long-form drilldown, and the raw textarea remains below the viewport by design. The launch UX acceptance is field-level landing, not raw textarea first-viewport visibility.

The specific selected-editor landing acceptance is now field-level green:

- the selected risk-assessment row header is visible,
- the first actionable hazard field is visible,
- evidence and verification status are visible in the row header,
- the raw textarea is secondary and below the first work surface,
- provider/backend/export contracts are not touched.

Remaining UX debt:

- full raw textarea visibility is not claimed,
- deeper row editing and all-document authoring depth remain product follow-up,
- Share perceived full-workbench composition remains a separate follow-up if a user-visible session reproduces that complaint.
