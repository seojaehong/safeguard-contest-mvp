# Hermes review candidate position

## Verdict

`PASS_LIVE_PRODUCTION_HERMES_REVIEW_CANDIDATE_POSITION`

Each candidate card now displays its one-based position, for example `검토 대기 · 후보 1/3`. The position stays inside the existing card header, so the compact mobile navigator gains orientation without another row or additional first-viewport depth.

## Measured result

- Current-source local production: 8/8 Day/Night desktop/mobile viewports passed.
- Live production: 8/8 viewports passed at `b3d5afe15ba7514214d55b28e47def520162c0a8`.
- Candidate position sequence: `1/3`, `2/3`, `3/3` in every measured viewport.
- Selected-only workbench, roving tab stop, Arrow/Home/End navigation, first-viewport decision rail, and explicit decision confirmation remain intact.
- Baseline source/screenshot at `9dc504ef` did not expose a numeric candidate position. This is recorded as a visual/source baseline, not a retroactively generated RED result.

Evidence:

- `after-local/report.json`
- `after-live/report.json`
- `after-live/knowledge-review-authority-day-mobile-short-390x723.png`
- `../hermes-review-decision-first-viewport-2026-08-27/after-live/knowledge-review-authority-day-mobile-short-390x723.png` (baseline)

## Verification

- Focused browser and static contract: 2 files / 19 tests PASS.
- TypeScript strict typecheck: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.

## Boundary

- Human review remains incomplete, and machine evidence does not replace it.
- No candidate was approved or published.
- No DB, provider, Share-session, embedding/vector, Wiki, ontology, or KOSHA registry mutation was performed.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
- LLM Wiki publication, Supabase RLS isolation, and provider dispatch persistence remain `APPROVAL_GATED`.
