# Live Document Wording Review

- Verdict: `RED_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW`
- Source mode: `live`
- Base URL: `https://www.safeclaw.kr`
- Source HEAD: `85d8938dc20c296bbc1e42cf61ac17396f779e0b`
- Production commit: `85d8938dc20c296bbc1e42cf61ac17396f779e0b`
- Cases: 5, pass 0, fail 5
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch called: `false`

| Case | Verdict | Risk rows | Reviewed docs | Failed checks |
|---|---:|---:|---:|---|
| ulsan-chemical-cleaning-sds__stress | RED | 5 | 6 | riskRows:scenarioLocation |
| pyeongtaek-simultaneous-overhead-hotwork__stress | RED | 5 | 6 | riskRows:scenarioLocation |
| daejeon-vulnerable-night-maintenance__stress | RED | 5 | 6 | riskRows:scenarioLocation |
| gumi-kosha-guidance-boundary__stress | RED | 5 | 6 | riskRows:scenarioLocation |
| jeju-overnight-electrical-repair__stress | RED | 5 | 6 | riskRows:scenarioLocation |

## Boundary

This gate reviews synthetic document wording and field usability. It does not approve broad launch wording, create or mutate saved Share sessions, dispatch providers, or replace human review of production user documents.
