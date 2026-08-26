# Hermes review decision first viewport

## Verdict

`PASS_LIVE_PRODUCTION_HERMES_REVIEW_DECISION_FIRST_VIEWPORT`

The selected Hermes review candidate now exposes its first decision inside the initial viewport. All three decisions remain locked until the reviewer confirms the candidate sentence and evidence; approval still additionally requires ready content and complete traceability.

## Measured result

- Before live: 0/8 Day/Night desktop/mobile viewports passed.
- After current-source local production: 8/8 passed.
- After live deployment: 8/8 passed at production commit `9dc504ef7686ffb71f13da742a93b97647fcb8a1`.
- Desktop-short first action bottom: 957.39px before, 532.44px after live, viewport 723px.
- Mobile-short first action bottom: 818.80px before, 622.75px after live, viewport 723px.
- Occluded first actions after live: 0/8, verified with browser hit-testing.
- Confirmation required before any decision: 8/8.
- Confirmation unlocks all three decisions: 8/8.
- Horizontal overflow: 0/8.

Evidence:

- `before-live/report.json`
- `after-local/report.json`
- `after-live/report.json`
- `after-live/knowledge-review-authority-day-desktop-short-1440x723.png`
- `after-live/knowledge-review-authority-day-mobile-short-390x723.png`

## Verification

- Knowledge UI regression: 5 files / 43 tests PASS; one environment-gated file skipped.
- Strict typecheck: PASS.
- Production build: PASS, Next.js 15.5.22, 28 static pages.

## Boundary

This is a reviewer decision-placement and confirmation proof. It does not complete human review, approve a candidate, publish the LLM Wiki, mutate ontology or database state, call a provider, create a Share session, write embeddings/vectors, or promote the KOSHA exact registry. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; LLM Wiki publication, Supabase RLS isolation, and provider persistence remain approval-gated.
