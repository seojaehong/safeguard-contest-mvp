# Foreign Worker Transmission Context Fix — 2026-07-19

## Trigger

Live output integrity audit against `https://www.safeclaw.kr` returned `blocked` for one ask deliverable:

- Audit artifact: `evaluation/final-output-integrity-audit-2026-07-19-current/report.md`
- Scenario: `서울 건설 강풍`
- Document: `외국인 근로자 전송본`
- Issue: `missing_scenario_term(도장)`

The generated multilingual message contained translated equivalents of exterior wall painting, but the Korean dispatch header/easy-Korean block did not preserve the source work label `외벽 도장 작업`. For field dispatch, the manager-facing Korean context line must keep the exact task label before multilingual worker sections.

## Change

- `lib/foreign-worker.ts`
  - Added `오늘 작업: {workSummary}` to deterministic foreign-worker transmission bodies.
  - Added `ensureForeignWorkerTransmissionContext()` to inject the work summary into AI-authored transmission bodies when the exact work label is missing.
- `lib/search.ts`
  - Applies `ensureForeignWorkerTransmissionContext()` to both AI and deterministic foreign-worker transmission output before publishing deliverables.
- `tests/foreign-worker-languages.test.ts`
  - Locks that `외벽 도장 작업` remains present in the default dispatch body.
  - Locks that an AI-authored body missing the work line is repaired immediately after the site line.

## Verification

- `npm.cmd test -- tests\foreign-worker-languages.test.ts tests\mock-deliverable-integrity.test.ts tests\ai-deliverables-prompts.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS: 3 files / 29 tests
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS: 28 / 28 static pages

## Follow-up Gate

After this commit is deployed, rerun:

```powershell
$env:SAFECLAW_OUTPUT_INTEGRITY_BASE_URL='https://www.safeclaw.kr'
$env:SAFECLAW_OUTPUT_INTEGRITY_OUT_DIR='evaluation/final-output-integrity-audit-2026-07-19-post-context-fix'
npm.cmd run audit:output-integrity
Remove-Item Env:SAFECLAW_OUTPUT_INTEGRITY_BASE_URL
Remove-Item Env:SAFECLAW_OUTPUT_INTEGRITY_OUT_DIR
```

Expected result: the `서울 건설 강풍 / 외국인 근로자 전송본` row should no longer fail on `missing_scenario_term(도장)`.
