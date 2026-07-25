# Hermes Knowledge Review Authority UI

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI`
- Source head: `a9fcde386f0d97e8b46553a9f083892f14e11799`
- Product commit: `a9fcde386f0d97e8b46553a9f083892f14e11799`
- Checked at: `2026-07-25T01:49:51.979Z`
- Scope: current-source local production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `false`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 5715/900 | 0.81 | 6 | 467.1 | no | PASS |
| day | desktop-short | 1440x723 | 5715/723 | 0.81 | 6 | 467.1 | no | PASS |
| day | mobile | 390x844 | 3667/844 | 0.94 | 6 | 768.3 | no | PASS |
| day | mobile-short | 390x723 | 3667/723 | 0.94 | 6 | 768.3 | no | PASS |
| night | desktop | 1440x900 | 5715/900 | 0.81 | 6 | 467.1 | no | PASS |
| night | desktop-short | 1440x723 | 5715/723 | 0.81 | 6 | 467.1 | no | PASS |
| night | mobile | 390x844 | 3667/844 | 0.94 | 6 | 768.3 | no | PASS |
| night | mobile-short | 390x723 | 3667/723 | 0.94 | 6 | 768.3 | no | PASS |

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
