# Hermes Candidate Body Hazard Coverage

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_CANDIDATE_BODY_HAZARD_COVERAGE_LIVE_PENDING`
- Product commit: `6eca935547c5984701a382376801809625dc7091`
- Current-source local matrix: 5/5 cases PASS
- Candidate-body hazard grounding: 6/6
- Multi-hazard `fall-foreign-worker`: 2/2 hazards visible in the candidate body
- Reviewer-visible evidence traces: 5/5
- SIF evidence boundary: 5/5
- Event semantic grounding: 5/5
- Private event exposure: 0

## Product Contract

Hermes/LLM Wiki candidate readiness now resolves every `matchedHazardId` against the canonical eight-hazard registry. A candidate can reach `ready_for_human_review` only when each matched hazard has at least one hazard-specific body term in the `위험요인 요약` section. Complete metadata traceability alone cannot satisfy this body contract.

The review inbox exposes `본문 위험 연결 X/Y` and names missing hazards. Candidate approval still requires both canonical hazard-to-control/document/evidence traceability and complete candidate-body coverage. Unregistered hazards remain fail-closed.

## Verification

- Focused governance, approval, matrix, route, and browser tests: 5 files / 96 tests PASS
- Adjacent regenerate and safety-knowledge tests: 2 files / 34 tests PASS
- Focused rerun after matrix wiring: 4 files / 77 tests PASS
- Strict typecheck: PASS
- Next.js 15.5.22 build: PASS, 29/29 static pages
- Local production server log: `evaluation/hermes-candidate-body-hazard-coverage-2026-09-01/local-server.stdout.log`
- Matrix artifact: `evaluation/hermes-candidate-body-hazard-coverage-2026-09-01/after-local/report.json`

## Boundary

This evidence is current-source local production proof. Live production after-deployment is still required. Human review is not complete, LLM Wiki publication and Supabase RLS remain approval-gated, and no DB write, provider dispatch, Share-session creation, Wiki publication, embedding/vector mutation, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
