# Ontology Production Gate

Checked at: 2026-07-20 KST

## Verdict

`/ontology` P0 hairball blocker is **not reproduced** on the current production deployment.

Current production is serving commit `98ddcdddf05c8e5d478a8009a13bde0405b9b684` from `master`. The page now renders a bounded selected-neighborhood graph on desktop and a relation-card/list-first view on mobile, rather than the previous full 166-node overlapping graph.

## Production Build

- URL: `https://www.safeclaw.kr/ontology`
- Build info source: `https://www.safeclaw.kr/api/build-info`
- Commit: `98ddcdddf05c8e5d478a8009a13bde0405b9b684`
- Branch: `master`
- Environment: `production`
- Deployment URL: `safeguard-contest-2fxh99vr9-seojaehongs-projects.vercel.app`

## Browser Metrics

| Variant | Viewport | Page height | Horizontal overflow | Outside elements | Visible graph nodes | Node overlap pairs | Mobile relation buttons |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop Day | 1440x900 | 2077 | false | 0 | 13 | 0 | 0 |
| Desktop Night | 1440x900 | 2077 | false | 0 | 13 | 0 | 0 |
| Mobile Day | 390x844 | 2893 | false | 0 | 0 | 0 | 6 |
| Mobile Night | 390x844 | 2893 | false | 0 | 0 | 0 | 6 |

## Evidence

- Raw metrics: `evaluation/ontology-production-gate-2026-07-20/metrics.json`
- Measurement script: `evaluation/ontology-production-gate-2026-07-20/run-ontology-production-gate.mjs`
- Screenshots:
  - `evaluation/ontology-production-gate-2026-07-20/desktop-day.png`
  - `evaluation/ontology-production-gate-2026-07-20/desktop-night.png`
  - `evaluation/ontology-production-gate-2026-07-20/mobile-day.png`
  - `evaluation/ontology-production-gate-2026-07-20/mobile-night.png`

## Interpretation

The earlier live audit finding was valid for the surface it measured: the old ontology page exposed an unreadable node hairball with overlap, poor contrast, and mobile viewport escape. On the current production commit, that specific launch blocker appears closed.

If a user still sees the old graph, the likely causes are stale local server, stale branch, browser cache, or a non-authoritative deployment URL. The production marker above should be used to separate stale-surface reports from current production behavior.

## Remaining Product Risk

This gate only closes the graph readability/overflow blocker. It does not claim the broader `/ontology` IA is final. The page is still a long knowledge surface and should remain on the post-launch refinement list for progressive disclosure, search-first task flow, and clearer operator copy.
