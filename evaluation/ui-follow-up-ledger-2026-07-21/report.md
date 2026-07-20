# UI Follow-Up Ledger

Checked at: 2026-07-21 02:34 KST

## Current Split Verdict

- Documents desktop cockpit: PASS
- Share desktop cockpit: PASS
- Documents mobile cockpit: PASS after the 2026-07-21 internal-pane production patch
- Share mobile action cockpit: PASS after the 2026-07-21 bounded mobile patch
- Share mobile default flow: PASS after adding the selected 대상/채널/언어 summary strip

This ledger intentionally does not mark frontend as globally perfect. The current desktop blockers are closed, the mobile document cockpit is closed, and the mobile share default flow is closed. Detailed mobile Share configuration is now opt-in/collapsed by default; a more guided stepper remains optional product-depth follow-up.

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

## 2026-07-21 Internal Pane Landing Update

Current-source bounded gate:

- Artifact: `evaluation/documents-mobile-pane-landing-2026-07-21/report.md`
- Source HEAD before commit: `547c2ed6099e8156e8ff01595003cb3222015231`
- The baseline production RED was not raw page height. It was selection landing: after tapping `위험성평가표`, the first textarea started at `top=775` while the pane ended at `bottom=772`.
- The new contract requires selected document editable content to intersect `.workpack-shell` immediately after selection.
- Focused browser: `documents-editor-layout` mobile launcher slice PASS, 2/2.
- Full browser file: `documents-editor-layout` PASS, 31/31.
- TypeScript: PASS.

Interpretation: page split alone is not the fix. `/documents` must behave as a viewport cockpit with a bounded drilldown pane, and the pane must visibly land on the selected document's editable content.

## 2026-07-21 Internal Pane Context Update

Current-source bounded gate:

- Artifact: `evaluation/documents-mobile-pane-context-2026-07-21/report.md`
- Source HEAD before commit: `45a5e6285c1bdc788fd40b99bb29de58200495fc`
- The baseline production landing fix was already green, but deep internal pane scroll still lost the selected-document title/context.
- The new contract requires a compact selected-document toolbar to remain visible inside `.workpack-shell` while scrolling the pane.
- Focused browser: `documents-editor-layout` mobile launcher slice PASS, 2/2.
- Full browser file: `documents-editor-layout` PASS, 31/31.
- TypeScript: PASS.

Interpretation: long artifacts can remain in bounded panes, but each pane needs persistent local context. This is the next step from "short page" to readable drilldown.

## 2026-07-21 Selected Document Summary Update

Current-source bounded gate:

- Artifact: `evaluation/documents-mobile-pane-context-2026-07-21/report.md`
- Source HEAD before patch: `bb60fdf8461dbd117827748ba7e35ef51de00bb2`
- The sticky `.document-toolbar` now includes a selected-document drilldown summary: `N섹션 · 근거 N건 · 확인 N건`.
- The old landing gate only proved the textarea intersected the internal pane. Live review found a stricter RED: sticky toolbar `bottom=572` could cover textarea `top=492`.
- The strengthened gate now requires `toolbarCoversTextarea=false` on landing and after deep scroll.
- Focused browser: `documents-editor-layout` mobile launcher slice PASS, 2/2.
- Full browser file: `documents-editor-layout` PASS, 31/31.
- TypeScript: PASS.

Production overlap remediation confirmation:

- Production marker: `f5b29ce18abe4533b846de2ee70919df25f752e3`.
- Live `/documents?theme=day`, 390x844, after selecting `위험성평가표`: page remains `844px`, horizontal overflow `0`, pane `476-796`, summary `7섹션 · 근거 4건 · 확인 1건`.
- Landing no longer hides the first editable field under the sticky toolbar: toolbar `bottom=572`, textarea `top=656`, `toolbarCoversTextarea=false`, `textareaBelowToolbar=true`.
- Deep internal pane scroll to `scrollTop=1000` keeps the same summary visible in the sticky toolbar and keeps `toolbarCoversTextarea=false`.

Interpretation: selected-document summary is now part of the bounded pane context. Remaining document IA debt is deeper document-specific accordion/action design, not missing selected-document title or summary.

## 2026-07-21 Documents Drilldown Depth Update

Current-source bounded gate:

- Artifact: `evaluation/documents-drilldown-depth-2026-07-21/report.md`
- Source HEAD before patch: `ea885c9f201b05810a13242edba891bb4bd98993`
- Inside the bounded `/documents` pane, structured document body sections now behave as a controlled accordion.
- Default selected document has exactly one open body section: index `0`.
- Opening the second section immediately keeps exactly one open section: index `1`; the first section returns to `펼치기`, the second becomes `편집 중`.
- Native `<details>` double-open flicker is prevented by driving summary click/Enter/Space through React state.
- Live `a31f097a` proved the one-section accordion but exposed a stricter RED: after opening the second section, toolbar `bottom=572` covered opened-section textarea `top=502`.
- The current patch aligns the opened section textarea below the sticky toolbar and requires `toolbarDoesNotCoverOpenSectionTextareaAfterSectionSwitch=true`.
- Production `006aaa29` confirms the fix: after opening the second section, toolbar `bottom=572`, opened textarea `top=580`, `toolbarCoversOpenTextarea=false`, page `844px`, overflow `0`.
- Page height and horizontal overflow remain bounded after section switching.
- Focused browser: `documents-editor-layout` mobile launcher slice PASS, 2/2.
- Full browser file: `documents-editor-layout` PASS, 31/31.
- North Star/open gate preservation: PASS, 13/13.
- TypeScript: PASS.

Interpretation: this closes the first document-specific drilldown depth layer: one selected document, one open body section, bounded pane. Remaining document IA debt is richer document-specific section actions and editing affordances, not raw route body height, missing selected context, or all sections expanding at once.

## 2026-07-21 Share Result Drilldown Update

Current-source bounded source/CSS gate:

- Artifact: `evaluation/share-result-drilldown-2026-07-21/report.md`
- Share result state now renders as `[data-share-result-drilldown]` with `[data-share-result-summary]`.
- Channel/provider/log details are contained inside `.workflow-result-detail` with bounded internal scroll.
- Failure, duplicate-risk, and duplicate-log states default open so critical warnings are not hidden.
- Desktop `/workspace` Share and standalone `/dispatch` keep the result drilldown in the left cockpit column instead of spanning across the preview/right-pane area.
- Mobile remains one-column and places result details after the first-action region.

Interpretation: this is a result-depth containment layer, not provider live dispatch. Route/page split alone is still not accepted as the UX fix; long provider/result details must stay in bounded drilldown while the first viewport keeps publish/status, recipient/channel decision, preview, and primary action.

Share mobile configuration-stack current-source gate:

- Artifact: `evaluation/share-mobile-full-flow-2026-07-21/report.md`
- Source HEAD before patch: `e3cddc4fd2100f28f4b3004d4d0bf85acf2c9523`
- Focused browser: `workspace-share-mobile-browser` PASS, 2/2.
- The baseline mobile Share debt was a long target/channel/language stack below the first viewport.
- The new default uses progressive disclosure: selected 대상/채널/언어 remains readable, detailed configuration cards are collapsed by default, and they expand on demand.
- `shareBody = 1020` at 390x844 (`1.21x`, down from `1533`)
- `shareMobileSummary.bottom = 256`
- `sharePreview.bottom = 510`
- `primaryShareCta.bottom = 571`
- `configToggle.bottom = 632`
- `configCards.display = ["none", "none", "none"]`
- Expanded on demand: `configCards.display = ["grid", "grid", "grid"]`
- `overflowX = 0`
- Desktop preservation: workspace Share keeps right-pane preview and `172x44` channel cards; standalone `/dispatch` keeps `rootWidth = 1156`, right-pane preview, and `164x44` channel cards.
- Independent live generated-flow probe: `shareBody = 980`, summary/preview/CTA/toggle bottoms `350/604/665/726`, config cards `display:none`, overflow `0`.

Interpretation: this closes mobile Share config-stack IA for the default flow. It does not claim a fully viewport-bound route, and it does not claim real provider dispatch.

## Next Bounded Wave

Recommended branch name if deeper document-specific drilldown or a more guided Share mobile stepper is required:

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
   - current default summary, preview, CTA, and config toggle remain in the first viewport.
   - target/channel/language detail cards remain collapsed by default or become a guided active-step editor.
   - long multilingual previews, evidence, and logs are accordions, drawer, or wizard steps.
   - if dispatch is gated, the gate is explicit and does not look like a broken send state.
3. Evidence:
   - keep selector rects for mobile document/share cockpit elements in geometry JSON.
   - do not use total body height alone as pass/fail; long detail below the fold is acceptable only when first-viewport decision/action proof exists.
