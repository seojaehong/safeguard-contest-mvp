# Parallel UI Branch Current Audit

## Verdict

`PASS_CURRENT_SOURCE_PARALLEL_UI_RESULTS_REVIEWED_NO_CHERRY_PICK`

Authoritative source and production are aligned at `137ea586f84b5abed5f307fb283d9d8eb1ea57d2`. Eight parallel UI branches were compared with the current branch. One branch is already an ancestor, seven are superseded, and no direct cherry-pick is recommended.

## Classification

| Branch | Unique | Behind | Decision |
| --- | ---: | ---: | --- |
| `feat/safeclaw-document-rail` | 1 | 2259 | Superseded by the selected-only Documents workbench and live all-document geometry. |
| `feat/safeclaw-linear-shell` | 1 | 2259 | Superseded; the old global shell rewrite would reopen broad cascade risk. |
| `feat/safeclaw-share-workflow` | 1 | 2259 | Superseded by the scoped desktop three-zone Share workbench and capability-truth UI. |
| `fix/docs-share-viewport-ia` | 0 | 160 | Already an ancestor of current source. |
| `fix/frontend-final-gate-current` | 3 | 1940 | Preview tracking intent is present in current WorkpackEditor; historical evidence is stale. |
| `feat/frontend-workspace-viewport-wave7` | 4 | 1992 | Current viewport tests and live evidence independently enforce the intended containment. |
| `feat/documents-mobile-priority` | 2 | 2061 | Current source proves core 3, supporting 9 collapsed, and live 32px action margin. |
| `feature/share-session-ui-v2` | 3 | 2092 | Current policy/state contracts are stronger; exact saved Share remains separately unproven. |

## Current Proof

- Documents: 48/48 live rows across 12 documents, Day/Night, 1440x723 and 390x723; minimum and required pane margin are both 32px.
- Workspace Share: the original current-head geometry evidence at `137ea586` passed all 8 scoped rows, but a stronger outer step-status fit contract found both desktop rows RED: the rail was 264px and two status labels overflowed by up to 37px. Product commit `4544e3dc` expands the route-scoped rail to 1180px; all 8 local and live rows now pass with zero status overflow, with live evidence aligned at `b9275601`.
- Current source retains mobile core-document priority, section navigation, document preview tracking, Share evidence scoping, and persistent-idempotency fail-closed policy.
- New UI work must start from the authoritative branch and produce fresh 1440x723 and 390x723 evidence before making another current-head Share claim.

## Boundary

This audit does not claim that fixture or Workspace Share proves an exact saved `/share/[sessionId]`. Exact saved Share remains `MISSING_EVIDENCE`. No product, DB, provider, Share-session, vector, wiki, or KOSHA-registry mutation was performed, and route splitting alone is not accepted as the UX fix.
