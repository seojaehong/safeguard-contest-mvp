# Live Document Seed-Profile Isolation

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_SEED_PROFILE_ISOLATION_LIVE_PENDING`
- Product commit: `597dec777e0467cd9f8aadce611fbb7b1a8f3b72`
- Contract: five scenarios x twelve raw deliverables; one forbidden seed fragment is enough to fail the case.
- Live after deployment: pending

## Result

| Evidence | Source / production | Cases | Seed-profile leakage | Secondary grounding | Missing documents |
|---|---|---:|---:|---:|---:|
| Before live | `181414b9` / `181414b9` | 0/5 PASS | 90 | 30/30 | 0 |
| After local production | `597dec77` / local `3078` | 5/5 PASS | 0 | 30/30 | 0 |

The previous production output retained generic seed-profile wording across the 60-document surface. The current-source local production build removes those fragments while preserving all 12 deliverables and the secondary-document grounding contract.

The fail-closed document contract checks these fragments independently of the existing two-term cross-scenario heuristic:

- `공장 바닥 세척`
- `우천 후 바닥 젖음`
- `고중량 박스`
- `폭염주의 수준`
- `온열질환과 근골격계 부담`

## Boundary

- This is current-source local production proof, not live production closure.
- No DB mutation was performed.
- No Share session was created.
- No provider dispatch was called.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.

## Evidence

- Before live: `evaluation/live-document-seed-profile-isolation-2026-07-25/before-live/report.md`
- After local: `evaluation/live-document-seed-profile-isolation-2026-07-25/after-local/report.md`
- Local server log: `evaluation/live-document-seed-profile-isolation-2026-07-25/local-server.stdout.log`
