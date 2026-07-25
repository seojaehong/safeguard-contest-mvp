# Live Document Rain-Context Isolation

- Verdict: `PASS_LIVE_PRODUCTION_RAIN_CONTEXT_ISOLATION`
- Product commit: `166fab88501cf825c3cecd80c05b6b2fce640425`
- Runner contract commit: `52d76ee4442dac23eb6c0eb7fe4d31c8bf9be749`
- Before production commit: `e0dbf20bf9d51e15cdd163c76dfa3abe85c4ec3c`
- After production commit: `9f18b7fd72391ad391df7ab31468b5af3f7159a5`
- Full-matrix contract commit: `665bf69cd9d454b8adc15c55d8b84f1e87b64301`
- Full-matrix measured production commit: `32749c5a195365a65e0be87b5df7b373ad4ae86e`
- Scenario: Ulsan chemical cleaning with SDS/GHS and spray/skin-contact risk
- Documents reviewed per run: 12

## Before Live

Current production was fail-closed RED:

- Scenario pass/fail: `0/1`
- Scenario-irrelevant findings: `3`
- Failed documents:
  - `foreignWorkerBriefing`
  - `foreignWorkerTransmission`
  - `kakaoMessage`
- Matched fragment: `우천·젖은 바닥`

The source question contains `비산` (spray), not a rain or wet-floor condition.
The previous broad regex treated the first character of `비산` as rain.

## After Local

Current-source local production was PASS:

- Scenario pass/fail: `1/0`
- Documents pass/fail: `12/0`
- Scenario-irrelevant findings: `0`
- Matched forbidden fragments: `0`

The focused tests also preserve the positive case: explicit rain forecasts and
wet-floor wording still add the rain context.

## After Live

Production deployment `9f18b7fd` passed the same focused contract:

- Scenario pass/fail: `1/0`
- Documents pass/fail: `12/0`
- Scenario-irrelevant findings: `0`
- Matched forbidden fragments: `0`

## After Live Full Matrix

The committed contract adds both known false-rain phrases to the unchanged
five-scenario stress manifest. Production `32749c5a` passed that current-source
contract without changing runtime behavior:

- Scenario pass/fail: `5/0`
- Documents pass/fail: `60/0`
- Scenario-irrelevant findings: `0`
- Matched forbidden fragments: `0`
- Placeholder, legal-overclaim, awkward-composition, evidence-mismatch, and
  generic-template findings: `0`
- Forbidden rain fragments: `우천 후 바닥 젖음`, `우천·젖은 바닥`

The contract-only commit does not affect production runtime. The measured
production contains the live product fix and the current-source manifest makes
the 60-surface check fail closed if either false-rain phrase returns.

## Evidence Contract

The editorial runner now consumes `expected.forbiddenDocumentFragments` for
all 12 canonical deliverables. Any matched fragment is recorded on the
document row and fails with `scenarioIrrelevantContext`.

The earlier five-scenario local attempt under `attempt-timeout/` is retained as
diagnostic evidence only. Four API calls were aborted after the command time
budget expired, so it is not used as the product verdict.

## Verification

- Focused Vitest: 3 files, 71 tests PASS
- Strict typecheck: PASS
- Next production build: PASS, 28 static pages

## Boundary

No database mutation, Share-session creation, provider dispatch, embedding, or
vector upload was performed. Broad human wording review is not complete. Exact saved
`/share/[sessionId]` remains `MISSING_EVIDENCE`.
