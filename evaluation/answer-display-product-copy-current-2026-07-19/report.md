# Answer Display Product Copy Gate

Date: 2026-07-19
Source HEAD before commit: `dc4f925da4bac7a7b56dcfd4463a0a358dd7c893`

## Trigger

A live `/api/ask` sample for an exterior-painting, scaffold, strong-wind, foreign-worker scenario proved the backend grounding path was working:

- `qualityContract.overall=ready`
- `dbHarness.summary.mode=db_harness_first`
- `dbHarness.summary.llmRole=naturalize_only`
- `fallbackChainAllowed=false`
- strong-wind, scaffold, and foreign-worker content signals present

However, the raw answer preview still contained operator-facing terms such as:

- `하네스 판단`
- raw SIF diagnostic phrasing
- direct evidence IDs and archive-style accident prose
- `원시 태그`

Those are valid internal/audit concepts, but they should not dominate the user-facing answer panel.

## Change

The AnswerPanel display sanitizer now removes:

- DB harness headings and contract terms from the visible answer block;
- raw direct-evidence and SIF-case diagnostic lines;
- raw SIF review boilerplate such as `SIF 사고개요`, `원문 감소대책`, `원시 태그`, and `관리감독자 검토 완료 전`.

It preserves field-action lines such as scaffold checks and strong-wind TBM actions.

This is a presentation-boundary change only. It does not alter the API response, evidence packet, DB harness, SIF/KOSHA references, ontology QA, or audit data.

## Verification

```powershell
npm.cmd test -- tests\answer-panel-display.test.ts --maxWorkers=1 --fileParallelism=false
```

- Test files: 1 passed / 1
- Tests: 11 passed / 11

```powershell
npm.cmd test -- tests\answer-panel-display.test.ts tests\ai-generation-trace.test.ts tests\ai-deliverables-generation-trace.test.ts tests\quality-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

- Test files: 4 passed / 4
- Tests: 36 passed / 36

```powershell
npm.cmd run typecheck
```

- PASS

```powershell
npm.cmd run build
```

- PASS
- Static pages generated: 28 / 28

## Boundary

This closes one visible copy-quality gap in the `/ask` answer panel. The workspace document pack still keeps provenance available through evidence/quality surfaces, and the raw API answer is preserved for audit/debugging.
