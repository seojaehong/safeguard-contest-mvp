# SafeGuard scenario matrix report

Date: 2026-04-27

## Implemented

- Added a reusable demo scenario catalog covering region, industry, weather signal, foreign-worker presence, skill mix, work type, and equipment.
- Added home-screen scenario chips so judges can switch away from the default Seongsu case.
- Expanded scenario profiles and E2E scenario cases from 4 to 6 representative cases:
  - Seoul construction, windy, new worker mixed
  - Incheon logistics, rain/wet floor, experienced workers
  - Ansan manufacturing, hot work, foreign workers included
  - Busan facility maintenance, confined-space concern, two-person work
  - Gwangju cleaning/service, chemical detergent, foreign workers included
  - Daegu warehouse, heat stress, experienced older workers

## Verification

- `npm.cmd run build`: passed
- `npm.cmd run typecheck`: passed after build regenerated `.next/types`
- API scenario matrix: `evaluation/2026-04-27-scenario-matrix/scenario-matrix-summary.json`
- Home scenario picker smoke: `evaluation/2026-04-27-scenario-matrix/scenario-picker-smoke.json`

## Results

- All 6 scenarios matched the expected company profile.
- All 6 scenarios generated risk assessment, TBM record, and safety education sections.
- Foreign-worker scenarios returned `대상 적합` training fit for the top education recommendation.
- Non-foreign scenarios did not mark foreign education as direct target fit.
- Home rendered scenario chips for region, industry, foreign-worker presence, and skill mix.

## Notes

- Weather remains API-driven where supported by the current location map. Unsupported or provider-failing locations gracefully fall back while keeping the rest of the document pack intact.
- The scenario catalog is intentionally human-readable so it can be reused for presentation rehearsal, E2E smoke, and future UI scenario presets.
