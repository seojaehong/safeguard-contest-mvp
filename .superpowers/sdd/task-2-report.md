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

## Fourth remediation — repository-wide typography tuples

### Scope and implementation

- Replaced curated typography-only proof with a repository-wide rule invariant: every parsed `font-size` declaration must map to one complete canonical size/weight/leading/tracking tuple.
- Normalized 428 current `app/globals.css` font-size rules, including media-query and scoped duplicates. Raw/legacy font-size aliases were replaced by semantic tokens.
- Enforced the exact role tuples requested for display, page title, section title, component title, body large, body, support, control, table, caption, table header, and HUD.
- Classified 14px interactive selectors as controls and other 14px selectors as support. Table headers are caption-sized with `700 / 18px / 0`.
- Kept 11px only for HUD semantics and required `var(--font-hud)`; non-HUD 11px rules were promoted to caption. The final distribution includes 28 HUD rules and 144 caption rules.
- Updated the test helper to use the same parenthesis-aware top-level selector-list splitting and normalization behavior as the production audit.
- Preserved prior no-`!important`, exact functional-effect, true-circle, and reduced-motion gates.

### RED evidence

Initial focused test:

```text
npm.cmd test -- tests/frontend-design-contract.test.ts
Test Files  1 failed (1)
Tests       2 failed | 11 passed (13)

FAIL assigns a complete canonical typography tuple to every font-size rule
  first mismatch: .hud-label used raw 16px leading instead of var(--leading-hud)
FAIL rejects incomplete or mismatched typography tuples in audit fixtures
  audit did not emit typography-tuple
Exit code 1
```

Initial repository audit after adding the tuple gate:

```text
npm.cmd run audit:frontend-consistency
status          fail
violationCount  427
all 427 violations were typography-tuple
Exit code       1
```

Semantic precedence fixture:

```text
Tests  1 failed | 13 passed (14)
FAIL classifies interactive 14px and table-header rules by semantics before their current token
  .toolbar-button and .report-table strong were not rejected by the old token-first classifier
```

Raw duplicate guard:

```text
Tests  1 failed | 13 passed (14)
FAIL assigns a complete canonical typography tuple to every font-size rule
  two compact rules retained earlier raw 11px/17px declarations before canonical declarations
```

An intermediate typecheck also caught a test-only HUD union-narrowing error. The HUD assertion now references the explicit HUD tuple and the complete sequence was rerun from the beginning.

### Final GREEN evidence

Commands were run sequentially after the last source change.

```text
npm.cmd test -- tests/frontend-design-contract.test.ts
Test Files  1 passed (1)
Tests       14 passed (14)
Duration    3.86s
Exit code   0

npm.cmd run audit:frontend-consistency
status                  pass
pageFiles               32
componentFiles          22
cssLines                12793
importantDeclarations   0
coverageIssues          0
violationCount          0
Exit code               0

npm.cmd run typecheck
tsc --noEmit --incremental false
Exit code 0

npm.cmd run build
Compiled successfully in 15.1s
Generated static pages 27/27
Exit code 0
```

### Concern update

- The 11px HUD-versus-caption semantic decision is repository-focused and keyword-assisted: existing HUD family/tracking or selectors containing HUD/status/eyebrow/kicker/badge/meta/metric/code/console/source/live/signal semantics remain HUD; other 11px rules are promoted to caption. No rule was made HUD solely because it was 11px. Future selectors with new semantic vocabulary need a RED fixture or an explicit semantic token.
- The parser still intentionally targets the repository's flat declaration grammar rather than general CSS. Parenthesis-aware top-level selector splitting now matches between tests and audit.
- Browser screenshot review remains part of later tasks. F2 stays `passes: false` pending independent review.

## Fifth remediation — per-selector semantic classification

### Resolutions

- Added a small semantic override manifest for ambiguous class-only interactive selectors, including `.command-center-shell .command-primary` and `.safeclaw-module-primary`.
- Changed test and audit tuple classification from one inferred role per selector list to one role per normalized selector. A grouped rule that resolves to multiple semantic roles now emits `mixed-typography-role` and must be split.
- Mapped `.command-center-shell .command-primary` to the control tuple (`--text-control / 700 / --leading-control / --tracking-body`).
- Split `.safety-form-preview th, td`: native headers use the table-header tuple, while data cells retain the caption tuple.
- Split the command-center brand descriptor from status/step labels. The brand descriptor uses product caption typography; status and step labels retain the HUD tuple and HUD family.
- The stronger invariant exposed two additional current mixed rules. Report-table headers were split from ordinary caption labels, and `.safeclaw-module-primary` was added to the explicit control manifest.

### RED evidence

```text
npm.cmd test -- tests/frontend-design-contract.test.ts
Test Files  1 failed (1)
Tests       3 failed | 13 passed (16)

FAIL assigns control, native table, and mixed HUD selectors to their actual roles
  command-primary received support tuple instead of control
FAIL assigns a complete canonical typography tuple to every font-size rule
  safety-form-preview th/td inferred mixed tableHeader/caption roles
FAIL rejects ambiguous class controls and mixed selector-list roles
  audit did not report the three current false-pass patterns
Exit code 1
```

After the three cited fixes, the repository-wide gate found two more mixed lists:

```text
mixed-typography-role 2
- document report-table strong grouped with ordinary caption labels
- safeclaw-module-primary grouped with controls but inferred as support
```

### Final GREEN evidence

Commands ran sequentially after the final source change.

```text
npm.cmd test -- tests/frontend-design-contract.test.ts
Test Files  1 passed (1)
Tests       16 passed (16)
Duration    4.13s
Exit code   0

npm.cmd run audit:frontend-consistency
status                  pass
pageFiles               32
componentFiles          22
cssLines                12815
importantDeclarations   0
coverageIssues          0
violationCount          0
Exit code               0

npm.cmd run typecheck
tsc --noEmit --incremental false
Exit code 0

npm.cmd run build
Compiled successfully in 11.7s
Generated static pages 27/27
Exit code 0
```

### Concern update

- The explicit semantic manifest is intentionally small and only covers ambiguous class-only selectors that source/DOM evidence identifies as controls or special text roles. New ambiguous class names must be added with a RED fixture.
- The lightweight parser and keyword fallback remain repository-focused. Mixed selector lists can no longer borrow semantics from one another, which narrows the remaining heuristic risk.
- Browser screenshot review remains in later tasks. F2 remains `passes: false` pending independent review.
