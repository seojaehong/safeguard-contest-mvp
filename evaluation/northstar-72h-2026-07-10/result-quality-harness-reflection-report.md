# Result Quality Harness Reflection Check

Date: 2026-07-10

## Finding

The DB harness and operation-memory metadata existed in the response, but the most visible document preview could still look unchanged because the reflection section was appended near the end of the generated body. The workspace preview only shows the beginning of the selected document, so users could miss the fact that Before/After photo improvements and past-operation memory were actually connected.

## Fix

- Core documents now place the operation-memory reflection near the top:
  - `위험성평가표`: `[오늘 개선·이력 반영 - 위험성평가]`
  - `TBM 브리핑`: `[오늘 개선·이력 반영 - TBM]`
  - `TBM 기록`: `[오늘 개선·이력 반영 - 확인 기록]`
- The wording is product/user-facing and avoids exposing internal implementation language inside the document body.
- The existing DB harness surface and evidence panel still expose `DB 하네스`, `온톨로지 QA`, and coverage status for operators.
- The local improvement parser now accepts harness-shaped `taskLabel` records as a compatibility alias for `workSummary`, so photo-analysis improvement memory is not silently dropped when reused for the next generation.
- `safeclaw.aiMode=template` is now honored on workspace boot, making fast harness/template verification possible without external model latency.

## Evidence

- Browser proof: `evaluation/northstar-72h-2026-07-10/result-quality-probes/workspace-result-quality-harness-preview.png`
- Browser metrics: `evaluation/northstar-72h-2026-07-10/result-quality-probes/workspace-result-quality-harness-preview.json`

Captured assertions:

- `previewHasOperationalMemoryAtTop=true`
- `previewHasPhotoImprovement=true`
- `previewHasVisionEvidence=true`
- `harnessLoopHasDb=true`
- `evidencePanelHasHarness=true`
- Network path for fast proof: `/api/ask` HTTP 200

## Verification

- `npm.cmd test -- tests\operation-improvement-history.test.ts tests\commercial-harness.test.ts tests\workpack-ontology-qa.test.ts tests\quality-contract.test.ts` -> 25 passed

## Remaining Risk

The template proof intentionally does not fetch live Supabase/KOSHA/SIF references, so it can still show `검토 필요` for DB/SIF coverage. The next quality pass should run enhanced mode and compare whether live `safety_reference_items` and SIF search make the same top-of-document reflection include stronger official evidence, not only local improvement memory.
