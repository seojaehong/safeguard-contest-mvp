# Live Document Wording Review

- Verdict: `RED_LIVE_PRODUCTION_SYNTHETIC_WORDING_REVIEW`
- Source mode: `live-production`
- Base URL: `https://www.safeclaw.kr`
- Source HEAD: `b91dbd2e02e3ff33285f439f1c3db7fe77faa23f`
- Production commit: `b91dbd2e02e3ff33285f439f1c3db7fe77faa23f`
- Cases: 3, pass 0, fail 3
- DB mutation performed: `false`
- Share session created: `false`
- Provider dispatch called: `false`

| Case | Verdict | Risk rows | Reviewed docs | Failed checks |
|---|---:|---:|---:|---|
| dc13-exterior-wall-repair__exact-materialization | RED | 5 | 6 | kosha:expectedExactPinInEveryRiskRow |
| dc7-scaffold-assembly__exact-materialization | RED | 5 | 6 | riskRows:crossScenarioFieldLeakage, kosha:expectedExactPinInEveryRiskRow |
| be10-deenergized-electrical__exact-materialization | RED | 5 | 6 | kosha:expectedExactPinInEveryRiskRow |

## Boundary

This gate reviews synthetic document wording and field usability. It does not approve broad launch wording, create or mutate saved Share sessions, dispatch providers, or replace human review of production user documents.
