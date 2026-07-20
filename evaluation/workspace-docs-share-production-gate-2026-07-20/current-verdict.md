# Workspace Documents / Share Current Verdict

Checked at: 2026-07-20 KST

## Verdict

**DOCUMENTS DESKTOP COCKPIT PASS / DOCUMENTS MOBILE PARTIAL / SHARE DESKTOP PASS.**

This update answers the product-structure question directly: splitting Input, Documents, and Share into pages is useful for navigation clarity, but it does not solve long surfaces by itself. The launch-safe fix is viewport-first disclosure: the default stage must show the decision summary, core controls, and primary next action in the first viewport; long documents, provenance, history, logs, and all 12 outputs remain behind explicit details/deep-review entrypoints.

## Current Patch Evidence

Measured against local production build from current worktree after `npm.cmd run build`.

Raw evidence:

- `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-short-day-current-documents.png`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-documents.png`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-documents.png`

## Documents Geometry

| Variant | Viewport | Body | Workbench | Safety brief | Risk edit CTA | Share CTA | Detail cluster | Provenance | Deep review | Overflow | Outside |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| desktop-short-day | 1440x723 | 876 / 1.21x | bottom 722 | bottom 649 | bottom 391 | bottom 441 | bottom 711 | bottom 702 | bottom 710 | false | 0 |
| desktop-day | 1440x900 | 1053 / 1.17x | bottom 810 | bottom 723 | bottom 419 | bottom 469 | bottom 797 | bottom 788 | bottom 796 | false | 0 |
| mobile-day | 390x844 | 1205 / 1.43x | bottom 1100 | bottom 981 | bottom 542 | bottom 543 | bottom 1089 | bottom 1034 | bottom 1088 | false | 0 |

### Documents Desktop

Desktop short-height cockpit is now PASS for the user-visible complaint:

- `1440x723` first viewport contains the safety brief, risk assessment edit CTA, next share CTA, provenance entrypoint, and deep-review entrypoint.
- Full document preview remains hidden while `document-deep-review` is closed.
- Visible full document previews while closed: `0`.
- Horizontal overflow: `false`; outside elements: `0`.

### Documents Mobile

Mobile is PARTIAL, not full PASS:

- Primary risk assessment edit/share CTAs are visible early: bottom `542` / `543` in a `390x844` viewport.
- Full safety brief and detail entrypoints are still below the first viewport: safety brief bottom `981`, provenance/deep-review bottom `1034` / `1088`.
- No horizontal overflow or outside elements.

A future mobile density wave should compress the brief further, for example top one risk row plus compact `나머지 보기`, or a bottom action bar for provenance/deep review. This patch does not claim that full mobile cockpit is closed.

## Share Geometry

Share remains a separate verdict from Documents.

| Variant | Viewport | Body | Preview | Primary CTA | Form | Overflow | Outside |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| desktop-short-day | 1440x723 | 920 / 1.27x | y 305, bottom 705, width 520 | bottom 349 | bottom 675 | false | 0 |
| desktop-day | 1440x900 | 920 / 1.02x | y 305, bottom 705, width 520 | bottom 349 | bottom 675 | false | 0 |
| mobile-day | 390x844 | 1455 / 1.72x | y 380, bottom 599, width 310 | bottom 1243 | bottom 1243 | false | 0 |

Share desktop cockpit is PASS:

- Not mobile-card-like: right preview pane is `520px` wide.
- Short desktop first viewport contains primary CTA, form strip, and preview.
- Mobile remains a longer single-column flow; this is separate from the desktop share blocker.

## Test Evidence

Fresh after rebuilding `.next`:

- `npm.cmd run build`: PASS, 28/28 app pages.
- `npm.cmd test -- tests\north-star-document-ux.test.ts tests\workspace-layout-regression.test.ts tests\frontend-workbench-visual-contract.test.ts`: PASS, 3 files, 43 tests passed, 1 skipped.

Important interpretation: `evaluation/north-star-document-ux-24h-2026-07-14/browser-metrics.json` is explicit deep-review/editor-mode evidence. It opens deep review and therefore should not be used as default closed-state cockpit proof. Default closed-state proof is `current-geometry.json`.

## Remaining IA Debt

- Documents mobile remains PARTIAL until the entire safety brief/detail entrypoints fit closer to the first viewport.
- Document-specific rich editors for TBM, permit, education, and foreign-worker documents remain separate product depth work.
- Route/page splitting alone is not the answer; progressive disclosure and field-mode/manager-mode separation are the answer.
