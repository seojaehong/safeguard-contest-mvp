# Ontology Current HEAD Geometry Check

Date: 2026-07-20

HEAD: `6314728790a2cd42f87a96280b98b8e88918984f`

Served surface: `http://localhost:3024/ontology`

Server: `next start --port 3024` after `npm.cmd run build`

## Verdict

PARTIAL PASS. The previous live P0 description of a 166-node hairball is not reproduced on the current authoritative code path. The current page renders a bounded selected-neighborhood graph on desktop and switches to relation cards on mobile.

## Desktop 1440x900

- Body height: `2383px`
- Page horizontal overflow: `false`
- Outside elements: `0`
- Neighborhood graph nodes: `13`
- Neighborhood overlap pairs: `0`
- Graph rect: `x=261`, `y=890.39`, `w=1154`, `h=562`

## Mobile 390x844

- Body height: `4602px`
- Page horizontal overflow: `false`
- Outside elements: `0`
- Desktop graph hidden: `true`
- Mobile relation cards visible: `true`
- Mobile relation cards rect: `x=17`, `y=1271.38`, `w=356`, `h=1250`
- Neighborhood graph nodes in DOM: `13`
- Neighborhood overlap pairs: `0`

## Remaining Risk

The graph-collision P0 appears fixed in current code. The remaining issue is information architecture: mobile `/ontology` is still long at `4602px`, so task-based collapse or a deeper route split remains a future UX remediation.

This was measured against a local production build because the production build marker had not yet advanced to the latest master at measurement time.
