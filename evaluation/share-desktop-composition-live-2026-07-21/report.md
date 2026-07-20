# Share Desktop Composition Live Gate

Checked at: 2026-07-21 KST

## Verdict

`PASS_PRODUCTION`

The `/workspace` share desktop composition fix is now deployed to production. The live page no longer presents the channel selector as a narrow mobile-like one-column rail on desktop. The share step renders as a desktop two-pane cockpit with left-side workflow controls and a right-side message preview.

This evidence is scoped to the share composition/layout. It does not claim live provider dispatch.

## Production build

- URL: `https://www.safeclaw.kr`
- Build info: `4979638493c0eebd410e2f1ab0f5383c2f3c7102`
- Deployment URL: `safeguard-contest-81fnx0h82-seojaehongs-projects.vercel.app`

## Live geometry

Measured through `evaluation/workspace-docs-share-production-gate-2026-07-20/run-current-geometry-probe.mjs`.

### Desktop short height

- Viewport: `1440x723`
- Page height: `918`
- Share root: `1180x665`, x `130`, bottom `854`
- Primary action: x `149`, width `606`, bottom `349`
- Target card: x `149`, width `400`, bottom `511`
- Language card: x `561`, width `194`, bottom `511`
- Channel card region: x `149`, width `606`, bottom `673`
- Preview pane: x `771`, width `520`, bottom `705`
- Primary CTA count: `1`
- Horizontal overflow: `0`
- Outside viewport elements: `0`

### Desktop normal height

- Viewport: `1440x900`
- Page height: `918`
- Share root: `1180x665`, x `130`, bottom `854`
- Primary action: x `149`, width `606`, bottom `349`
- Channel card region: x `149`, width `606`, bottom `673`
- Preview pane: x `771`, width `520`, bottom `705`
- Primary CTA count: `1`
- Horizontal overflow: `0`

### Mobile

- Viewport: `390x844`
- Page height: `993`
- Share root: `336x644`, x `27`, bottom `888`
- Preview: `310x219`, bottom `659`
- Primary action: `292x44`, bottom `720`
- Config cards remain collapsed by default in the mobile flow.
- Horizontal overflow: `0`

## Remaining debt

- The broader documents edit mode is still long as a full editing surface; the risk-row cockpit improves first-task visibility but does not make the entire 12-document editor short.
- A fuller share wizard redesign is still separate if the product direction requires separate recipient, language, message, and send screens.
- Live provider dispatch remains approval/configuration gated.
