# Hermes review subject context

## Verdict

`PASS_LIVE_PRODUCTION_HERMES_REVIEW_SUBJECT_CONTEXT`

The selected candidate body now appears before readiness and traceability details. The evidence pane retains a compact `검토 대상` cue so reviewers do not lose what the evidence is supporting.

## Measured result

- Current-source local production: 8/8 Day/Night desktop/mobile viewports passed.
- Candidate body precedes readiness: 8/8.
- Candidate first line is visible at the top of its local pane: 8/8.
- Desktop evidence subject context: 4/4.
- Mobile evidence subject context visible inside the evidence pane: 4/4.
- Maximum subject-context height: 47px.
- Horizontal overflow: 0/8.
- Live production commit: `f98d83995152394dbb2e76d018003299bc1d6b7a`.
- Live deployment: `safeguard-contest-o472d81p8-seojaehongs-projects.vercel.app`.

Evidence:

- `after-local/report.json`
- `after-live/report.json`
- `after-local/knowledge-review-evidence-readability-day-desktop-short-1440x723.png`
- `after-local/knowledge-review-candidate-subject-day-mobile-short-390x723.png`
- `after-local/knowledge-review-evidence-readability-day-mobile-short-390x723.png`
- `after-live/knowledge-review-candidate-subject-day-mobile-short-390x723.png`
- `after-live/knowledge-review-evidence-readability-day-mobile-short-390x723.png`

## Verification

- Static UI contract: 1 file / 17 tests PASS.
- Focused knowledge review/browser contract: 2 files / 19 tests PASS; one environment-gated browser file skipped.
- Strict typecheck: PASS.
- Production build: PASS, Next.js 15.5.22, 28 static pages.

## Boundary

This is a reviewer-context and reading-order proof. It does not complete human review, approve a candidate, publish the LLM Wiki, mutate ontology or database state, call a provider, or create a Share session. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; LLM Wiki publication and Supabase RLS launch isolation remain approval-gated.
