# Workspace Empty State And Rail Alignment

## Scope

- Remove the sentence-like placeholder after an example is cleared.
- Hide the example restore action when there is no selected example.
- Keep the filled desktop sidebar and workspace canvas aligned on the shorter viewport reported by the user.
- Preserve the existing compact presentation behavior below the normal desktop-height boundary.

## Root Cause

The input used a persistent placeholder even when its value was empty, and the restore action rendered unconditionally while `selectedExample` fell back to the first example. The rail alignment override only applied at `721px` or taller, while the short-desktop rule capped the sidebar and gave it an independent scrollbar. At a `700px` viewport this produced a `147.9375px` bottom mismatch.

## Change

- `SafeGuardCommandCenter.tsx`
  - Uses an empty placeholder because the field already has a visible label, heading, description, and helper text.
  - Renders `예시로 되돌리기` only while an example remains selected.
  - Preserves the selected example while non-empty edits are made, then detaches it only when the input is fully cleared.
- `globals.css`
  - Applies the final stretch/no-independent-scroll rail owner from `680px` upward instead of `721px`.
  - Leaves the existing ultra-short presentation rules below `680px` intact.
- `workspace-layout-regression.test.ts`
  - Adds a clear-example regression at `1560x700`.
  - Moves the filled rail alignment regression to `1560x700`.

## TDD Evidence

RED:

- Empty input still exposed `오늘 작업 내용을 한 줄로 입력하세요.`.
- Filled rail bottom delta was `147.9375px`.
- A first broad override also broke four protected ultra-short presentation cases, so the media boundary was narrowed.
- Independent review found that the first visibility fix dropped restore context on every edit; the state transition now covers second-example select, edit, restore, and clear.

GREEN:

- Targeted browser regressions: `2 passed`.
- Full workspace browser regressions: `23 passed`, `1 skipped`.
- Strict TypeScript typecheck: passed.
- Next production build: `27/27` static pages generated.
- `git diff --check`: passed; only Git line-ending notices were emitted.

## Browser Evidence

Viewport: `1560x700`, Day theme, `seoul-construction-windy` example.

Filled state:

- Sidebar/main top: `117.046875px / 117.046875px`
- Sidebar/main bottom: `848.984375px / 848.984375px`
- Bottom delta: `0px`
- Sidebar overflow: `visible`
- Independent sidebar scroll: `false`

Cleared state:

- Input length: `0`
- Placeholder: empty
- Restore action count: `0`
- Current-work and source-status blocks: `0 / 0`
- Sidebar/main bottom: `788.984375px / 788.984375px`
- Bottom delta: `0px`
- Independent sidebar scroll: `false`
- Horizontal overflow: none (`documentScrollWidth = viewportWidth = 1560`)

Artifacts:

- `browser-metrics.json`
- `filled-1560x700.png` (`A49313DC81892EB0070BAA12EEBBE505BA782E758D33C95855F0B3D317D15CE0`)
- `cleared-1560x700.png` (`0B102098DFEAB6EEAB4BE53135994DE78DC18F5DBA54AEE756728E98ADFCDE9E`)

## Boundaries

- No API, DB, schema, ontology, provider, or document-generation behavior changed.
- No existing protected `output/playwright` screenshot was staged or modified.
