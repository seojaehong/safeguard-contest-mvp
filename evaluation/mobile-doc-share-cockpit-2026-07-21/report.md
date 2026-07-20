# Mobile Document / Share Cockpit Gate

Checked at: 2026-07-21 KST

## Verdict

- Documents mobile cockpit: PASS
- Share mobile action cockpit: PASS
- Share mobile full flow: PARTIAL, because detailed target/channel/language cards continue below the first viewport.
- Desktop preservation: PASS

This is a bounded mobile IA patch. It does not claim that every long detail is gone; it proves the first-viewport field cockpit is usable while deep review and long sharing details remain behind or below explicit action surfaces.

## Source

- Worktree HEAD before this patch: `c2f3b0785728bef398677df7aa9ee2fd531eed7a`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Production marker: `9455adb943b755fa87e0565347d63a50003ca20d`
- Production URL: `https://www.safeclaw.kr`
- Probe file: `evaluation/workspace-docs-share-production-gate-2026-07-20/run-current-geometry-probe.mjs`
- Geometry artifact: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`

## What Changed

- Mobile Safety Brief now shows a compact field-mode version: one top hazard row and one risk-assessment row in the default viewport.
- Closed `document-deep-review` content is explicitly hidden, so the full document preview is not painted or measured while closed.
- Mobile document detail entrypoints are compact two-column chips.
- Mobile share primary action is promoted into a sticky action row, keeping the send/preview action reachable while long details continue below.
- The geometry probe now records share target/channel/language card rectangles separately.

## Fresh Geometry

### Documents mobile 390x844

- `bodyHeight = 980`
- `documentWorkbench.bottom = 835`
- `safetyBrief.bottom = 762`
- `riskAssessmentEditCta.bottom = 551`
- `safetyBriefShareCta.bottom = 552`
- `documentSecondaryActions.bottom = 824`
- `documentProvenanceSummary.bottom = 815`
- `documentDeepReviewSummary.bottom = 823`
- `visibleDocumentPreviews = 0`
- `documentDeepReviewOpen = false`
- `overflowX = false`
- `outside = 0`

Documents mobile meets the first-viewport cockpit contract.

### Share mobile 390x844

- `sharePreview.bottom = 599`
- `primaryShareCta.bottom = 660`
- `overflowX = false`
- `outside = 0`
- `shareBody = 1473`
- `shareTargetCard.bottom = 870`
- `shareChannelCard.bottom = 1124`
- `shareLanguageCard.bottom = 1261`

Share mobile action cockpit passes because the preview and primary action are reachable in the first viewport. The full target/channel/language detail flow remains long and should be handled in a follow-up wizard or drawer wave if a full mobile share-flow PASS is required.

### Desktop preservation

Desktop-short 1440x723 remains intact:

- Documents workbench bottom: `722`
- Documents safety brief bottom: `649`
- Documents secondary actions bottom: `711`
- Share target/channel/language bottom: `675`
- Share preview bottom: `705`
- Share primary CTA bottom: `349`
- overflow/outside remain `false / 0`

## Remaining Follow-Up

For a full Share mobile PASS, the next bounded patch should convert target/channel/language into a compact mobile wizard or disclosure group so the transmission summary, selected channel/language, preview entrypoint, and primary CTA are all directly measured within the first viewport.

