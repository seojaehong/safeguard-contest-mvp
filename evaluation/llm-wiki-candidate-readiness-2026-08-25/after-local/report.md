# Hermes Knowledge Review Authority UI

- Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_REVIEW_AUTHORITY_UI`
- Source head: `2b7c874f668603d62edf2cac08968cf09a12c158`
- Product commit: `aac729a3`
- Checked at: `2026-08-25T11:30:54.718Z`
- Scope: current-source local production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `false`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 655.0 | no | PASS |
| day | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 655.0 | no | PASS |
| day | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 838.8 | no | PASS |
| day | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 838.8 | no | PASS |
| night | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 655.0 | no | PASS |
| night | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 655.0 | no | PASS |
| night | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 838.8 | no | PASS |
| night | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 838.8 | no | PASS |

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted.
- Candidate tabs expose one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and Arrow/Home/End keyboard navigation.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.
- Desktop mounts the selected candidate and five-item evidence inspector together; mobile mounts one linked pane behind a keyboard-operable segmented tab control.
- Review decisions announce their pending state, expose busy semantics, disable all competing actions, and restore the settled status after the delayed save fixture completes.
- Each selected candidate exposes one server-derived readiness panel with four required sections. A revision-required candidate disables only candidate approval while keeping site-only retention and rejection available.
- Only allowlisted public law, KOSHA, and SIF references expose verified HTTPS links. Organization and site evidence retain generic labels and bounded digests only.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
