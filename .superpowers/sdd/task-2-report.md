# Task 2 Review Remediation Report

Date: 2026-07-11
Commit: this report is included in `fix: enforce frontend design contract`; the exact commit hash is recorded in the final task handoff.

## Resolved findings

- Normalized later `.button`, `.button:hover`, `.command-topbar`, `.scenario-chip.active`, `.command-stepper button.active`, and `.document-editor.editor-focus-cue` declarations so canonical border, background, active rail, no-shadow, and no-transform behavior wins without `!important`.
- Removed `--tracking-table-header` and every positive raw `0.04em` from `app/globals.css`. Table and table-header roles use zero tracking; only HUD roles use `0.08em`.
- Removed decorative gradients, surface shadows, glows, and text shadows. The static audit permits only documented functional inset active/focus rails and the documented hazard-stripe gradient.
- Added selector-aware CSS rule parsing for body, controls, heading tiers, canonical controls, active state, and editor focus cue. Added adversarial CSS fixtures that prove semantic-role and visual-effect violations fail the audit.
- Expanded reduced-motion handling to set `scroll-behavior: auto` and disable `apiPulse`, `pulseOrb`, `spin`, `progressGlide`, `agentConsolePulse`, and `sc-blink-keyframes` consumers.
- Updated the design spec, implementation plan, typed contract, static audit, and progress record consistently. F2 remains `passes: false` pending reviewer approval.

## TDD evidence

### RED 1 — selector/cascade/reduced-motion/audit false positives

Command:

```powershell
npm.cmd test -- tests/frontend-design-contract.test.ts
```

Output:

```text
Test Files  1 failed (1)
Tests       4 failed | 4 passed (8)

FAIL applies the canonical product type and interaction foundation
  expected h1 declarations; received {}
FAIL keeps canonical controls and active states effective without important declarations
  expected hazard button; received border: 0 and background: var(--ink)
FAIL disables every infinite animation and smooth scrolling for reduced motion
  expected html scroll-behavior: auto; received {}
FAIL rejects decorative effects and semantic role mismatches in selector-aware audit fixtures
  expected non-zero audit exit; received 0
```

Exit code: `1` (expected RED).

### RED 2 — raw tracking value

Command:

```powershell
npm.cmd test -- tests/frontend-design-contract.test.ts
```

Output:

```text
Test Files  1 failed (1)
Tests       1 failed | 7 passed (8)
FAIL declares every semantic CSS token
  expected app/globals.css not to contain 0.04em
```

Exit code: `1` (expected RED).

## Final GREEN verification

Commands were run sequentially in the requested order.

### Focused contract test

```text
> vitest run tests/frontend-design-contract.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
Duration    2.04s
Exit code   0
```

### Static consistency audit

```text
status: pass
pageFiles: 32
componentFiles: 22
cssLines: 12005
importantDeclarations: 0
coverageIssues: 0
violationCount: 0
Exit code: 0
```

Artifact: `evaluation/frontend-consistency-audit-2026-07-11/static-audit.json`

### Typecheck

```text
> tsc --noEmit --incremental false
Exit code: 0
```

### Production build

```text
> next build
Compiled successfully in 24.8s
Linting and checking validity of types ...
Generating static pages (27/27)
Collecting build traces ...
Exit code: 0
```

## Files

- `app/globals.css`
- `docs/superpowers/plans/2026-07-11-frontend-consistency-audit.md`
- `docs/superpowers/specs/2026-07-11-frontend-consistency-audit-design.md`
- `lib/frontend-design-contract.ts`
- `scripts/frontend_consistency_audit.mjs`
- `tests/frontend-design-contract.test.ts`
- `tasks/ralph/frontend-consistency/progress.txt`
- `evaluation/frontend-consistency-audit-2026-07-11/static-audit.json`
- `.superpowers/sdd/task-2-report.md`

## Concerns

- The selector-aware audit is intentionally a lightweight repository CSS parser, not a general standards-complete CSS parser. Named canonical selectors and adversarial fixtures are covered, while future use of deeply nested at-rules or complex selector-list functions may require upgrading the parser.
- This task verifies source contracts, static audit, TypeScript, and production compilation. Browser screenshot review remains part of the later route/browser audit tasks.

## Re-review remediation — 2026-07-11

### Additional resolutions

- Removed the trailing `4px` declarations that overrode true-circle geometry on `.safeclaw-prototype-topbar i`, `.recent-list button i`, `.status-orb`, and `.button-spinner`.
- Mapped the cited document/module selectors to complete semantic roles. Page headings now use page-title size/leading/tracking together, section headings use section-title values together, component headings use component-title values together, product body roles use body values, and report-table cells use the table tier.
- Covered the more-specific `module-variant-document` heading selectors so their actual cascade no longer restores display-tier values.
- Replaced substring effect allowlisting with a parenthesis-aware top-level selector-list splitter, normalized exact selectors, and exact documented property/value contracts. The contract now rejects altered width, direction, color, gradient kind, or selector near-matches.
- Normalized selected-document rails from `3px` to the documented `4px` active rail.

### RED evidence

Command:

```powershell
npm.cmd test -- tests/frontend-design-contract.test.ts
```

Output:

```text
Test Files  1 failed (1)
Tests       3 failed | 8 passed (11)

FAIL preserves true-circle geometry on every named circular role
  .safeclaw-prototype-topbar i expected var(--radius-circle), received 4px
FAIL maps scoped module and document selectors to complete semantic type roles
  document h1 expected page-title tracking/leading, received display tracking/leading
FAIL rejects malformed values on exact functional-effect selectors
  malformed quick-chip inset shadow and hazard radial gradient produced no effect violations
```

Exit code: `1` (expected RED).

An additional RED run exposed the later responsive duplicate:

```text
Tests       1 failed | 10 passed (11)
FAIL .safeclaw-module-hero.document h1
  expected var(--leading-page-title), received var(--leading-display)
```

### Final GREEN evidence

Commands were run sequentially in the requested order.

```text
npm.cmd test -- tests/frontend-design-contract.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
Duration    2.27s
Exit code   0

npm.cmd run audit:frontend-consistency
status                  pass
pageFiles               32
componentFiles          22
cssLines                12033
importantDeclarations   0
coverageIssues          0
violationCount          0
Exit code               0

npm.cmd run typecheck
tsc --noEmit --incremental false
Exit code 0

npm.cmd run build
Compiled successfully in 15.0s
Generated static pages 27/27
Exit code 0
```

### Updated concern

- The audit remains intentionally repository-focused and does not calculate arbitrary browser specificity. Its supported grammar now handles top-level selector lists with nested functional pseudo-classes, and every currently cited base/scoped selector plus exact functional effect is explicitly contracted. New complex selector families still require a new RED fixture and explicit contract entry.
- Browser screenshot review remains assigned to the later route/browser audit tasks. F2 remains `passes: false` until independent reviewer approval.
