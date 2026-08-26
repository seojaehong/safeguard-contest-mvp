# Hermes evidence readability

Verdict: `PASS_CURRENT_SOURCE_LOCAL_HERMES_EVIDENCE_READABILITY_LIVE_PENDING`

## Finding

The prior live 1440x723 Hermes review screenshot passed containment metrics but exposed two reviewer-facing presentation defects. The evidence digest wrapped one character per line, and the four readiness labels compressed into narrow vertical fragments.

## Current-source remediation

- The evidence pane now uses its own inline-size container. At narrow pane widths, evidence rows become one column while the surrounding desktop workbench remains two panes.
- The candidate pane also uses its own inline-size container. Its readiness list becomes a readable 2x2 grid at narrow desktop pane widths.
- Mobile retains the existing selected one-column tabpanel behavior.

Browser contracts require digest width at least 160px and height at most 36px, readiness cells at least 120px wide, readiness labels at most 36px high, and zero page-level horizontal overflow.

## Verification

- Knowledge review browser: 2/2 PASS
- Adjacent Knowledge UI: 14/14 PASS; one environment-dependent browser case skipped
- Typecheck: PASS
- Production build: PASS, 28/28 static pages
- Visual evidence: `after-local-desktop-short-1440x723.png`, `after-local-mobile-390x844.png`

## Boundary

This is reviewer readability evidence, not completed human review or publication approval. No DB mutation, provider call, Share session, Wiki publication, or registry mutation occurred. Exact saved Share remains `MISSING_EVIDENCE`, LLM Wiki publication remains `APPROVAL_GATED`, and a deployed live-after rerun is still required.
