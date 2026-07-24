# Live Document Field Isolation Gate

- Verdict: `PASS_LIVE_PRODUCTION_DOCUMENT_FIELD_ISOLATION`
- Product source: `94d0f8538b303fd7d1885cc73a4cc97159965f1c`
- Live production/evidence head: `2336f57ac5d5bc7910b7e9db4d57351ada7d1fd6`
- Deployment: `safeguard-contest-81j97euu2-seojaehongs-projects.vercel.app`
- Current-source local production: 10 scenarios, 10 PASS, 0 RED
- Live production: 10 scenarios, 10 PASS, 0 RED
- Local base URL: `http://127.0.0.1:3079`
- Live base URL: `https://www.safeclaw.kr`
- DB mutation: `false`
- Share session creation: `false`
- Provider dispatch: `false`

## Result

| Matrix | Before live | Current-source local | After live | Scope |
|---|---:|---:|---:|---|
| Normal | 4/5 PASS | 5/5 PASS | 5/5 PASS | process/task/equipment grounding and cross-scenario leakage |
| Stress | 1/5 PASS | 5/5 PASS | 5/5 PASS | high-risk process/task/equipment grounding and cross-scenario leakage |

The before-live discovery caught a real Changwon-to-Busan profile leak: a press maintenance request containing LOTO was classified as a pump/confined-space job, and every generated process field named the basement pump task. It also caught missing structured-row identity for the Daejeon conveyor and Gumi automated-equipment scenarios.

The stress baseline also contained two generic `방호장치` matches that were contract false positives. The gate now compares only scenario-exclusive fingerprints for cross-scenario leakage while retaining broader terms for own-scenario grounding.

## Current Contract

Each scenario must:

1. produce at least one structured risk row;
2. carry its own scenario fingerprint in `process`, `task`, or `equipment`;
3. avoid fingerprints exclusive to every other matrix scenario.

The deployed production passes all 10 normal and stress cases after the product commit reached live.

## Boundary

This gate makes five normal and five stress `/api/ask` calls only. It does not mutate the database, create a Share session, dispatch a provider, reproduce an exact saved `/share/[sessionId]`, or replace broad human wording review.
