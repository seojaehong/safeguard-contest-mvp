# SafeClaw Parallel UI Session Integration Audit

## Verdict

`PASS_CURRENT_LIVE_SUPERSEDES_STALE_PARALLEL_UI_BRANCHES_NO_MERGE`

Current source, origin, and production are aligned at `7b5c4549a04c1389349ef7857cdd59f6ecedf596`. The three parallel UI branches reviewed here were created from the older `c4781ee7` base on 2026-07-08. Their useful design intent has since been implemented and measured in the current branch, while their patches still rewrite shared command-center and global CSS surfaces.

## Branch Decisions

| Branch | Commit | Decision | Reason |
| --- | --- | --- | --- |
| `feat/safeclaw-document-rail` | `a497c541` | Superseded, do not merge | Current source already contains the selected-document cockpit, evidence rail, safety-control review, and work-history concepts with later browser contracts. |
| `feat/safeclaw-linear-shell` | `1cd42e3a` | Superseded, do not merge | Current source contains the evolved linear shell and route-scoped viewport containment. The old branch adds 877 CSS lines from an obsolete base. |
| `feat/safeclaw-share-workflow` | `93fad093` | Superseded, do not merge | Current live Share has scoped desktop three-zone and dispatch two-pane contracts. The old branch also carries stale photo-analysis and local-storage wording that conflicts with current product capability truth. |

## Current Evidence

- `evaluation/documents-long-form-ia-2026-07-22/report.json`: `PASS_LIVE_PRODUCTION_MEASURED`
- `evaluation/workspace-bounded-workbench-current-2026-07-22/report.json`: `PASS_LIVE_PRODUCTION_SCOPED_WITH_EXACT_SESSION_GAP`
- `evaluation/share-desktop-perception-2026-07-22/report.json`: `PASS_LIVE_PRODUCTION_SCOPED_WORKSPACE_AND_INVITED_FIXTURE`
- `evaluation/product-capability-truth-2026-07-25/report.json`: `PASS_LIVE_PRODUCTION_PRODUCT_CAPABILITY_TRUTH`

## Integration Boundary

No UI branch was merged, no DB or provider mutation occurred, and no Share session was created. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`; workspace and fixture geometry must not be used to close that boundary. Route splitting alone is not accepted as the UX fix: viewport-contained workbenches, internal scroll, and progressive disclosure remain the governing contract.

Future UI work should start from the current authoritative branch and bring fresh 1440x723 and 390x723 browser evidence. Cherry-picking these old whole commits would reintroduce broad CSS and copy drift.
