# Documents emergency cockpit evidence

## Verdict

PASS_CURRENT_SOURCE.

This slice verifies that the `emergencyResponseDraft` supporting document now opens with a task cockpit before the long structured editor. The cockpit keeps the user's first task focused on stop/report/preserve actions instead of dropping them directly into a long emergency-response textarea.

## Source

- Branch: `chore/recipient-foreign-live-gate-20260720`
- Product commit: `97bf92cd7614ee75d2e73d4137213d2482bb97d8`
- Route: `/documents`
- Surface: `emergencyResponseDraft`
- Production live geometry claimed: no

## Product contract checked

- `emergency-document-cockpit` is rendered for the emergency response document.
- The cockpit is placed below the document toolbar and before the raw structured document editor.
- The surfaced fields are bounded to immediate stop criteria, reporting roles, initial response actions, and site preservation.
- The UI does not invent phone numbers; it explicitly points to the field-approved contact list.
- Provider, export, dispatch, and backend contracts were not changed.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test -- tests\documents-editor-layout.test.ts -t "puts supporting document cockpits" --maxWorkers=1 --fileParallelism=false` | PASS, 1 file / 1 test |
| `npm.cmd test -- tests\documents-editor-layout.test.ts -t "supports roving keyboard navigation\|bounds the default documents route editor\|puts the core launcher before the mobile editor\|puts supporting document cockpits\|keeps the editor workspace and expanded tools contained" --maxWorkers=1 --fileParallelism=false` | PASS, 1 file / 6 tests |
| `npm.cmd run typecheck` | PASS |
| `git diff --check` | PASS |

## Structural note

Splitting routes alone does not solve the long-page problem. A separate `/documents` page can still feel long if the first viewport is a raw editor plus secondary panels. The safer pattern is:

1. Keep each workflow step as a short first-view cockpit.
2. Surface only the task the user must decide now.
3. Move long document bodies, detailed edits, and supporting artifacts behind an explicit drilldown.

For emergency response, that means the first screen answers “When do we stop, who reports, what do we preserve?” before showing the full editable procedure.

## Remaining debt

- This is current-source evidence only; production browser geometry is still needed before a final UX PASS claim.
- Photo evidence, multilingual briefing/transmission, field message, and summary still need first-task surfaces or bounded review cards.
- Existing dirty `evaluation/northstar-open-gates-current/report.md` and `report.json` files were preserved and intentionally not included in this slice.
