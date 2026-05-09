# SafeClaw education/weather/risk-row check

Date: 2026-05-09

## Scope

This check covers three late-stage submission concerns:

- Work24/KOSHA education evidence visibility.
- `/api/weather` direct smoke compatibility.
- Intermittent empty `riskAssessmentRows` reports.

## Findings

### Education API evidence

Work24 and KOSHA education integrations were still present in the generation engine and evidence model:

- `lib/work24.ts` fetches Work24 training recommendations.
- `lib/kosha-education.ts` fetches KOSHA education recommendations.
- `components/CurrentWorkpackModules.tsx` maps both into evidence cards.

The visibility issue came from evidence ordering. Education cards were appended after weather, KOSHA, OpenAPI, and accident cards, then hidden by the 6-card evidence preview cap.

Fix applied:

- Added a separate `교육 연계 근거` group in the evidence screen.
- Added explicit Work24/KOSHA education source cards to `/ops/api`.

### Weather API 400

`/api/weather` only accepted `question`, so direct calls like:

```text
/api/weather?location=서울&lat=37.5&lon=127.0
```

returned `400 question query is required`.

Fix applied:

- Accept `location`, `lat/lon`, `latitude/longitude`, and `lng` as compatibility parameters.
- Derive a weather question when `question` is omitted.
- Preserve the existing `question` contract for the main workflow.

### Empty riskAssessmentRows

Current `lib/search.ts` already includes a fallback path:

- If Gemini structured rows are present, they are used.
- If Gemini returns no rows, `buildFallbackRiskAssessmentRows(...)` builds 5 deterministic rows.

Therefore the current branch should not intentionally return `riskAssessmentRows: []` from the normal `/api/ask` flow. If this appears again, it is likely one of:

- Older production build before the schema-first fallback fixes.
- A client reading stale localStorage/current workpack state.
- A response path outside `/api/ask` that bypasses `runAsk`.

Recommended follow-up:

- Keep `riskAssessmentRows.length > 0` in final gate smoke.
- If the issue reproduces on current production, capture the exact request body and response `detail` field.

## Verification target

- `npm.cmd run typecheck`
- `npm.cmd run build`

