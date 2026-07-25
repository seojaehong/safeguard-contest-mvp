# Pump-Confined Hazard Isolation

- Verdict: `PASS_LIVE_PRODUCTION_PUMP_CONFINED_HAZARD_ISOLATION`
- Product commit: `7140d818`
- Scenario: basement drainage-pump inspection with confined-space entry, LOTO, and an explicit wet-floor hazard

## Before

GitHub Actions run `30141505148` failed
`tests/pump-confined-scenario.test.ts`. The generated three-item hazard list
contained a generic machinery-isolation hazard, ventilation/oxygen risk, and
pump LOTO risk, but dropped the user's explicit `누수 바닥` hazard.

The source pump profile already contained the correct three hazards. A later
question-specificity pass prepended a generic LOTO hazard, and the fixed-size
merge retained only the first three entries.

## Remediation

Question-specificity enrichment now checks whether the selected source profile
already contains an isolation hazard and action. It adds the generic LOTO
fallback only when the source profile does not already cover that contract.

The pump scenario therefore preserves:

- confined-space ventilation and oxygen measurement;
- drainage-pump power isolation and LOTO;
- wet-floor and drainage-related slip/fall risk.

The regression test also rejects reintroduction of the generic machinery
hazard into this scenario.

## Verification

- Focused Vitest: 3 files, 59 tests PASS
- Adjacent quality Vitest: 4 files, 81 tests PASS
- Strict typecheck: PASS
- Next production build: PASS, 28 static pages

## After Live

Production marker `7140d818` returned the same scenario from `/api/ask` with
HTTP 200 in 19,412 ms. The live risk-assessment document contains ventilation
or oxygen measurement, LOTO or power isolation, and wet-floor or slip risk.
The displaced generic machinery-isolation sentence is absent.

## Boundary

No database mutation, Share-session creation, provider dispatch, embedding, or
vector upload was performed. Exact saved `/share/[sessionId]` remains
`MISSING_EVIDENCE`, and broad human wording review remains separate.
