# Workspace Input Regression Verification

- Date: 2026-07-13
- Source commit: `59f48123da62fb405e639da03912aa1ed6c000b9`
- Local route: `http://127.0.0.1:3024/workspace?theme=day`
- Public route: `https://www.safeclaw.kr/workspace?theme=day`
- Browser: Codex in-app browser
- Viewport: 1560 x 700 CSS px
- Scope: empty/example-cleared state and sidebar/main column alignment

## Result

PASS on the reviewed source commit and on the current public deployment for this bounded input/layout regression. The Vercel PR preview remains SSO-protected, so this does not claim that every change in the PR has been preview-verified.

## Browser Evidence

| State | Input | Current work | Evidence status | Revert action | Top delta | Bottom delta | Sidebar scroll | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Initial empty | 0 chars | 0 | 0 | 0 | 0 px | 0 px | none | 0 px |
| Filled example | 120 chars | 1 | 1 | 1 | 0 px | 0 px | none | 0 px |
| Cleared with keyboard | 0 chars | 0 | 0 | 0 | 0 px | 0 px | none | 0 px |

The empty textarea has an empty `placeholder` attribute. After `Ctrl+A` and `Backspace`, the input value, current-work summary, evidence status, recognized chips, and example-reset action all disappear together. The sidebar uses `overflow-y: visible`, has no independent scroll range, and shares identical top and bottom edges with the main column.

The browser runtime's programmatic `fill("")` helper did not preserve the empty controlled value in this run. A real keyboard deletion path did preserve it and updated every dependent surface. The product acceptance result is therefore based on the user-equivalent keyboard path plus the repository Playwright contract.

## Public Deployment Evidence

The same checks were repeated against `www.safeclaw.kr` in the Codex in-app browser at 1560 x 700 CSS px. The untouched route and the scenario route after a keyboard `Backspace` both produced an empty input with no stale work brief, evidence status, recognized chips, or reset action. Column top/bottom deltas remained 0 px, the sidebar had no independent scroll, and horizontal overflow remained 0 px.

The browser adapter does not transmit a zero-length `fill("")` payload. For the public keyboard check, a single space was entered and then removed with `Backspace`, exercising the controlled input's real key event path and resulting in a zero-length value.

## Automated Contract

Command:

```powershell
npm.cmd test -- tests/workspace-layout-regression.test.ts tests/workspace-input-css-contract.test.ts --maxWorkers=1 --no-file-parallelism
```

Result: 2 files passed, 26 tests passed, 1 production-only matrix test skipped.

The browser regression suite also covers an untouched empty route and the example-clear path, requiring no stale current-work/evidence/chip/reset controls and at most 1 px column-edge drift.

## Screenshots

- `empty-day-1560x700.png`
- `filled-day-1560x700.png`
- `cleared-keyboard-day-1560x700.png`
- `production-empty-day-1560x700.png`
- `production-cleared-keyboard-day-1560x700.png`
