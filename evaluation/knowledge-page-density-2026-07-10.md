# Knowledge page density verification

## Scope

- Refactored only the KOSHA technical support and PDF reference-library presentation on `/knowledge`.
- Kept `SafeClawModuleShell` and `app/globals.css` unchanged.
- Added page-scoped layout rules and a dedicated deterministic/browser regression test.

## Data preservation

| Surface | Preserved evidence |
| --- | --- |
| Catalog status | Current rendered snapshot retained 9,920 catalog items and 1,063 sources. |
| KOSHA totals | Current rendered snapshot retained 1,040 total items, split into 237 regulations and 803 guidelines. |
| Ingestion provenance | Current rendered snapshot retained 2 ingestion runs and the catalog connection message from `stats.message`. |
| Dynamic technical rows | All entries from `stats.samples` still render from the runtime catalog, including source kind, bounded summary, reflected document location, evidence role, query link, and optional source URL. |
| PDF reference rows | All 7 existing KOSHA PDF paths, titles, summaries, file sizes, source kinds, and reflected document locations remain present. |
| PDF provenance | The existing KOSHA / 안전보건공단 / 공공누리 1유형 source statement remains visible. |
| Built-in wiki | Current rendered snapshot retained 8 hazard entries and 4 form entries, plus the raw index and schema disclosures. |

## Layout checks

- Desktop KOSHA rows resolve to three scan columns: identity, concise summary, and reflected document location.
- Mobile KOSHA rows resolve to one column at 390 px.
- Page, list, row, summary, and opened-details content stayed within the viewport in both browser checks.
- Scoped border radii are bounded at 8 px and no gradient styling is used.
- Runtime summaries are bounded by `KNOWLEDGE_SUMMARY_MAX_LENGTH = 150` without changing source records.

## Execution log

### Focused test

Command:

```text
npm.cmd test -- tests/knowledge-page-layout.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    27.67s
```

The suite includes semantic `ul` / `li` / `details` source contracts and an isolated Next.js + Playwright check with a process-specific port and dist directory.

### TypeScript

Command:

```text
npm.cmd run typecheck
```

Result: exit code 0 with no TypeScript diagnostics.

## Owned files

- `app/knowledge/page.tsx`
- `app/knowledge/KnowledgePage.module.css`
- `tests/knowledge-page-layout.test.ts`
- `evaluation/knowledge-page-density-2026-07-10.md`
