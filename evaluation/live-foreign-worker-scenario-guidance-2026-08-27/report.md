# Foreign-worker scenario guidance

Verdict: `PASS_LIVE_PRODUCTION_FOREIGN_WORKER_SCENARIO_GUIDANCE`

Production commit `9e49be8454fdf594834e6947b07bca411b2a57ad` now emits the easy-Korean heat and UV instruction only when the scenario carries an explicit heat signal.

## Live contract

| Case | HTTP | AI mode | Work unit | Heat guidance | Scenario context | Result |
| --- | ---: | --- | ---: | --- | --- | --- |
| Chemical cleaning negative | 200 | template | 0 | absent | `국소배기·비산·피부접촉` present | PASS |
| Heat logistics positive | 200 | template | 0 | present | heat prevention context present | PASS |

The tracked before artifact at `evaluation/live-document-editorial-template-runtime-2026-08-27/after-live/report.json` showed the heat instruction in the chemical-only foreign-worker transmission. The live after checks prove both sides of the condition without requesting provider generation.

## Verification

- Focused quality tests: 4 files, 76 tests PASS.
- Strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Dependency audit: 0 vulnerabilities.
- The five non-heat stress scenarios now forbid `더위·자외선 작업에서는`. Their forbidden-fragment checks have zero failures. The local deterministic stress baseline remains 2/5 because of three unrelated semantic-contract failures, so this report does not claim an overall matrix PASS from that run.

## Boundary

No DB, provider generation, dispatch, Share session, vector/embedding, Wiki publication, or KOSHA registry mutation occurred. Human wording review remains incomplete, broad review remains required, fully automated launch remains disallowed, and exact saved Share remains `MISSING_EVIDENCE`.
