# Live KOSHA Exact Materialization Gate

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_KOSHA_EXACT_MATERIALIZATION_LIVE_PENDING`
- Product source: `857c52085f4b241eb0b13aec7cf51118246ff7a6`
- Production baseline: `b91dbd2e02e3ff33285f439f1c3db7fe77faa23f`
- Local production: `http://127.0.0.1:3080`
- Live after-deployment verification: pending

## Result

The current source materializes each existing exact KOSHA pin in at least one relevant structured risk row without an unexpected exact pin, statutory overclaim, or cross-scenario field leakage.

| Scenario | Exact pin | Before live | After local | Matching structured rows | Field leakage |
| --- | --- | ---: | ---: | ---: | ---: |
| Exterior wall repair | `D-C-13` | RED | PASS | 1 | 0 |
| Scaffold assembly/dismantling | `D-C-7` | RED | PASS | 1 | 0 |
| De-energized electrical work | `B-E-10` | RED | PASS | 1 | 0 |

The initial live baseline was `0/3`. Two distinct debts were exposed: the first runner contract overreached by requiring every risk row to cite the exact guide, and the scaffold scenario inherited an exterior-painting process identity. The domain-correct contract requires at least one relevant structured row to cite the expected exact pin while unexpected pins and KOSHA statutory overclaim remain fail-closed.

The SHA-aligned current-source local production run is `3/3` PASS. This is not yet a live-production PASS because production still served `b91dbd2e` when the local evidence was recorded.

## Verification

- Focused contracts: 3 files, 47 tests PASS
- Strict typecheck: PASS
- Production build: PASS, 28/28 static pages
- Matrix calls: three `/api/ask` requests per measured run

## Mutation Boundary

- DB mutation: false
- Share session creation: false
- Provider dispatch: false
- Exact trust registry expansion: false

This gate does not claim that all KOSHA corpus rows are exact direct evidence, that KOSHA guidance is a statutory mandate, or that the exact saved `/share/[sessionId]` UI evidence gap is closed.
