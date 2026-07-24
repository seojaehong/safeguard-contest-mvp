# Live Document Field Isolation Gate

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_FIELD_ISOLATION_LIVE_PENDING`
- Product source: `94d0f8538b303fd7d1885cc73a4cc97159965f1c`
- Current-source local production: 10 scenarios, 10 PASS, 0 RED
- Local base URL: `http://127.0.0.1:3079`
- Live after deployment: pending
- DB mutation: `false`
- Share session creation: `false`
- Provider dispatch: `false`

## Result

| Matrix | Before live | Current-source local | Scope |
|---|---:|---:|---|
| Normal | 4/5 PASS | 5/5 PASS | process/task/equipment grounding and cross-scenario leakage |
| Stress | 1/5 PASS | 5/5 PASS | high-risk process/task/equipment grounding and cross-scenario leakage |

The before-live discovery caught a real Changwon-to-Busan profile leak: a press maintenance request containing LOTO was classified as a pump/confined-space job, and every generated process field named the basement pump task. It also caught missing structured-row identity for the Daejeon conveyor and Gumi automated-equipment scenarios.

The stress baseline also contained two generic `방호장치` matches that were contract false positives. The gate now compares only scenario-exclusive fingerprints for cross-scenario leakage while retaining broader terms for own-scenario grounding.

## Current Contract

Each scenario must:

1. produce at least one structured risk row;
2. carry its own scenario fingerprint in `process`, `task`, or `equipment`;
3. avoid fingerprints exclusive to every other matrix scenario.

The current source passes all 10 normal and stress cases in a production build. This is not a live-production PASS until the product commit is deployed and the same matrices are rerun against `https://www.safeclaw.kr`.

## Boundary

This gate makes five normal and five stress `/api/ask` calls only. It does not mutate the database, create a Share session, dispatch a provider, reproduce an exact saved `/share/[sessionId]`, or replace broad human wording review.
