# Hermes Knowledge Review Authority UI

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI`
- Source head: `6453a595d4771d64f07d79d3f042509be876c707`
- Product commit: `6453a595d4771d64f07d79d3f042509be876c707`
- Checked at: `2026-08-13T21:23:16.724Z`
- Scope: current-source local production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `false`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 5803/900 | 0.81 | 2/3/1 | 6 | 555.0 | no | PASS |
| day | desktop-short | 1440x723 | 5803/723 | 0.81 | 2/3/1 | 6 | 555.0 | no | PASS |
| day | mobile | 390x844 | 3792/844 | 0.94 | 1/3/1 | 6 | 897.6 | no | PASS |
| day | mobile-short | 390x723 | 3792/723 | 0.94 | 1/3/1 | 6 | 897.6 | no | PASS |
| night | desktop | 1440x900 | 5803/900 | 0.81 | 2/3/1 | 6 | 555.0 | no | PASS |
| night | desktop-short | 1440x723 | 5803/723 | 0.81 | 2/3/1 | 6 | 555.0 | no | PASS |
| night | mobile | 390x844 | 3792/844 | 0.94 | 1/3/1 | 6 | 897.6 | no | PASS |
| night | mobile-short | 390x723 | 3792/723 | 0.94 | 1/3/1 | 6 | 897.6 | no | PASS |

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
