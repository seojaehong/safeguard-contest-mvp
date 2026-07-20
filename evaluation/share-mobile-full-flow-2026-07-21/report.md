# Share Mobile Full-Flow Gate

Checked at: 2026-07-21 03:37 KST

## Verdict

PASS for the mobile Share configuration-stack remediation in current-source browser evidence.

This closes the earlier mobile long-stack debt where target, channel, and language detail cards all remained below the first viewport. The current default flow keeps the selected 대상/채널/언어 summary, bounded message preview, primary CTA, and a compact "상세 설정" entry in the first viewport. The detailed cards are collapsed by default and expand on demand.

This does not claim real provider dispatch is production-live. Provider delivery remains governed by the persistent idempotency and provider-result persistence approval gate.

## Source

- Source HEAD before this patch: `e3cddc4fd2100f28f4b3004d4d0bf85acf2c9523`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Harness: current-source isolated browser harness
- Viewports: desktop `1440x900`, mobile `390x844`
- Themes: Day, Night
- Focused command: `npm.cmd test -- tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false`
- Result: PASS, `1` file / `2` tests

## Mobile Default Geometry

Mobile 390x844 Day:

- `shareBody = 1020`
- `shareMobileSummary.bottom = 256`
- `sharePreview.bottom = 510`
- `primaryShareCta.bottom = 571`
- `configToggle.bottom = 632`
- `configToggle.height = 44`
- `mobileConfigExpanded = false`
- `configCards.length = 3`
- `configCards.display = ["none", "none", "none"]`
- `overflowX = 0`
- Expanded on demand: `cardDisplays = ["grid", "grid", "grid"]`, `overflowX = 0`

Mobile 390x844 Night:

- `shareBody = 1020`
- `shareMobileSummary.bottom = 256`
- `sharePreview.bottom = 510`
- `primaryShareCta.bottom = 571`
- `configToggle.bottom = 632`
- `configCards.display = ["none", "none", "none"]`
- `overflowX = 0`

## Production Verification

Production `https://www.safeclaw.kr`, build marker `560dc6ad50aad22c89f7a7f7b56f3ac1b67d95f2`, checked after deploy:

- Artifact: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- Mobile 390x844 `/workspace` Share:
  - `shareBody = 993`
  - `shareMobileSummary.bottom = 432`
  - `sharePreview.bottom = 659`
  - `primaryShareCta.bottom = 720`
  - `shareForm.bottom = 729`
  - `shareTargetCard = 0x0`
  - `shareChannelCard = 0x0`
  - `shareLanguageCard = 0x0`
  - `overflowX = false`
  - `outside = 0`
- Desktop-short 1440x723 `/workspace` Share:
  - `shareBody = 912`
  - `shareForm.bottom = 667`
  - `sharePreview.bottom = 705`
  - `primaryShareCta.bottom = 349`
  - `previewRightOfPrimary = true`
  - `overflowX = false`
  - `outside = 0`

Independent live generated-flow probe at 390x844:

- Flow: typed a real workspace prompt, generated documents, opened Share, selected Vietnamese, and collapsed detailed configuration. No send/save action was executed.
- `shareBody = 980`
- `shareMobileSummary.bottom = 350`
- `sharePreview.bottom = 604`
- `primaryShareCta.bottom = 665`
- `configToggle.bottom = 726`
- `configToggle.height = 44`
- `mobileConfigExpanded = false`
- `mobileSummaryText = 대상 3명 선택 · 채널 메일, 문자 · 언어 베트남어(Tiếng Việt)`
- `configCards.display = ["none", "none", "none"]`
- `configCards.height = [0, 0, 0]`
- `overflowX = 0`

## Desktop Preservation

Workspace share desktop 1440x900 Day:

- `shareBody = 912`
- `sharePreview.bottom = 705`
- `primaryShareCta.bottom = 349`
- `previewLeft = 771`
- `primaryRight = 755`
- `channelCards = 172x44, 172x44, 172x44`
- `configCards.display = ["grid", "grid", "grid"]`
- `overflowX = 0`

Standalone `/dispatch?theme=day` desktop 1440x900:

- `shareBody = 1116`
- `rootWidth = 1156`
- `rootHeight = 652`
- `sharePreview.bottom = 898`
- `primaryShareCta.bottom = 544`
- `previewRightOfPrimary = true`
- `channelCards = 164x44, 164x44, 164x44`
- `overflowX = 0`

## Interpretation

Route splitting alone is not the UX fix. This patch applies progressive disclosure inside the Share step: selected transmission state stays readable in the cockpit, the preview and primary action remain first-viewport visible, and long configuration details are opened only when needed.

Remaining follow-up is product-depth, not this mobile default stack: refine the eventual Share mobile stepper if more guided editing is needed, and keep real provider dispatch separate until the idempotency/result ledger is approved.
