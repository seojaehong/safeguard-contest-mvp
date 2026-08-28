# Hermes Knowledge Review Authority UI

- Verdict: `PASS_LIVE_PRODUCTION_LLM_WIKI_CANDIDATE_CONTENT_READINESS`
- Source head: `ea9fb620c17be6dd3b21105d8df2accf9bff6994`
- Product commit: `ea9fb620c17be6dd3b21105d8df2accf9bff6994`
- Checked at: `2026-08-28T11:38:38.787Z`
- Scope: live production rendering with an authenticated, route-controlled review candidate fixture.
- Production aligned: `true`

| Theme | Viewport | Size | Body/viewport | Root width ratio | Columns/candidates/body | Authority roles | First action depth | Horizontal overflow | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| day | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 234.0 | no | PASS |
| day | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 234.0 | no | PASS |
| day | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 194.8 | no | PASS |
| day | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 194.8 | no | PASS |
| night | desktop | 1440x900 | 900/900 | 0.8 | 2/3/1 | 6 | 234.0 | no | PASS |
| night | desktop-short | 1440x723 | 723/723 | 0.8 | 2/3/1 | 6 | 234.0 | no | PASS |
| night | mobile | 390x844 | 854/844 | 0.92 | 1/3/1 | 6 | 194.8 | no | PASS |
| night | mobile-short | 390x723 | 733/723 | 0.92 | 1/3/1 | 6 | 194.8 | no | PASS |

## Contract

- The review card exposes six source-role counts while preserving the source order SIF -> KOSHA -> law -> tenant memory.
- Legal-duty claims require law provenance.
- Organization and site memory cannot be promoted publicly.
- Site-manager acceptance is required before workpack use.
- Machine evidence does not replace human review.
- The candidate navigator contains three fixtures while exactly one selected candidate body is mounted; its four required sections are presented as numbered, labelled, non-empty reviewer blocks, including bounded multiline continuation text inside a section.
- Candidate tabs expose one roving tab stop, linked tabpanel semantics, breakpoint-aware orientation, and Arrow/Home/End keyboard navigation.
- Desktop uses a two-column review workbench; mobile uses one column and keeps the candidate body internally scrollable.
- Desktop mounts the selected candidate and five-item evidence inspector together; mobile mounts one linked pane behind a keyboard-operable segmented tab control.
- Evidence digests keep at least 242px width and at most 18px height; readiness cells keep at least 167.75px on desktop and 104px on mobile, with labels no taller than 36px.
- The first decision action stays inside every measured viewport. All three decisions remain locked until the reviewer confirms the candidate sentence and evidence, then announce pending/busy/settled states around the delayed save fixture.
- Each selected candidate exposes one server-derived readiness panel with four required sections. A revision-required candidate presents human-readable remediation guidance without exposing internal issue codes.
- Revision confirmation keeps candidate approval locked while making the explicit site-only retention and rejection paths available.
- Explicit safe original-event review facts must appear in a distinct reviewer region inside the candidate pane, without duplicating their marker in the candidate body or exposing private event text.
- Only allowlisted public law, KOSHA, and SIF references expose verified HTTPS links. Organization and site evidence retain generic labels and bounded digests only.

## Boundary

- No DB mutation, provider dispatch, Share-session creation, or ontology publication was performed.
- Exact saved Share remains `MISSING_EVIDENCE`.
- LLM Wiki publication and live RLS isolation remain `APPROVAL_GATED`.
