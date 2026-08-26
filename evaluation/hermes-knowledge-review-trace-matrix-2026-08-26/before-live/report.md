# Hermes Knowledge Review Authority UI

- Verdict: `RED_HERMES_REVIEW_TRACE_MATRIX`
- Source head: `566e954f5b063bb88e1f3a2c8858de07c4da794a`
- Product commit: `23927b286c7d7c37ff94230bf262caa33690df30`
- Checked at: `2026-08-26T06:02:44.472Z`
- Scope: live production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `true`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 655.0 | no | RED |
| day | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 655.0 | no | RED |
| day | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 838.8 | no | RED |
| day | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 838.8 | no | RED |
| night | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 655.0 | no | RED |
| night | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 655.0 | no | RED |
| night | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 838.8 | no | RED |
| night | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 838.8 | no | RED |

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
- Explicit safe original-event review facts must appear in a distinct reviewer region inside the candidate pane, without duplicating their marker in the candidate body or exposing private event text.
- Only allowlisted public law, KOSHA, and SIF references expose verified HTTPS links. Organization and site evidence retain generic labels and bounded digests only.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
