# Knowledge Current Gate (2026-07-20)

## Verdict

PASS for the previously reported `/knowledge` mobile presentation blockers on the current release line.

This is an evidence-only gate. No product code was changed in this pass.

## Scope

- Local HEAD: `7e96c2e6ec09158d846207dcaf558840b6f287bd`
- Production build-info at check time: `b1ec3635dbc0f60b4964ee5befbe2e03d311813f`
- Production branch: `master`
- Checked at: `2026-07-20T10:22:34.8913096+09:00`

## Findings Rechecked

### Raw Knowledge Terms

The prior live audit reported user-facing raw terms such as `human_review`, `published_ontology`, `Hermes / LLM`, and `SafeClaw system of record`.

Current source has a presentation boundary in `app/knowledge/page.tsx`:

- `human_review` is rendered as `사람 검토`.
- `published_ontology` is rendered as `게시된 안전지식`.
- `hermes_llm` is rendered as `AI 문서화 도구`.
- schema labels are localized through `localizeSchemaForPresentation()`.

### Mobile Touch Targets

The prior live audit reported sub-44px repeated controls in KOSHA reference details.

Current CSS in `app/knowledge/KnowledgePage.module.css` sets:

- `.rowDetails summary` / `.rawDetails summary`: `min-width: 44px`, `min-height: 44px`.
- `.detailContent a`: `min-width: 44px`, `min-height: 44px`.
- mobile layout widens `.rowDetails summary` to `width: 100%`.

### Mobile Information Architecture

Current source uses `KnowledgeSectionNavigator` and section panels instead of a single uninterrupted long governance/support/reference/wiki/schema page.

## Verification

Command:

```powershell
npm.cmd test -- tests\knowledge-page-layout.test.ts tests\knowledge-mobile-ia-browser.test.ts --maxWorkers=1 --fileParallelism=false
```

Result:

- Test files: 2 passed / 2
- Tests: 11 passed / 11
- Duration: 72.44s

## Notes

The current production build-info still points to `b1ec3635`. That is acceptable for this gate because `b1ec3635` contains the product code already observed live for the workspace edit-first fix, while the newer local commit `7e96c2e6` only records geometry evidence.
