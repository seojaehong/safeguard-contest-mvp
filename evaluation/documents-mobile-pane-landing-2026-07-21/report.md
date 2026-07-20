# Documents Mobile Pane Landing Gate

Checked at: 2026-07-21 03:12 KST

Source HEAD before commit: `547c2ed6099e8156e8ff01595003cb3222015231`

Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the bounded current-source gate.

This does not claim a route split or a full document-specific drilldown redesign. It closes the immediate mobile `/documents` internal-pane RED: selecting a document must land the user on visible editable content inside the bounded pane.

## Baseline RED Being Closed

Production `2346cf1291304920bc8007b0efbceaf809a11ba3`, `/documents?theme=day`, 390x844:

- Page height was already bounded at `844px / 1.00x`.
- `.workpack-shell` was the internal scroll container: top `452`, bottom `772`, height `320`, `overflowY=auto`.
- After selecting `riskAssessmentDraft`, the first textarea started at `top=775`, just below the pane bottom `772`.
- Result: the selected document key changed, but no editable content was immediately visible in the pane.

## Current Fix

- `WorkpackEditor` now keeps a ref to `.workpack-shell`.
- After `selected.key` changes, it aligns the first editable target into the internal pane if that target does not intersect the pane.
- Mobile `/documents` now has a non-interactive bottom scroll affordance on the pane: `아래로 계속`.

## Verified Contract

Focused current-source browser gate:

```text
npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file / 2 tests.

Full layout browser gate:

```text
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
```

Result: PASS, 1 file / 31 tests.

TypeScript:

```text
npm.cmd run typecheck
```

Result: PASS.

Assertions added:

- The internal pane remains `overflowY=auto`.
- The pane has additional content: `scrollHeight > clientHeight`.
- The bottom affordance is visible to layout: content `아래로 계속`, `position=sticky`, `pointer-events=none`, `min-height >= 28`.
- After selecting `TBM 기록`, the selected textarea intersects `.workpack-shell`.
- After selecting core `위험성평가표`, the selected textarea intersects `.workpack-shell`.
- After selecting `위험성평가표`, page height remains bounded: `pageHeight <= viewportHeight + 1`.
- Horizontal overflow remains closed: `scrollWidth <= viewportWidth + 1`.

## Product IA Decision

Route splitting alone is not accepted as a UX fix. `/workspace`, `/documents`, and `/dispatch` help orientation, but each route can still become a long page if the full document, evidence, and share details are default-open.

The release contract is:

- Each route starts as a viewport-sized cockpit.
- Long artifacts stay in bounded panes or explicit drilldown/detail sections.
- Selecting a document must land the user on visible editable content, not merely change an internal key.

