# Documents Mobile Pane Context Gate

Checked at: 2026-07-21 04:08 KST

Latest source HEAD before this summary-depth patch: `bb60fdf8461dbd117827748ba7e35ef51de00bb2`

Latest overlap-remediation production marker: `f5b29ce18abe4533b846de2ee70919df25f752e3`

Branch: `chore/recipient-foreign-live-gate-20260720`

## Verdict

PASS for the bounded current-source gate and production overlap remediation.

This wave keeps the `/documents` mobile page body bounded and adds persistent selected-document context inside the internal editor pane.

## Baseline Debt

Production `45a5e6285c1bdc788fd40b99bb29de58200495fc` closed the selection landing bug:

- `위험성평가표` click landed with textarea `top=492`, `bottom=650` inside pane `476-796`.

That old acceptance was only a pane-intersection PASS. A later live review found the sticky toolbar could still overlap the first editable field: toolbar `bottom=572` while textarea `top=492`. The strengthened contract now requires the active textarea to land below the visible sticky toolbar, not merely somewhere inside the pane.

The next readability debt was deep internal pane scroll:

- When `.workpack-shell.scrollTop` advanced to roughly `1010`, the user saw mid-document controls and evidence utilities.
- The selected document title/context was not anchored at the pane top.

## Current Fix

- Mobile `/documents` restores `.document-toolbar` as a route-scoped compact sticky pane header.
- The toolbar shows the selected document title and compact status.
- The toolbar now also carries a selected-document drilldown summary: `N섹션 · 근거 N건 · 확인 N건`.
- The toolbar stays inside `.workpack-shell` while the pane scrolls.
- The pane alignment now keeps the first editable field below the sticky toolbar instead of merely partially visible behind it.
- The existing non-interactive bottom scroll affordance remains.

## Production Confirmation

Production `a2028757e62553346733c757108f56a28495f888` confirms the selected-document summary is live:

- `/documents?theme=day`, 390x844.
- Default route: `bodyHeight=844`, `scrollWidth=390`, `.workpack-shell` `476-796`, `overflowY=auto`.
- Default selected summary: `5섹션 · 근거 4건 · 확인 1건`.
- After selecting `위험성평가표`: summary `7섹션 · 근거 4건 · 확인 1건`, toolbar sticky inside pane, `bodyHeight=844`, no horizontal overflow.
- After internal deep scroll `scrollTop=1000`: the same summary remains visible in the sticky toolbar.

Production `f5b29ce18abe4533b846de2ee70919df25f752e3` confirms the strengthened overlap acceptance is live:

- `/documents?theme=day`, 390x844.
- After selecting `위험성평가표`: `bodyHeight=844`, `horizontalOverflow=0`, pane `476-796`, `scrollTop=334`.
- Summary remains `7섹션 · 근거 4건 · 확인 1건`.
- Toolbar `top=476`, `bottom=572`; textarea `top=656`, `bottom=814`.
- `toolbarCoversTextarea=false` and `textareaBelowToolbar=true`.
- After internal deep scroll `scrollTop=1000`: summary remains visible, toolbar remains sticky at `476-572`, `toolbarCoversTextarea=false`, page stays `844px` tall with no horizontal overflow.

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
- After selecting `TBM 기록`, the sticky toolbar does not cover the active textarea.
- After selecting `위험성평가표`, the toolbar is visible in `.workpack-shell`, sticky, and contains `위험성평가표`.
- After selecting `위험성평가표`, the selected-document summary remains visible and includes `섹션`, `근거`, and `확인`.
- After selecting `위험성평가표`, the sticky toolbar does not cover the active textarea.
- After programmatic deep scroll (`scrollTop >= 600`), the toolbar remains near the pane top, below the pane bottom, and does not cover the active textarea.
- After programmatic deep scroll, the selected-document summary still remains attached to the sticky pane toolbar.
- Page height remains bounded after selection and deep scroll: `pageHeight <= viewportHeight + 1`.
- Horizontal overflow remains closed: `scrollWidth <= viewportWidth + 1`.

## IA Note

Route splitting alone is not accepted as the UX fix. The route must behave as a viewport cockpit, and long documents must live in bounded panes or drilldown sections with visible local context.

