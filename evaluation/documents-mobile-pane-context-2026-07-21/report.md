# Documents Mobile Pane Context Gate

Checked at: 2026-07-21 03:50 KST

Latest source HEAD before this summary-depth patch: `bb60fdf8461dbd117827748ba7e35ef51de00bb2`

Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the bounded current-source gate.

This wave keeps the `/documents` mobile page body bounded and adds persistent selected-document context inside the internal editor pane.

## Baseline Debt

Production `45a5e6285c1bdc788fd40b99bb29de58200495fc` closed the selection landing bug:

- `위험성평가표` click landed with textarea `top=492`, `bottom=650` inside pane `476-796`.

The next readability debt was deep internal pane scroll:

- When `.workpack-shell.scrollTop` advanced to roughly `1010`, the user saw mid-document controls and evidence utilities.
- The selected document title/context was not anchored at the pane top.

## Current Fix

- Mobile `/documents` restores `.document-toolbar` as a route-scoped compact sticky pane header.
- The toolbar shows the selected document title and compact status.
- The toolbar now also carries a selected-document drilldown summary: `N섹션 · 근거 N건 · 확인 N건`.
- The toolbar stays inside `.workpack-shell` while the pane scrolls.
- The existing non-interactive bottom scroll affordance remains.

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

- After selecting `TBM 기록`, the toolbar is visible in `.workpack-shell`, sticky, and contains `TBM 기록`.
- After selecting `TBM 기록`, the selected-document summary remains visible and includes `섹션`, `근거`, and `확인`.
- After selecting `위험성평가표`, the toolbar is visible in `.workpack-shell`, sticky, and contains `위험성평가표`.
- After selecting `위험성평가표`, the selected-document summary remains visible and includes `섹션`, `근거`, and `확인`.
- After programmatic deep scroll (`scrollTop >= 600`), the toolbar remains near the pane top, below the pane bottom, and does not cover the active textarea.
- After programmatic deep scroll, the selected-document summary still remains attached to the sticky pane toolbar.
- Page height remains bounded after selection and deep scroll: `pageHeight <= viewportHeight + 1`.
- Horizontal overflow remains closed: `scrollWidth <= viewportWidth + 1`.

## IA Note

Route splitting alone is not accepted as the UX fix. The route must behave as a viewport cockpit, and long documents must live in bounded panes or drilldown sections with visible local context.

