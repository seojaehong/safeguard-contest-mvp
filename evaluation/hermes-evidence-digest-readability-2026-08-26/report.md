# Hermes evidence readability

Verdict: `PASS_LIVE_PRODUCTION_HERMES_EVIDENCE_READABILITY`

## Finding

The prior live 1440x723 Hermes review screenshot passed containment metrics but exposed two reviewer-facing presentation defects. The evidence digest wrapped one character per line, and the four readiness labels compressed into narrow vertical fragments.

## Current-source remediation

- The evidence pane now uses its own inline-size container. At narrow pane widths, evidence rows become one column while the surrounding desktop workbench remains two panes.
- The candidate pane also uses its own inline-size container. Its readiness list becomes a readable 2x2 grid at narrow desktop pane widths.
- Mobile retains the existing selected one-column tabpanel behavior.

Browser contracts require digest width at least 160px and height at most 36px, readiness cells at least 120px wide on desktop and 96px on mobile, readiness labels at most 36px high, and zero page-level horizontal overflow.

## Verification

- Knowledge review browser: 2/2 PASS
- Knowledge governance + browser contract: 17/17 PASS
- Live production evidence inspector: 8/8 PASS across Day/Night and 1440x900, 1440x723, 390x844, and 390x723
- Source and production marker aligned at `c3a47b61549253620b33e39acd30f149ea9d1c56`
- Live digest: minimum width 242px, maximum height 18px
- Live readiness: minimum cell width 167.75px desktop and 104px mobile; maximum label height 36px
- Adjacent Knowledge UI: 14/14 PASS; one environment-dependent browser case skipped
- Typecheck: PASS
- Production build: PASS, 28/28 static pages
- Northstar generators: 3 files / 148 tests PASS; a combined-suite timeout was isolated and the full open-gate file reran 134/134 PASS
- Visual evidence: `after-local-desktop-short-1440x723.png`, `after-local-mobile-390x844.png`, `after-live/knowledge-review-evidence-readability-day-desktop-short-1440x723.png`, `after-live/knowledge-review-evidence-readability-day-mobile-short-390x723.png`

## Boundary

This is reviewer readability evidence, not completed human review or publication approval. No DB mutation, provider call, Share session, Wiki publication, or registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`, and LLM Wiki publication remains `APPROVAL_GATED`.
