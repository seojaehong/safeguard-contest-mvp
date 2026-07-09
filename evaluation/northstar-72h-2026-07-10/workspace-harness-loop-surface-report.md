# SafeClaw Workspace Harness Loop Surface

Checked at: 2026-07-10 KST

## Scope

This round addresses the product question: "Where is the harness, and where is the ontology?"

The backend already returns `dbHarness`, `ontologyQa`, and `qualityContract`, but the document page placed the DB harness inside the right-side evidence panel. That made the north-star loop easy to miss during a demo.

## Change

Added a compact `하네스·온톨로지 루프` strip to the `/workspace` document step.

The strip makes four states visible before the user opens the editor:

- `DB 하네스`: whether the DB-first evidence contract is locked or needs review.
- `온톨로지 QA`: whether required controls were reflected or need follow-up.
- `개선 루프`: whether photo/manual improvements or prior workpack memory are connected.
- `공유 readiness`: whether the workpack can move to sharing without hiding review blockers.

## Why This Matters

SafeClaw's differentiator is not document count. It is the loop:

`past work / improvement -> DB harness -> ontology QA -> today's risk assessment and TBM -> sharing/ack history`

This UI change puts that loop above the document viewer, where it can be understood during the first demo pass.

## Verification

Commands:

```powershell
npm.cmd test -- tests\workspace-layout-regression.test.ts -t "generated document edit flow"
npm.cmd test -- tests\workspace-layout-regression.test.ts
npm.cmd test -- tests\commercial-harness.test.ts tests\quality-contract.test.ts tests\workpack-readiness.test.ts tests\workpack-ontology-qa.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- Workspace generated-edit browser regression: passed.
- Workspace browser regression: 10 tests passed.
- Harness/quality/ontology readiness tests: 4 files, 24 tests passed.
- Typecheck: passed.
- Production build: passed.

## DB / Backend Impact

- No migration.
- No Supabase data mutation.
- No environment variable changes.
