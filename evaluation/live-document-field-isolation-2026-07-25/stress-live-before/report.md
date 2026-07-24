# Live Document Wording Review

- Verdict: `RED_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW`
- Source mode: `live-production`
- Base URL: `https://www.safeclaw.kr`
- Source HEAD: `fa559d16092a80564c3d15f8ffdd39b2f0ff8bd4`
- Production commit: `fa559d16092a80564c3d15f8ffdd39b2f0ff8bd4`
- Cases: 5, pass 1, fail 4
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch called: `false`

| Case | Verdict | Risk rows | Reviewed docs | Failed checks |
|---|---:|---:|---:|---|
| ulsan-chemical-cleaning-sds__stress | PASS | 5 | 6 | - |
| pyeongtaek-simultaneous-overhead-hotwork__stress | RED | 5 | 6 | riskRows:crossScenarioFieldLeakage |
| daejeon-vulnerable-night-maintenance__stress | RED | 5 | 6 | riskRows:scenarioFieldGrounding |
| gumi-kosha-guidance-boundary__stress | RED | 5 | 6 | riskRows:scenarioFieldGrounding |
| jeju-overnight-electrical-repair__stress | RED | 5 | 6 | riskRows:crossScenarioFieldLeakage |

## Boundary

This gate reviews synthetic document wording and field usability. It does not approve broad launch wording, create or mutate saved Share sessions, dispatch providers, or replace human review of production user documents.
