# Enhanced Row-First No-AI-Docs Gate

Date: 2026-07-10 KST

## Scope

The north-star contract says SafeClaw should not behave like a generic "many API calls + LLM prose" generator. In enhanced mode, the safety rows must come from the SafeClaw DB/SIF/KOSHA/photo/workpack harness first, and the LLM layer should not own the structured safety table.

This pass removes the final enhanced-mode AI document call for `structuredRiskRows`.

## Change

- `enhanced` AI deliverable scope now returns no AI document groups.
- `full` mode still keeps the broad AI document pack, including `structuredRiskRows`, `free`, `foreign`, and `tbmRiskLinks`.
- `/api/ask` enhanced mode no longer starts the AI deliverables promise.
- Enhanced mode now emits `doc:structuredRiskRows` after deterministic row validation, preserving the progress UI without waiting for an AI row call.
- Enhanced status detail now says `DB 하네스 row-first` instead of implying a document generator failure.

## Contract

Enhanced mode now means:

- Risk rows: deterministic harness rows + accepted photo hazard rows.
- TBM briefing/log structures: deterministic structures derived from the same risk rows.
- DB harness answer: fixed evidence authority remains `db_harness`.
- AI deliverable calls: zero in enhanced mode.

Full mode remains available for explicit full AI document generation.

## Verification

```powershell
npm.cmd test -- tests\ai-deliverables-scope.test.ts tests\commercial-harness.test.ts tests\workspace-generation-progress.test.ts tests\tbm-deterministic-structures.test.ts tests\quality-contract.test.ts
```

Result:

- 5 test files passed.
- 30 tests passed.

## Local Evidence

The commercial harness test confirms an enhanced `runAsk` response includes:

- `generationMode: enhanced`
- status detail containing `AI_MODE=enhanced (DB 하네스 row-first`
- status detail containing `structured rows=deterministic fallback`
- status detail containing `TBM structured=deterministic from risk rows`
- no `문서 생성기 미응답`
- no `Gemini 본문`
- deterministic risk rows, TBM risk links, TBM briefing structure, and TBM log structure.

## Post-Deploy Verification

Pending.
