# Workspace Documents Live Geometry Check

Checked at: 2026-07-20 KST

## Verdict

LIVE VERIFIED on production commit `acb94db188b46fb8d1e057fe13ef713950963277`.

The production deployment now reflects the compact generation-review patch. The prior live state on `ba5a1092` was not stale and had a real generation-surface scroll burden; this live check confirms the follow-up patch reduced that burden on the served surface.

## Served Surface

- URL: `https://www.safeclaw.kr/workspace?scenario=seoul-construction-windy&theme=day`
- Build marker: `acb94db188b46fb8d1e057fe13ef713950963277`
- Branch: `master`
- Environment: `production`
- Raw artifact: `evaluation/workspace-doc-share-live-geometry-2026-07-20-acb94db1/report.json`

## Production Geometry

| Viewport | Document height | Preview y | Ready marker | Sticky | Horizontal overflow |
| --- | ---: | ---: | --- | ---: | --- |
| 1440x723 | 1149px | 482.05px | true | 0 | false |
| 390x844 | 1348px | 701.05px | true | 0 | false |

## Notes

- This check focused on the generated Documents step because the previous blocker was the long/sticky document surface.
- Share composition remains covered by the local post-patch geometry report and browser regression tests. The live free-generation path can still keep Share disabled when readiness does not pass; that is a separate readiness/product gate, not a stale-deployment issue.
