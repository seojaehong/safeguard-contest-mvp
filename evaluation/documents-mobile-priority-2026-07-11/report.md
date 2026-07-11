# Documents mobile priority verification

## Scope

- Keep the desktop three-column document cockpit.
- On mobile, expose only `위험성평가표`, `TBM 브리핑`, and `TBM 기록` before the editor.
- Move the remaining six documents, previews, submission facts, and links into one collapsed disclosure.
- Keep document selection, editing, persistence, export, keyboard navigation, Day/Night, and 390px containment behavior intact.

## Before and after

| Metric | `cab4a19` baseline | Updated branch |
| --- | ---: | ---: |
| Mobile cockpit height | 2,585px | 302px |
| First editor absolute top | 3,141px | 789px |
| Horizontal overflow at 390px | 0px | 0px |
| Core touch target height | Not applicable | 44px each |
| Initial mobile document controls | 9 documents expanded | 3 core documents |

The first editor now begins 2,352px earlier. The underlying editor remains 1,403px tall; the change removes pre-editor document density instead of shrinking the editing surface.

## Rendered checks

- 390px Day: launcher top 472px, editor top 789px, document focus top 58px.
- 390px Night: launcher top 472px, editor top 789px, document focus top 58px.
- Day and Night document widths equal the 390px viewport with no horizontal overflow.
- Desktop 1440px: cockpit columns remain `280px / 574px / 300px`, with 9 index actions, 3 core previews, and the mobile launcher hidden.
- Selecting `TBM 기록` focuses its textarea and scrolls the document body into the viewport.
- Changing the editor's mobile document picker updates the core launcher's `aria-pressed` state.
- Intentionally emptying one current launch document changes the written count from `9/9종` to `8/9종`; fallback preview copy is not counted as a written document.
- The same `9/9종` to `8/9종` count update works for the default sample pack without creating the canonical current-workpack storage key.
- Reloading the default sample pack restores its local editor draft, keeps the count at `8/9종`, and does not promote it to a current workpack.

Generated browser captures:

- `output/playwright/2026-07-11/documents-mobile-priority/mobile-day-baseline-cab4a19.png`
- `output/playwright/2026-07-11/documents-mobile-priority/mobile-day-initial.png`
- `output/playwright/2026-07-11/documents-mobile-priority/mobile-night-initial.png`
- `output/playwright/2026-07-11/documents-mobile-priority/mobile-day-editor-focus.png`
- `output/playwright/2026-07-11/documents-mobile-priority/mobile-night-editor-focus.png`
- `output/playwright/2026-07-11/documents-mobile-priority/desktop-day-cockpit.png`

## Verification

- Focused TDD contract: 3 passed.
- Full `tests/documents-editor-layout.test.ts`: 20 passed.
- TypeScript strict typecheck: passed.
- `npm.cmd run build`: passed, including 27 statically generated pages.
- No schema migration or database mutation was performed.
