# Hermes Multiline Candidate Review

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_MULTILINE_CANDIDATE_REVIEW`
- Product/source/production: `00945d276926470eaf519f2317cdabe98acc2e92`
- Deployment: `safeguard-contest-raeze89ki-seojaehongs-projects.vercel.app`

## Finding

The reviewer UI previously required a candidate body to contain exactly four physical lines. A valid four-section LLM candidate therefore fell back to an undifferentiated raw paragraph whenever one section contained a continuation line or bullet.

## Remediation

- Require the exact ordered labels `위험요인 요약`, `문서 반영 위치`, `통제대책`, and `검수 필요 항목`.
- Reject missing, empty, duplicated, skipped, or malformed numbered section headers into the existing raw fallback.
- Preserve valid continuation lines inside the preceding section and render their line breaks without expanding the outer page.

## Verification

- Focused browser and contract tests: 2 files / 21 tests PASS.
- Adjacent knowledge UI tests: 4 files / 32 tests PASS.
- Strict typecheck: PASS.
- Production build: PASS, 28 static pages.
- Current-source local browser: 8/8 Day/Night desktop/mobile cases PASS.
- Live production browser: 8/8 Day/Night desktop/mobile cases PASS.
- Live selected candidate/body/sections: 1/1/4, all non-empty, multiline continuation preserved.
- Desktop/mobile columns: 2/1; candidate internal scroll, first decision action, and zero horizontal overflow all PASS.

## Boundary

The browser evidence uses a route-controlled candidate fixture and does not read the actual production candidate queue. Human review remains incomplete, candidates remain unpublished, and machine evidence does not replace human review. No DB, provider, dispatch, Share-session, Wiki, ontology, embedding/vector, or KOSHA registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`; Wiki publication and RLS remain `APPROVAL_GATED`; enhanced LLM runtime remains blocked by distributed admission configuration; security-complete remains false.
