# Workspace Documents/Share Live After Deploy

Date: 2026-07-20 KST

## Verdict

The workspace document/share UX remediation is live on production.

- Served URL: `https://www.safeclaw.kr/workspace`
- Production build marker: `54af1d7d36b369031b29947e9a73e56a658ea346`
- Branch: `master`
- Deployment URL: `safeguard-contest-lmztddpl8-seojaehongs-projects.vercel.app`

## Live Browser Metrics

Measured with Playwright Chromium against `https://www.safeclaw.kr`.

### Desktop 1440x900

- Input page height: 988px, outside elements 0.
- Documents page height: 1147px, outside elements 0.
- Documents step rail: y=116, h=65.
- Documents preview body: h=320, retained scrollHeight=1052, overflow-y auto.
- Share page height: 1061px, outside elements 0.
- Share root: x=186, y=237, w=980, h=667.63.
- Share preview lines: h=356.31, overflow-y auto.
- Share primary CTA: y=845.63, h=44.

### Mobile 390x844

- Input page height: 988px, outside elements 0.
- Documents page height: 1417px, outside elements 0.
- Documents step rail: y=165, h=65.
- Documents preview body: h=360, retained scrollHeight=1492, overflow-y auto.
- Share page height: 1487px, outside elements 0.
- Share root: x=27, y=244, w=316, h=1138.14.
- Share preview lines: h=160, retained scrollHeight=272, overflow-y auto.
- Share primary CTA: y=1325.14, h=44.

## Comparison Against Baseline

- Mobile Documents page height: 2589px -> 1417px.
- Mobile document preview: full body exposed -> 360px bounded preview.
- Mobile Share page height: 1678px -> 1487px.
- Mobile Share primary CTA bottom: 1560px -> 1369px.
- Desktop Share previously failed the task-distance gate at 1352px; live after deploy is 1061px.

## Evidence Files

- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/report.json`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/desktop-1440-input-empty.png`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/desktop-1440-documents.png`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/desktop-1440-share.png`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/mobile-390-input-empty.png`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/mobile-390-documents.png`
- `evaluation/workspace-doc-share-live-after-deploy-2026-07-20/screenshots/mobile-390-share.png`
