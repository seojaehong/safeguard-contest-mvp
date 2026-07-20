# Documents / Share IA Production Verification

Checked at: 2026-07-20T16:53:34.760Z
Production commit: `be7f45cdf06f5a807b4fc024edf1210da334a46b`

## Metrics

### documents-desktop-short
- body: 754 / 723 = 1.04x
- overflowX: false
- outside: 0
- workpack shell: top 286, height 420, bottom 706, overflowY auto
- document editor top: 286
- textarea top: 595
- mobile core launcher bottom: 278

### documents-mobile
- body: 1816 / 844 = 2.15x
- overflowX: false
- outside: 0
- workpack shell: top 545, height 1223, bottom 1768, overflowY visible
- document editor top: 671
- textarea top: 1005
- mobile core launcher bottom: 529

### workspace-share-desktop-short
- body: 798 / 723 = 1.1x
- overflowX: false
- outside: 0
- share root: x 130, width 1180, bottom 731
- preview: x 771, width 520, bottom 702
- primary CTA bottom: 346
- channel cards: 172x44, 172x44, 172x44

### workspace-share-mobile
- body: 1439 / 844 = 1.7x
- overflowX: false
- outside: 0
- share root: x 27, width 336, bottom 1334
- preview: x 40, width 310, bottom 659
- primary CTA bottom: 720
- channel cards: 91x86, 91x86, 91x86

## Verdict

- Standalone `/documents` desktop short-height: PASS. The production page is 1.04x viewport, workpack/editor top is 286, shell height is 420, shell bottom is 706, and overflow/outside are closed.
- Standalone `/documents` mobile: FOLLOW-UP. The production page remains 2.15x viewport and the editor/textarea still start below the first viewport.
- Workspace share desktop density: PASS. The preview remains a 520px right pane, primary CTA is inside the first viewport, and all three channel cards measure 172x44.
- Workspace share mobile: ACTION COCKPIT PASS / FULL FLOW PARTIAL. Preview and primary CTA are inside the first viewport, but detailed cards continue below by design.
