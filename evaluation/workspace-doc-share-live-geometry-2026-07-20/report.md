# SafeClaw Workspace Documents/Share Live Geometry Check

Checked at: 2026-07-20 KST

## Verdict

PARTIALLY FIXED.

The current live production surface is no longer stale relative to the current authoritative master. Production `/api/build-info` reports `13346572796092333c7f7e8a0d28c189b32574a1`, matching the current authoritative git head used for this check.

Documents desktop is improved compared with the previously reported 2070px document height on a 723px viewport, but it is not a true separate screen-state experience yet because the left workbench rail and document review content still coexist on one long workbench surface. Documents mobile remains overlong. Share desktop is no longer a narrow mobile-card width, but it is still mostly a single workbench panel rather than a strong desktop composition. Share mobile remains long because the recipient/channel/language/preview stack stays serial.

## Evidence

- Served URL: `https://www.safeclaw.kr/workspace`
- Served build marker: `13346572796092333c7f7e8a0d28c189b32574a1`
- Git head checked: `13346572796092333c7f7e8a0d28c189b32574a1`
- Branch: `master`
- Browser: Playwright Chromium
- Artifacts:
  - `evaluation/workspace-doc-share-live-geometry-2026-07-20/report.json`
  - `evaluation/workspace-doc-share-live-geometry-2026-07-20/screenshots/desktop-1440-documents-clicked.png`
  - `evaluation/workspace-doc-share-live-geometry-2026-07-20/screenshots/desktop-1440-share-clicked.png`
  - `evaluation/workspace-doc-share-live-geometry-2026-07-20/screenshots/mobile-390-documents-clicked.png`
  - `evaluation/workspace-doc-share-live-geometry-2026-07-20/screenshots/mobile-390-share-clicked.png`

## Desktop 1440x900

### Documents

- Input empty page height: 988px.
- After generation/documents state height: 1170px, about 1.30x the viewport.
- The previous 2070px / 723px failure was not reproduced on the current live build.
- However, the default desktop documents state still shows the workbench rail on the left and the document review panel on the right. This reduces the sense of a clean Input -> Documents -> Share page transition.
- Useful document review content begins around y=355px. The primary document preview is visible in the first viewport.

### Share

- Share root: x=376, y=172, width=968px, height=803px.
- Share preview: width=938px.
- Primary CTA: width=176px, height=44px, y=916px.
- This is not the old narrow mobile-card layout. It uses a desktop-width workbench panel.
- It is still not a fully desktop-composed two-column share page. The left workbench rail remains, and share content is a stacked panel inside the available workspace.

## Mobile 390x844

### Documents

- After generation/documents state height: 2589px, about 3.07x the viewport.
- Document selector appears at y=593px.
- Document content appears in the first viewport but the risk assessment body is still long and serial.
- No horizontal overflow was detected in this run.
- This remains a mobile task-distance issue, even though the previous horizontal rail scrollbar problem appears improved.

### Share

- Share root: x=27, y=268, width=316px, height=1305px.
- Full document height: 1678px, about 1.99x the viewport.
- Preview begins around y=1146px and primary CTA around y=1516px.
- No horizontal overflow was detected.
- The share mobile view is cleaner than earlier reports but still long because target, channel, language, readiness, preview, and CTA are stacked.

## Stale Surface Assessment

The user is probably not seeing a stale production deployment if they are on `www.safeclaw.kr` now: the live build marker matches the authoritative master head `1334657`. They could still see stale local/dev-server/cache surfaces if they are using an old local server or an already-open tab, but the remaining issues above are present on the current served production surface.

## Required Follow-up

1. Documents: keep desktop preview visible, but reduce default workbench rail presence after generation or make the stage transition more explicit.
2. Documents mobile: collapse or section the long risk assessment body so the first useful review/edit task is not buried in a 2589px page.
3. Share desktop: convert the stacked panel into a stronger desktop composition if this remains a launch priority.
4. Share mobile: reduce language/channel detail to compact controls and move preview/CTA higher.
