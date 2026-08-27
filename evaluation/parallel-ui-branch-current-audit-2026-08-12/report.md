# Parallel UI Branch Current Audit

## Verdict

`PASS_CURRENT_SOURCE_PARALLEL_UI_RESULTS_REVIEWED_NO_CHERRY_PICK`

Authoritative source and production are aligned at `5f280fafeb1c378eedff35e1dc1c011eda802716`. Eight parallel UI branches were compared with the current branch. One branch is already an ancestor, seven are superseded, and no direct cherry-pick is recommended.

## Classification

| Branch | Unique | Behind | Decision |
| --- | ---: | ---: | --- |
| `feat/safeclaw-document-rail` | 1 | 2626 | Superseded by the selected-only Documents workbench and current live geometry. |
| `feat/safeclaw-linear-shell` | 1 | 2626 | Superseded; the old global shell rewrite would reopen broad cascade risk. |
| `feat/safeclaw-share-workflow` | 1 | 2626 | Superseded by the scoped desktop three-zone Share workbench and capability-truth UI. |
| `fix/docs-share-viewport-ia` | 0 | 527 | Already an ancestor of current source. |
| `fix/frontend-final-gate-current` | 3 | 2307 | Preview tracking intent is present in current WorkpackEditor; historical evidence is stale. |
| `feat/frontend-workspace-viewport-wave7` | 4 | 2359 | Current viewport tests and live evidence independently enforce the intended containment. |
| `feat/documents-mobile-priority` | 2 | 2428 | Current source proves core 3, supporting 9 collapsed, and bounded active editing. |
| `feature/share-session-ui-v2` | 3 | 2459 | Current policy/state contracts are stronger; exact saved Share remains separately unproven. |

## Current Proof

- Fresh `5f280faf` live probe: Documents 20/20 PASS across Day/Night, 1440x723 and 390x723, with body ratio 1.0, detail-depth debt 0, sticky overlap 0, and horizontal overflow false.
- Work-plan detail remains internally bounded: shell ratio 2.21 desktop and 2.32 mobile; first action bottoms at 339px desktop and at most 637px mobile within the 723px viewport.
- Workspace/fixture Share: 8/8 scoped rows PASS. Workspace desktop uses a 0.82-width three-region workbench with primary action bottom 389px and preview bottom 571px; mobile is a distinct stack with primary action bottom 696px. Horizontal overflow is false.
- Current source contains the document viewer/evidence rail/progress concepts, linear workspace topbar, and Share workflow/form/preview concepts from the old branches. Their obsolete broad CSS patches are not required.
- Direct screenshot review confirms a visible selected editor on desktop, core 3 plus bounded editor on mobile, a real desktop Share three-zone workbench with no phone mock, and a distinct mobile stack. No incoherent overlap or text clipping was observed in the four representative Day screenshots.
- Verification: 28 live geometry rows with 0 failures, 3 focused files / 60 tests PASS, Northstar UI gate proven, and aggregate contradictions 0.
- New UI work must start from the authoritative branch and produce fresh 1440x723 and 390x723 evidence before making another current-head Share claim.

## Boundary

This audit does not claim that fixture or Workspace Share proves an exact saved `/share/[sessionId]`. Exact saved Share remains `MISSING_EVIDENCE`. No product, DB, provider, Share-session, vector, wiki, or KOSHA-registry mutation was performed, and route splitting alone is not accepted as the UX fix.
