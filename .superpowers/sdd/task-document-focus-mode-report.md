# SafeClaw Document Focus Mode Report

## Scope

- Added an explicit `review | editor` document surface state in `SafeGuardCommandCenter`.
- Kept the existing `FieldOperationsWorkspace` and `WorkpackEditor` path; no duplicate editor or route was introduced.
- Scoped changes to the owned component, CSS, regression test, task plan, and this report.
- Left `evaluation/crunch`, `output/playwright`, and the unrelated SIF plan untouched.

## Implementation

- Review mode mounts `.document-workbench` without `.field-workspace`.
- `편집` and `다운로드 영역 열기` switch to editor mode, which mounts one `.field-workspace` without `.document-workbench`.
- `문서 검토로 돌아가기` restores review mode while preserving the generated payload and selected document key.
- Input navigation, example selection, generation start, and generated-payload application reset the document surface to review mode.
- Day keeps the existing light editor bridge styling.
- Night now uses workspace surface tokens for editor text and background, keeps editor overflow visible, and preserves textarea focus styling.

## TDD Evidence

### Existing RED

Command:

```text
npm.cmd test -- tests/workspace-layout-regression.test.ts
```

Before production changes, the document test failed because review mode mounted one `.field-workspace` where zero was required:

```text
expected 1 to be 0
tests/workspace-layout-regression.test.ts:946
```

The same controller RED run also contained the mobile Day composer failure at the pre-existing scroll-height assertion.

### Night RED

Command:

```text
npm.cmd test -- tests/workspace-layout-regression.test.ts -t "keeps the Night document editor readable, scroll-safe, and focused"
```

The Night test failed before implementation with all intended symptoms:

- Review mode `.field-workspace`: received `1`, expected `0`.
- Editor mode `.document-workbench`: received `1`, expected `0`.
- Editor foreground/background contrast: `1.0639777835486894`, below the required threshold.
- Editor `overflowX` and `overflowY`: `hidden`, expected `visible`.

Textarea focus already worked and remained covered by the GREEN test.

### Focus-Mode GREEN

Command:

```text
npm.cmd test -- tests/workspace-layout-regression.test.ts -t "keeps the generated document edit flow inside the workspace design system|keeps the Night document editor readable, scroll-safe, and focused"
```

Result:

```text
Test Files  1 passed (1)
Tests       2 passed | 13 skipped (15)
```

This covers Day review-to-editor-to-review behavior, exact surface counts, Night download click flow, foreground/background contrast, visible overflow, and textarea focus.

## Mobile Day Hydration Fix

The named mobile test intermittently measured a duplicated `240`-character value after `page.fill`, which produced `scrollHeight: 284` against `clientHeight + 36: 176`. The intended question is `120` characters, so this was a Next dev hydration/input timing race rather than a valid textarea-layout regression.

The test now makes the setup deterministic before collecting layout metrics:

- Waits for React's textarea props to be attached before calling `page.fill`.
- Waits two animation frames for the controlled input to settle.
- Asserts `page.inputValue("#field-command-input")` exactly equals the intended `mobileQuestion` before reading geometry.
- Keeps the original `scrollHeight <= clientHeight + 36` invariant unchanged.

Command:

```text
npm.cmd test -- tests/workspace-layout-regression.test.ts -t "keeps the mobile day composer action inside the first viewport"
```

Result:

```text
Test Files  1 passed (1)
Tests       1 passed | 14 skipped (15)
```

The scroll-height invariant was not relaxed or removed.

## Verification

- Mobile hydration regression: GREEN.
- Focus-mode regression tests: GREEN.
- Edit preservation regression: GREEN. The test verifies the edited document in the editor draft store, current-workpack snapshot, review preview, and reopened editor.
- Full workspace regression: GREEN, `16 passed` via `npm.cmd test -- tests/workspace-layout-regression.test.ts`.
- Typecheck: GREEN via `npm.cmd run typecheck` (`tsc --noEmit --incremental false`).
- `git diff --check`: no whitespace errors; only Windows line-ending notices were emitted.

## Self-Review

- No second `WorkpackEditor` instance or editor route was added.
- Generated payload and selected document key remain parent state across review/editor transitions.
- Workpack edits propagate from `WorkpackEditor` after local-draft hydration, avoiding an initial-value overwrite race.
- Submit-readiness decoration is idempotent, so reopening an edited document does not duplicate its header.
- Review and editor surfaces are mutually exclusive in the DOM.
- No database, API, ontology, evidence, or share-readiness behavior changed.
- No unrelated artifact or unowned plan is included in the commit scope.
