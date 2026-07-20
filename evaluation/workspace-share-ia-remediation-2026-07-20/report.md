# SafeClaw Workspace Share IA Remediation

- Generated: 2026-07-20T14:25:00Z
- Measurement mode: local production build
- Verdict: desktop share cockpit PASS, mobile rescue preserved

## Product Answer

Page splitting alone does not solve long content. The fix is viewport-first information architecture: each stage must expose the critical controls, preview, and primary action in the first viewport, while long documents, logs, evidence, and secondary details stay folded or below the action.

## Change

The Share step now behaves like a desktop action cockpit:

- Primary share action moved into the compact control strip, before secondary notes/results
- Desktop grid: left controls + right preview pane
- Right preview pane: 520px wide, sticky, bounded internal scroll
- Mobile remains single column and keeps the previous no-overflow rescue behavior

Documents keep the safer default:

- `document-deep-review` is closed by default
- visible full document previews: 0
- long document preview/editor appears only after explicit deep review

## Geometry

| Surface | Viewport | Share body | CTA | Preview | Form strip |
| --- | --- | ---: | ---: | ---: | ---: |
| desktop-short-day | 1440x723 | 920px / 1.27x | y=305, bottom=349 | y=305, bottom=705, width=520 | bottom=675 |
| desktop-day | 1440x900 | 920px / 1.02x | y=305, bottom=349 | y=305, bottom=705, width=520 | bottom=675 |
| mobile-day | 390x844 | 1455px / 1.72x | y=1199, bottom=1243 | y=380, bottom=599, width=310 | bottom=1243 |

All measured variants:

- horizontal overflow: false
- outside viewport elements: 0
- primary share CTA count: 1
- document deep review open: false
- visible full document previews while closed: 0

## Closed Acceptance

- Desktop short viewport primary share CTA is inside the 723px fold.
- Desktop short viewport preview bottom is inside the 723px fold.
- Desktop short viewport critical form strip bottom is inside the 723px fold.
- Desktop preview width is 520px, no longer a mobile-card width.
- Mobile preview remains at y=380 with no horizontal overflow.

## Remaining IA Debt

This is a bounded desktop-share remediation, not the final product architecture.

- Mobile Share remains a longer single-column flow; this patch preserves the previous mobile rescue but does not make mobile CTA first-viewport.
- Documents short desktop remains 1.57x viewport; full preview is hidden, but a future manager-cockpit pass can further compress the default brief.
- Production verification must be rerun after deployment because this report was measured on a local production build.

## Evidence

- `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-short-day-current-share.png`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/desktop-day-current-share.png`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/mobile-day-current-share.png`
