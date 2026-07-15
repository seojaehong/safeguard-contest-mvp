# Operation Memory Obsidian Export Check

Date: 2026-07-09

## Scope

- Added an Obsidian-friendly operation memory export next to the existing Markdown and JSONL exports.
- Kept the existing operation graph, hover cards, and list model intact.
- No DB schema change, migration, embedding upload, or published ontology promotion was performed.

## Implemented Contract

- `format=obsidian` is accepted by the workpack learning export route.
- The exported file uses Markdown with YAML frontmatter.
- Frontmatter keeps the governance boundary explicit:
  - `safeclaw_memory_scope: operation_memory_export`
  - `authority: operator_review_corpus`
  - `promotion_status: draft_candidate`
  - `runtime_authority: false`
  - `model_fine_tuning: false`
- Workpack, hazard, control, improvement, evidence, and ack nodes are exported as Obsidian wikilinks.
- Graph relations are exported as readable relation lines, for example `--hasImprovement-->`.

## Verification

Commands:

```powershell
npm.cmd test -- tests\operation-memory-visualization.test.ts tests\commercial-harness.test.ts
npm.cmd run typecheck
npm.cmd run build
```

Results:

- Vitest: 2 files passed, 15 tests passed.
- TypeScript: `tsc --noEmit --incremental false` passed.
- Next build: completed successfully.

Browser check:

- Local route: `http://localhost:3017/ontology`
- Expected buttons found: `작업 이력 MD`, `하네스 JSONL`, `Obsidian MD`
- Horizontal overflow: none detected
- Console errors: none detected
- Screenshot: `evaluation/ui-ux-browser-check-2026-07-09/ontology-obsidian-export.png`

## Notes

This export is a review surface, not model fine-tuning. It makes the daily work history graph portable for operator review and later promotion, while the runtime authority remains the SafeClaw MCP/DB harness.
