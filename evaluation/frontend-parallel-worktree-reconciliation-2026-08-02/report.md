# Frontend Parallel Worktree Reconciliation

Verdict: `PASS_NO_UNMERGED_UI_BRANCH_REQUIRES_WHOLE_BRANCH_INTEGRATION`

Authoritative master is `a26b031c0557777c540e9003f3dd8a39f236e65c`. The live product/evidence baseline used for route geometry is `f53885a652f71c4315f27a7aa9476677e8c92ced`.

## Decision

The inspected parallel UI branches do not contain a whole branch that should be merged into current master. Their useful product ideas are already present in newer code and are covered by stronger route-specific evidence. Their remaining diffs are old, broad CSS/component rewrites that would risk regressing the current Documents and Share cockpit contracts.

| Branch | State | Decision | Current-master replacement |
| --- | --- | --- | --- |
| `feat/safeclaw-document-rail` | clean, unmerged, 2026-07-08 | Do not merge wholesale | Document review strip, core 3/supporting 9, selected-only workbench, live 48/48 raw-source containment |
| `feat/safeclaw-linear-shell` | clean, unmerged, 2026-07-08 | Do not merge wholesale | Current step shell and route-specific viewport containment without old sticky full-height shell override |
| `feat/safeclaw-share-workflow` | clean, unmerged, 2026-07-08 | Do not merge wholesale | `share-workflow-header`, `data-share-preview`, desktop three-zone workspace Share, standalone dispatch two-pane, mobile-only stack |
| `fix/docs-share-viewport-ia` | clean, merged | Already integrated | Branch head is an ancestor of master |
| `fix/frontend-final-gate-current` | 16 dirty files | Preserve, no integration | The useful preview typography selector is already present; dirty generated evidence remains owned by that worktree |
| `feat/frontend-workspace-viewport-wave7` | 1 dirty file | Preserve, no integration | Current route-specific live geometry supersedes the old global spacing patch |

## Current Contract Signals

- Current master contains the selected-document workbench and `document-review-status-strip`.
- Current master contains `data-share-preview` and the scoped desktop Share workbench selectors.
- Current `WorkpackEditor` contains the corrected submission preview typography selector from the old final-gate branch.
- The live raw-source drilldown matrix passes 48/48 Day/Night desktop-short/mobile-short rows.
- Existing Share evidence remains scoped. Exact saved `/share/[sessionId]` is still `MISSING_EVIDENCE`.

## Guardrail

Do not cherry-pick these old branches by commit or merge them wholesale. If a user-visible gap is reproduced on current production, compare that single behavior against the old branch and extract only a bounded patch onto current master. Route split alone is not accepted as the IA fix.

No DB mutation, provider dispatch, Share-session creation, or product source edit was performed by this audit.
