# Hermes Knowledge Review Authority UI

- Verdict: `PASS_LIVE_PRODUCTION_HERMES_REVIEW_EVIDENCE_INSPECTOR`
- Source head: `b15df85b68235871ac521d01a6334ad90b122a26`
- Product commit: `be8a0f143f40689fc02af791bc0b7ae5509046cd`
- Checked at: `2026-08-16T04:51:53.142Z`
- Scope: live production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `true`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 5903/900 | 0.81 | 2/3/1 | 6 | 655.0 | no | PASS |
| day | desktop-short | 1440x723 | 5903/723 | 0.81 | 2/3/1 | 6 | 655.0 | no | PASS |
| day | mobile | 390x844 | 3694/844 | 0.94 | 1/3/1 | 6 | 903.6 | no | PASS |
| day | mobile-short | 390x723 | 3694/723 | 0.94 | 1/3/1 | 6 | 903.6 | no | PASS |
| night | desktop | 1440x900 | 5903/900 | 0.81 | 2/3/1 | 6 | 655.0 | no | PASS |
| night | desktop-short | 1440x723 | 5903/723 | 0.81 | 2/3/1 | 6 | 655.0 | no | PASS |
| night | mobile | 390x844 | 3694/844 | 0.94 | 1/3/1 | 6 | 903.6 | no | PASS |
| night | mobile-short | 390x723 | 3694/723 | 0.94 | 1/3/1 | 6 | 903.6 | no | PASS |

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.
- Desktop mounts the selected candidate and five-item evidence inspector together; mobile mounts only the selected candidate or evidence pane behind a segmented control.
- Only allowlisted public law, KOSHA, and SIF references expose verified HTTPS links. Organization and site evidence retain generic labels and bounded digests only.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
