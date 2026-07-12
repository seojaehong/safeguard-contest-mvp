# SafeClaw Workspace Theme Geometry Parity

## Scope

- Base: `f5cac0feedeb188c86b4e7b2aaa52f3ab79ca5b6`
- Branch: `fix/workspace-theme-geometry-parity`
- Product rule: Day and Night use the same Night/Linear geometry. Theme-specific CSS may change paint and focus treatment, not layout geometry.
- Database, API, harness, ontology, and generated-document contracts were not changed.

## Root Cause

The Night workspace inherited the shared `.command-center-shell` geometry while Day used higher-specificity `.workspace-theme-day` rules for padding, radii, widths, grid gaps, and typography. The corrected browser audit therefore found six failed rows across desktop, tablet, and mobile even though both themes rendered successfully.

## TDD Evidence

### RED

`tests/workspace-layout-regression.test.ts` compared computed geometry for the topbar, theme toggle, workspace grid, navigation, input surface, composer, chips, evidence rail, and collapsed settings. The first run failed at desktop with different radii, column geometry, content widths, and input padding.

### GREEN

The final geometry owner now applies the same structural declarations to both themes and preserves the existing palette/focus rules. The browser contract passes at:

- 1440x900 desktop
- 1024x900 tablet
- 390x844 mobile
- 1440x500 short desktop
- 1024x600 short tablet
- 1440x320 compact presentation viewport

The same test also verifies that the shell and primary action colors remain different between Day and Night.

## Verification

- Theme geometry browser contract: 1/1 passed; 21 unrelated tests skipped by name filter.
- Responsive production textarea matrix: 1/1 passed across 14 Day/Night viewport conditions.
- Workspace input, workbench visual, and frontend design contracts: 3 files, 34/34 tests passed.
- Strict TypeScript check: passed.
- Production build: 27/27 static pages generated.
- Static frontend audit: 32 pages, 23 product components, 0 coverage issues, 0 violations, 0 important declarations.
- `git diff --check`: passed.

## Integration Gate

This branch intentionally does not claim the canonical 108-row browser audit. After independent review and selective integration into the authoritative release branch, the audit build and all 108 rows must be regenerated at the integrated SHA. Required final result: distinct Day/Night screenshot pixels, identical workspace geometry fingerprints, zero failed rows, and zero findings.
