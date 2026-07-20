# SafeClaw Workspace IA Open Blockers

- Generated: 2026-07-20T14:05:00Z
- Updated: 2026-07-21 KST
- Scope: `/workspace` generated Documents and Share surfaces
- Verdict: RESOLVED FOR CURRENT PRODUCTION COCKPIT GATE

## Current Production Reconciliation

Fresh production geometry was rerun against `https://www.safeclaw.kr` after the responsive share and document cockpit waves.

- Production marker: `72b282315b7dcdd2bcc538de13dee9fd7d4c1c80`
- Geometry artifact: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- Checked at: `2026-07-20T15:50:36.684Z`

The earlier contradictory evidence is no longer authoritative for the current surface.

## What Is Closed Now

The current production gate closes the previously open cockpit blockers:

- Documents desktop-short 1440x723:
  - `documentWorkbench.bottom = 722`
  - `safetyBrief.bottom = 649`
  - `riskAssessmentEditCta.bottom = 391`
  - `safetyBriefShareCta.bottom = 441`
  - `documentProvenanceSummary.bottom = 702`
  - `documentDeepReviewSummary.bottom = 710`
  - `visibleDocumentPreviews = 0`
  - `documentDeepReviewOpen = false`
  - `overflowX = false`, `outside = 0`
- Documents mobile 390x844:
  - `documentWorkbench.bottom = 835`
  - `safetyBrief.bottom = 762`
  - `riskAssessmentEditCta.bottom = 551`
  - `safetyBriefShareCta.bottom = 552`
  - `documentProvenanceSummary.bottom = 815`
  - `documentDeepReviewSummary.bottom = 823`
  - `visibleDocumentPreviews = 0`
  - `documentDeepReviewOpen = false`
  - `overflowX = false`, `outside = 0`
- Share desktop-short 1440x723:
  - `sharePreview.width = 520`
  - `sharePreview.bottom = 705`
  - `primaryShareCta.bottom = 349`
  - `overflowX = false`, `outside = 0`
- Share mobile 390x844:
  - `shareMobileSummary.bottom = 432`
  - `sharePreview.bottom = 659`
  - `primaryShareCta.bottom = 720`
  - `overflowX = false`, `outside = 0`

This closes the concrete stale blockers: the desktop share screen is no longer measured as a narrow 380px mobile-style card, the mobile share preview conflict is reconciled to the current 659px bottom / 432px summary / 720px CTA geometry, and Documents default keeps the full preview closed while the decision cockpit is inside the viewport.

## Product Structure Decision

The structural answer remains important:

- Route splitting alone is not the length fix.
- Each route must be a one-decision cockpit by default.
- Long document bodies, evidence logs, export settings, and transmission history remain valid, but they must live behind explicit deep-review/details surfaces.
- The product message is: `핵심 판단은 빠르게, 전체 12종은 필요할 때 깊게 검토.`

## Remaining Follow-Up

The current production cockpit gate is resolved. Future north-star work should not reopen this blocker from stale evidence unless a fresh production geometry run contradicts the current artifact.

Separate future work remains valid for deeper manager-mode polish, document-specific editors, and live provider dispatch, but those are not this resolved cockpit blocker.
