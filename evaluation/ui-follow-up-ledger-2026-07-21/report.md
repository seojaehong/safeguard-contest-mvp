# UI Follow-Up Ledger

Checked at: 2026-07-21 02:34 KST

## Current Split Verdict

- Documents desktop cockpit: PASS
- Share desktop cockpit: PASS
- Documents mobile cockpit: PASS after the 2026-07-21 internal-pane production patch
- Share mobile action cockpit: PASS after the 2026-07-21 bounded mobile patch
- Share mobile default flow: PASS after adding the selected 대상/채널/언어 summary strip

This ledger intentionally does not mark frontend as globally perfect. The current desktop blockers are closed, the mobile document cockpit is closed, and the mobile share default flow is closed. Deeper mobile share configuration cards still remain below the fold by design.

## Current Production Baseline

Current production evidence after the latest workspace IA work:

- Production marker: `f504b15e9682e35bce97d629b86e02268c08a185`
- Documents desktop-short 1440x723:
  - `documentWorkbench.bottom = 722`
  - `safetyBrief.bottom = 649`
  - `riskAssessmentEditCta.bottom = 391`
  - `safetyBriefShareCta.bottom = 441`
  - `documentSecondaryActions.bottom = 711`
  - `documentProvenanceSummary.bottom = 702`
  - `documentDeepReviewSummary.bottom = 710`
  - `visibleDocumentPreviews = 0`
  - `overflowX = false`
  - `outside = 0`
- Documents mobile 390x844:
  - `bodyHeight = 1205`
  - `riskAssessmentEditCta.bottom = 542`
  - `safetyBriefShareCta.bottom = 543`
  - `safetyBrief.bottom = 981`
  - detail summaries remain below the first viewport
  - `overflowX = false`
  - `outside = 0`

## Product Structure Decision

Route splitting alone is not the length fix. `/input`, `/documents`, and `/share` help navigation clarity, but long documents and long sharing details can still make each route feel heavy.

The actual fix is viewport-first progressive disclosure:

- Field mode: decision summary, critical controls, and primary action in the first viewport.
- Manager mode: full 12-document review, provenance, logs, and deep editing behind explicit disclosure.

Product message:

> 핵심 판단은 빠르게, 전체 12종은 필요할 때 깊게 검토.

## 2026-07-21 Mobile Cockpit Update

Documents mobile 390x844 current-source gate:

- `bodyHeight = 980`
- `documentWorkbench.bottom = 835`
- `safetyBrief.bottom = 762`
- `riskAssessmentEditCta.bottom = 551`
- `safetyBriefShareCta.bottom = 552`
- `documentSecondaryActions.bottom = 824`
- `documentProvenanceSummary.bottom = 815`
- `documentDeepReviewSummary.bottom = 823`
- `visibleDocumentPreviews = 0`
- `deepReviewOpen = false`
- `overflowX = false`
- `outside = 0`

## 2026-07-21 Standalone Documents Internal Pane Update

Production `/documents?theme=day` at 390x844:

- `bodyHeight = 844`
- `heightRatio = 1.00`
- `currentWorkStrip.visible = true`
- `currentWorkStrip.bottom = 297`
- `mobileCoreLauncher.bottom = 468`
- `workpackPane.top = 476`
- `workpackPane.bottom = 796`
- `workpackPane.height = 320`
- `workpackPane.overflowY = auto`
- `workpackPane.scrollHeight = 1110`
- `documentEditor.top = 602`
- `documentTextarea.top = 823`
- `overflowX = false`
- `outside = 0`

Interpretation: the raw mobile standalone `/documents` long-page complaint is closed for the default surface. Long document editing remains available inside a bounded internal pane, so remaining IA debt moves to pane readability and document-specific drilldown, not route body height.

Share mobile 390x844 current-source gate:

- `shareMobileSummary.bottom = 432`
- `sharePreview.bottom = 659`
- `primaryShareCta.bottom = 720`
- `overflowX = false`
- `outside = 0`
- `shareBody = 1473`
- `shareTargetCard.bottom = 870`
- `shareChannelCard.bottom = 1124`
- `shareLanguageCard.bottom = 1261`

## Next Bounded Wave

Recommended branch name if deeper document-pane readability or full Share mobile closure is required:

```text
fix/mobile-doc-share-cockpit
```

Acceptance proposal:

1. Documents mobile 390x844 default closed state:
   - risk assessment edit CTA and share CTA remain in the first viewport.
   - safety brief top hazards or summary card stay in the first viewport.
   - provenance/deep-review/library entrypoints are compact chips or reachable via a sticky action drawer.
   - `visibleDocumentPreviews = 0`, `deepReviewOpen = false`, `overflowX = false`, `outside = 0`.
2. Share mobile 390x844:
   - first viewport contains transmission summary, selected channel/language, primary send or preview CTA, and preview entrypoint.
   - long multilingual previews, evidence, and logs are accordions, drawer, or wizard steps.
   - if dispatch is gated, the gate is explicit and does not look like a broken send state.
3. Evidence:
   - keep selector rects for mobile document/share cockpit elements in geometry JSON.
   - do not use total body height alone as pass/fail; long detail below the fold is acceptable only when first-viewport decision/action proof exists.
