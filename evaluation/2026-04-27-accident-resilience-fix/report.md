# Accident-case resilience fix report

Generated: 2026-04-27

## Review findings checked
- Finding 1 confirmed: `fetchAccidentCases` was part of the main `Promise.all`, so a slow accident-case API could gate the whole `/api/ask` response.
- Finding 2 confirmed: JSON parse failure returned an empty list, which made XML error envelopes and schema changes indistinguishable from normal empty results.

## Fix
- `runAsk` starts accident-case enrichment separately with a 5 second request budget and no retry.
- Main law, weather, training, and KOSHA reference calls no longer wait for the full 20s x retry accident-case path.
- Accident-case parsing now distinguishes `ok`, `empty`, `api_error`, and `parse_error`.
- XML/HTML responses and JSON API error envelopes are surfaced in `externalData.accidentCases.detail` before fallback fixtures are used.

## Verification
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- Local production `/api/ask` smoke on port 3023: passed with Law.go, Gemini, KMA, Work24, KOSHA, and accident cases all live.
- Scenario E2E on port 3023: 6/6 passed.

## Evidence files
- `evaluation/2026-04-27-accident-resilience-fix/live-ask-summary.json`
- `evaluation/2026-04-27-accident-resilience-fix/scenario-e2e/summary.json`
- `evaluation/2026-04-27-accident-resilience-fix/scenario-e2e/details.json`
