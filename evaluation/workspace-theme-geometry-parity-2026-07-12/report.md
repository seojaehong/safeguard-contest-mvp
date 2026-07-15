# SafeClaw Workspace Theme Geometry Parity

## Scope

- Base: `f5cac0feedeb188c86b4e7b2aaa52f3ab79ca5b6`
- Tested product SHA: `c017ac6e675b777b40b91fc78a1a9722dbf67d88`
- Branch: `fix/workspace-theme-geometry-parity`
- Product rule: Day and Night use the same Night/Linear geometry. Theme-specific CSS may change paint and focus treatment, not layout geometry.
- Database, API, harness, ontology, and generated-document contracts were not changed.

## Root Cause

The Night workspace inherited the shared `.command-center-shell` geometry while Day used higher-specificity `.workspace-theme-day` rules for padding, radii, widths, grid gaps, and typography. The corrected browser audit therefore found six failed rows across desktop, tablet, and mobile even though both themes rendered successfully.

## TDD Evidence

### RED

`tests/workspace-layout-regression.test.ts` compared computed geometry for the topbar, theme toggle, workspace grid, navigation, input surface, composer, chips, evidence rail, and collapsed settings. The first run failed at desktop with different radii, column geometry, content widths, and input padding.

### GREEN

The final geometry owner now applies the same structural declarations to both themes and preserves the existing palette/focus rules. The browser contract compares computed text, borders, padding, radius, typography, and placement for the topbar, navigation, composer, five field chips, five evidence cards, primary action, and opened advanced/example panels. It passes at:

- 1440x900 desktop
- 1024x900 tablet
- 390x844 mobile
- 1440x500 short desktop
- 1024x600 short tablet
- 1440x320 compact presentation viewport

The same test also verifies that the shell and primary action colors remain different between Day and Night.

## Independent Review Remediation

The first independent review rejected `f060a57` because the test did not inspect field-chip children or opened details surfaces and the static audit still identified the base SHA. Product commit `c017ac6` closes those gaps:

- Field chips, primary action, opened advanced settings, AI options, opened examples, quick actions, text, border widths, font weight, and minimum width are now part of the runtime fingerprint.
- Night baseline values are asserted directly, including the 4px topbar/toggle/input geometry, 44px normal toggle minimum width, 46px compact minimum width, 16px desktop column gap, zero mobile gap, 8px primary-action radius, and 4px opened-panel radius.
- Weather is a deterministic intercepted fixture and the test waits for the completed weather state before measuring.
- The static audit was regenerated from product SHA `c017ac6e675b777b40b91fc78a1a9722dbf67d88`.

## Verification

- Theme geometry browser contract: 1/1 passed; 21 unrelated tests skipped by name filter.
- Responsive production textarea matrix: 1/1 passed across 14 Day/Night viewport conditions.
- Workspace input, workbench visual, and frontend design contracts: 3 files, 34/34 tests passed.
- Strict TypeScript check: passed.
- Production build: 27/27 static pages generated.
- Static frontend audit at product SHA `c017ac6`: 32 pages, 23 product components, 0 coverage issues, 0 violations, 0 important declarations.
- `git diff --check`: passed.

## Integration Gate

This branch intentionally does not claim the canonical 108-row browser audit. After independent review and selective integration into the authoritative release branch, the audit build and all 108 rows must be regenerated at the integrated SHA. Required final result: distinct Day/Night screenshot pixels, identical workspace geometry fingerprints, zero failed rows, and zero findings.
