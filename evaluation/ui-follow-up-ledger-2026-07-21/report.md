# UI Follow-Up Ledger

Checked at: 2026-07-21 23:56 KST

## Current Split Verdict

- `/workspace` default Documents cockpit: PASS on current live evidence. The raw page-height problem is closed for the default cockpit.
- `/workspace` selected editor/detail: SPLIT. Field-summary landing is PASS because the first risk-row header and hazard field are visible immediately, but raw textarea/detail landing remains OPEN because the full long-form textarea starts below the first viewport.
- `/workspace` Share desktop raw geometry: PASS as a two-column workbench by selector width/x-range. If users still perceive a narrow mobile-like card, treat that as a visual composition follow-up, not a raw layout failure.
- `/workspace` Share mobile default flow: PASS for compact summary, preview, primary CTA, and collapsed detail controls inside the first viewport.
- `/dispatch` standalone sample shell: PASS for desktop two-region geometry and mobile compact shell; generated/live provider dispatch remains separate.

This ledger intentionally does not mark frontend as globally perfect. Current live evidence closes the default Documents/Share cockpit height issues and the selected editor field-summary landing issue. It does not close selected editor/detail as a whole: raw textarea/editor drilldown readability remains OPEN, along with deeper full-document authoring and optional Share desktop full-workbench visual refinement if reproduced in the user-seen session.

## Current Deployment And Structure Note

Latest current evidence represented by this ledger:

- Default workspace IA split artifact: `evaluation/workspace-ia-live-293-2026-07-21/report.json`
- Selected editor field-level landing artifact: `evaluation/workspace-editor-detail-landing-2026-07-21/report.json`
- Latest refreshed live geometry marker: `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea`
- Latest checked live marker for selected editor landing: `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea`
- Latest report-refresh source marker before this ledger update: `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea`

Interpretation: the user's refined reading is correct. The default Documents cockpit and Share cockpit are no longer best described as stale or raw long-page failures. The remaining Documents complaint belongs to selected editor/detail depth: the first meaningful risk-row field/summary is now visible, while the full raw textarea starts below the first viewport and stays OPEN as a drilldown/readability issue. The remaining Share complaint, if reproduced, should be tested as perceived desktop workbench composition rather than as a literal one-column/mobile-stack geometry failure.

Latest live geometry refresh at `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea` keeps that split:

- `/workspace` Documents default cockpit: desktop-short `723/723`, mobile `844/844`, workbench bottoms `710/786`, `visibleDocumentPreviews=0`, overflow `0`.
- `/workspace` selected editor/detail: field-level landing remains green, but raw textarea/detail landing remains open: desktop-short risk row header `522-579`, hazard field `615-675`, raw textarea `1094-1267`; mobile risk row header `526-583`, hazard field `607-657`, raw textarea `987-1160`.
- `/workspace` Share: desktop is raw two-column geometry, not a literal mobile stack: desktop-short form/preview widths `636/520`, CTA bottom `389`, preview bottom `571`; mobile is compact first-viewport flow with preview/CTA bottoms `683/742`.

The remaining structural contract is still:

- Route/page split helps orientation, but is not accepted as the length fix by itself.
- Each route needs a first-viewport cockpit: current state, selected item, primary action, provenance/status/result summary.
- Long documents, full messages, language variants, logs, and raw metadata must stay in bounded panes, accordions, drawers, or drilldown routes.
- Follow-up evidence should keep measuring primary CTA/status/result bottom, selected editor/panel y-position, default-open details count, desktop column split, horizontal overflow, and sticky overlap.

## 2026-07-21 Live Geometry Recheck After Shortcut Deploy

Independent production probe at `552424531ae1bd9f6219cc27431509f4494e22e1` showed the outer routes are now bounded, but the user's structural concern is still valid if we only look at page height:

- `/documents?theme=day` desktop 1440x723: outer page `770px / 1.07x`, but the workpack editor workspace is an internal scroll pane `386px / 1188px`.
- `/documents?theme=day` mobile 390x844: outer page `844px / 1.00x`, but the workpack editor workspace is an internal scroll pane `320px / 1294px`.
- Interpretation: page body height is no longer the blocker; deeper document readability now depends on selected-document drilldown, section actions, and internal-pane affordance.
- `/dispatch?theme=day` desktop 1440x723: outer page `723px / 1.00x`, no horizontal overflow.
- `/dispatch?theme=day` mobile 390x844 before this follow-up patch: `1202px / 1.42x`, no horizontal overflow. This was a real mobile sample-shell density debt.

Current-source follow-up for `/dispatch` mobile sample shell:

- Artifact: `evaluation/dispatch-standalone-cockpit-2026-07-21/report.md`
- Focused browser: `workspace-share-mobile-browser` standalone dispatch sample PASS, 1/1 selected.
- Mobile 390x844: `pageHeight = 893`, `heightRatio = 1.06`, `grid.bottom = 845`, sample panel bottoms `641 / 844`, `horizontalOverflow = 0`.
- Desktop preservation: sample shell remains two desktop regions with `gridWidth = 1156`, panel widths `635 / 413`, and horizontal overflow `0`.

Interpretation: `/dispatch` mobile sample/default shell is materially reduced in current source. Generated provider-result state and provider live dispatch remain separate; the route split question is still answered by cockpit plus bounded detail, not by adding pages alone.

Production marker catch-up:

- Production `/api/build-info`: `668c08147edf9d9e6b3cab7edf68b3a4f00229b6`.
- Live `/dispatch?theme=day`, 390x844: `pageHeight = 893`, `heightRatio = 1.06`, `scrollWidth = 390`, `horizontalOverflow = false`.
- Interpretation: the `/dispatch` mobile sample/default compact patch is now production-confirmed, not source-only.

## 2026-07-21 Documents First-Edit Cockpit Update

Current-source bounded gate and production confirmation:

- Artifact: `evaluation/documents-first-edit-cockpit-2026-07-21/report.md`
- Source base before patch: `668c08147edf9d9e6b3cab7edf68b3a4f00229b6`
- The previous `/documents` PASS artifacts remain valid for raw route height, bounded pane, one-section accordion, sticky-toolbar overlap, and section action shortcuts.
- This wave targets the next IA complaint: the standalone document route should start with the high-value `위험성평가표`, not a summary-first document that makes the user hunt for the real risk-assessment edit surface.
- Desktop 1440x723 current-source: selected `위험성평가표`, body `770px / 1.07x`, first textarea `top=493/bottom=658`, overflow `0`.
- Mobile 390x844 current-source: selected `위험성평가표`, body `844px / 1.00x`, shell `476-796`, toolbar `476-572`, first textarea `580-737`, overflow `0`.
- Focused browser: `documents-editor-layout` default cockpit slice PASS, 1/1 selected.

Production confirmation:

- Production `/api/build-info`: `5dc34b4729ec2a8c77b74c1109d4dfd58dc01550`.
- Live desktop 1440x723: selected `위험성평가표`, body `770px / 1.07x`, shell `336-722`, first textarea `492.875-658.125`, overflow `0`.
- Live mobile 390x844: selected `위험성평가표`, body `844px / 1.00x`, launcher `305-468`, shell `476-796`, toolbar `476-572`, first textarea `581-738.25`, overflow `0`.

Interpretation: this closes the first-edit arrival gap on live production. It does not claim full document-specific editing depth is finished; the inner pane remains long (`desktop scrollHeight 1499`, mobile scrollHeight 1544), so richer per-section summaries/readability/drilldown remain product-depth follow-up.

## 2026-07-21 Documents Inner-Pane Depth Update

Current-source bounded gate:

- Artifact: `evaluation/documents-inner-pane-depth-2026-07-21/report.md`
- Source patch commit: `d3a19519d41ae16503fa6b05b51a75b9140eeee1`
- The live first-edit cockpit remains the baseline contract: standalone `/documents` starts on `위험성평가표`, the risk launcher is pressed, the first textarea is visible in the first viewport, and it sits below the sticky toolbar.
- This wave reduces default mobile inner-pane depth by compacting closed secondary controls/details, not by hiding the 3 core document affordance or changing export/data/provider contracts.
- Mobile 390x844 current-source: body `844px / 1.00x`, shell `476-796`, `clientHeight = 320`, `scrollHeight = 1447` (down from live baseline `1544`), first textarea `580-737`, secondary tools `213px`, default open sections `1`, overflow `0`.
- Desktop 1440x723 preservation: body `770px / 1.07x`, shell `336-722`, `clientHeight = 386`, `scrollHeight = 1499`, first textarea `493-658`, default open sections `1`, overflow `0`.
- Focused browser: `documents-editor-layout` default cockpit slice PASS, 1/1 selected.
- Focused preservation browser: `documents-editor-layout` requested document + default cockpit + expanded tools containment PASS, 3/3 selected.
- TypeScript: PASS.
- Production `/api/build-info`: `4119367905b3f3cf46bf20747d7cf7635f389c7a`, branch `master`, environment `production`.
- Live mobile 390x844: body `844px / 1.00x`, shell `476-796`, `clientHeight = 320`, `scrollHeight = 1447`, selected `위험성평가표`, risk launcher pressed, first textarea `581-738`, secondary tools `213px`, default open sections `1`, overflow `0`.
- Live desktop 1440x723: body `770px / 1.07x`, shell `336-722`, `clientHeight = 386`, `scrollHeight = 1499`, selected `위험성평가표`, first textarea `493-658`, default open sections `1`, overflow `0`.

Interpretation: this closes a bounded default-depth slice inside the document pane on production. It still does not claim full 12-document authoring UX is solved; deeper document-specific summaries, risk-row readability, and per-section action design remain OPEN.

## 2026-07-21 Documents Field-First Affordance Update

Production-confirmed bounded gate:

- Artifact: `evaluation/documents-field-first-affordance-2026-07-21/report.md`
- Source patch commit: `3bb927635b9b9612e27da5ebf02819253f7cffa9`
- Production/evidence marker: `67afa408726a80b4d69d69224b009bc3d501cb44`
- This wave keeps default `/documents` on `위험성평가표`, keeps the first-edit cockpit, and adds a field-first strip to the open selected section.
- Mobile 390x844 live production: body `844px / 1.00x`, shell `476-796`, field strip `581-629`, evidence/recheck action row `629-673`, first textarea `673-830.25`, visible textarea area in pane `123px`, overflow `0`, toolbar overlap `0`.
- Desktop 1440x723 live production: body `770px / 1.07x`, shell `336-722`, field strip `492.88-540.88`, action row `540.88-584.88`, first textarea `584.88-738.13`, visible textarea area in pane `137.12px`, overflow `0`, toolbar overlap `0`.
- Focused browser: default cockpit field-first slice PASS, 1/1 selected.
- Focused preservation browser: core launcher + requested document + default cockpit + expanded tools containment PASS, 5/5 selected.
- TypeScript: PASS.

Interpretation: this closes a field-first affordance slice on production for the selected risk-assessment section: the user sees the editable field, supporting evidence count, review state, and evidence/recheck CTAs before reading the textarea. Full textarea visibility inside the 320px mobile pane and field-first authoring across all 12 documents remain OPEN.

Structural answer to the user's route-split question: page/route split is useful for orientation, but it is not the length fix by itself. The accepted UX contract is route split plus first-viewport cockpit plus bounded pane/drilldown/progressive disclosure. Long safety documents and Share/result details remain legitimate only when they are contained behind selected sections, accordions, drawers, or detail panes with persistent local context.

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

Interpretation: this closes the first document-specific drilldown depth layer: one selected document, one open body section, bounded pane, and explicit evidence/quality shortcuts from the open section. Remaining document IA debt is richer per-document editing affordances, not raw route body height, missing selected context, all sections expanding at once, or hidden evidence entrypoints.

## 2026-07-21 Share Result Drilldown Update

Current-source bounded source/CSS and generated fixture gate:

- Artifact: `evaluation/share-result-drilldown-2026-07-21/report.md`
- Share result state now renders as `[data-share-result-drilldown]` with `[data-share-result-summary]`.
- Channel/provider/log details are contained inside `.workflow-result-detail` with bounded internal scroll.
- Failure, duplicate-risk, and duplicate-log states default open so critical warnings are not hidden.
- Desktop `/workspace` Share and standalone `/dispatch` keep the result drilldown in the left cockpit column instead of spanning across the preview/right-pane area.
- Mobile remains one-column and places result details after the first-action region.
- Generated provider-result fixture proof is now present without enabling or calling real providers:
  - Desktop 1440x900: `pageHeight=900`, primary/preview/result summary bottoms `382/738/772`, result panel `606px`, distinct x ranges `[160, 800]`, overflow `0`.
  - Mobile 390x844: `pageHeight=1052`, preview/primary/result summary bottoms `577/638/813`, config cards collapsed, overflow `0`.
  - Dispatch POST is called exactly once per viewport with a `provider-dispatch-v1-*` idempotency key.
  - Result details are closed by default and show `2` validation-only channel results when opened.

Interpretation: this is a result-depth containment layer plus a fixture-generated result-state proof, not provider live dispatch. Route/page split alone is still not accepted as the UX fix; long provider/result details must stay in bounded drilldown while the first viewport keeps publish/status, recipient/channel decision, preview, and primary action.

Product-depth update: the closed result summary now exposes `검증 전용 · 2개 채널`, and the fixture proof still opens the drilldown to verify retained channel results. A later UX wave can refine this further with save-state labels or richer provider-result ledger UX without changing provider dispatch contracts.

## 2026-07-21 Workspace IA Live `f67a6328` Refinement

Live production evidence:

- Artifact: `evaluation/workspace-ia-live-f67-2026-07-21/report.md`
- Live marker: `f67a63286251b1e4611b4234c0059be043f80f8e`
- `/workspace` default Documents cockpit is bounded:
  - Desktop short `1440x723`: body `723/723`, document page/workbench bottom `710`, overflow `0`.
  - Mobile `390x844`: body `844/844`, document page/workbench bottom `786`, overflow `0`.
- `/workspace` default Share cockpit is bounded:
  - Desktop short `1440x723`: body `723/723`, share root bottom `716`, preview bottom `571`, primary CTA bottom `389`, form/preview widths `636/520`, overflow `0`.
  - Mobile `390x844`: body `844/844`, share root bottom `810`, preview bottom `683`, primary CTA bottom `742`, overflow `0`.

Open IA blocker:

- Selected document editor/detail still explains the user's "Documents feels long" complaint:
  - Desktop short editor body `882/723`, first textarea bottom `1267`.
  - Desktop editor body `1129/900`, first textarea bottom `1256`.
  - Mobile editor body `1067/844`, first textarea bottom `1160`.
- Next `/documents` acceptance should target selected editor/detail landing: after the risk-assessment edit/detail action, the first meaningful editable content or field summary must intersect the visible viewport or bounded pane immediately.

Share nuance:

- Raw desktop Share geometry is not a literal mobile stack; it has a form column and a `520px` preview column with no horizontal overflow.
- If users still perceive Share as mobile-like, treat that as a design/workbench composition follow-up: the desktop surface should feel like full recipient/channel/provenance/action plus preview work regions, not just a centered card with two columns.

Interpretation: current live evidence closes the default cockpit page-height issue. It does not close selected document editor/detail landing or every perceived Share composition concern. Route/page split alone remains rejected as a sufficient fix; the required structure is step split plus first-viewport cockpit plus bounded drilldown/detail.

## 2026-07-21 Workspace Editor Detail Landing Refinement

Live production field-level proof:

- Artifact: `evaluation/workspace-editor-detail-landing-2026-07-21/report.md`
- Live marker: `cd3d46a822bf3dbec4eb4bc3c839b9165c29b2ea`
- The previous selected-editor blocker was too broad if it was judged only by raw textarea position.
- Current live `/workspace` editor/detail still has a long raw textarea below the viewport, but the first meaningful risk-row work surface is visible immediately:
  - Desktop short `1440x723`: first risk row header `522-579`, first hazard field `615-675`, raw textarea `1094-1267`.
  - Desktop `1440x900`: first risk row header `510-567`, first hazard field `604-664`, raw textarea `1083-1256`.
  - Mobile `390x844`: first risk row header `526-583`, first hazard field `607-657`, raw textarea `987-1160`.
- Row header text includes `근거` and `확인`, so evidence/recheck context is present in the first visible work surface.

Interpretation: selected document editor/detail field-level landing is production-proven. The remaining debt is not "the user cannot find the first editable risk field"; it is that full raw textarea/long-form editing remains a secondary long drilldown. Do not claim the full document edit surface is globally short.

## 2026-07-21 Dispatch Sample Shell Update

Current-source bounded gate:

- Artifact: `evaluation/dispatch-standalone-cockpit-2026-07-21/report.md`
- Live `ca273fe5` showed the default/sample `/dispatch?theme=day` shell still had wide stacked panels around `1108px` each, even though generated/current-workpack Share already had a proper two-pane cockpit.
- The current patch keeps generated/current-workpack Share as the full-width two-pane cockpit and changes only the sample/empty shell panels into two desktop regions.
- Desktop 1440x900 current-source sample shell: page `900px`, grid `1156x109`, first panel `635x77` at x `284`, second panel `413x77` at x `979`, distinct columns `true`, overflow `0`.
- Mobile 390x844 remains one-column: page `1202px`, grid `358px` wide, panels `332px` wide, overflow `0`.

Production `a3254ae3176468e715fccb6dd308aada7c5870aa` confirms the same desktop sample-shell fix:

- Desktop 1440x900: page `900px`, grid `1156x109`, first panel `635x77` at x `284`, second panel `413x77` at x `979`, overflow `0`.
- Mobile 390x844: page `1202px`, grid `358px` wide, panels remain single-column and overflow `0`.

Interpretation: this closes the standalone `/dispatch` sample-shell desktop wide-stack risk in production evidence. It still does not claim generated provider-result browser state proof or provider live dispatch. Mobile sample remains overflow-safe but long/late, so mobile density is separate product-depth debt.

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
