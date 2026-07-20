# Share Mobile Full-Flow Gate

Checked at: 2026-07-21 KST

## Verdict

PASS for the mobile Share default flow.

The detailed target, channel, and language cards still continue below the first viewport, but the selected transmission summary, message preview, and primary action are now all visible in the first viewport. This closes the mobile default-flow issue without broad route splitting or document-library rewrites.

## Source

- Base HEAD: `b4eabe94e949e7e71f2b12092dd0f6ec2ca7d2a6`
- Branch: `chore/recipient-foreign-live-gate-20260720`
- Production marker: `c18854e889f6fdbd7a6f85fafc70d0fa1177b54e`
- Probe URL: `https://www.safeclaw.kr`
- Probe artifact: `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`

## Current Geometry

Mobile 390x844:

- `shareMobileSummary.bottom = 432`
- `sharePreview.bottom = 659`
- `primaryShareCta.bottom = 720`
- `shareTargetCard.bottom = 930`
- `shareChannelCard.bottom = 1184`
- `shareLanguageCard.bottom = 1321`
- `shareBody = 1533`
- `overflowX = false`
- `outside = 0`

Desktop preservation:

- Desktop-short share target/channel/language cards bottom: `675`
- Desktop-short share preview bottom: `705`
- Desktop-short primary CTA bottom: `349`
- Desktop-short overflow/outside: `false / 0`

Documents preservation:

- Mobile document workbench bottom: `835`
- Mobile safety brief bottom: `762`
- Mobile document secondary actions bottom: `824`
- Mobile outside: `0`

## Interpretation

Route splitting alone would not solve long mobile sharing. The bounded fix is a mobile summary strip that surfaces selected 대상/채널/언어 before the detailed cards, while preserving the deeper configuration cards below the fold.

