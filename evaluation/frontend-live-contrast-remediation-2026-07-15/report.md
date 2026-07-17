# SafeClaw Live Contrast Remediation

## Scope

- Baseline: production `https://www.safeclaw.kr` and authoritative master `238a011b3d0d436b5d498c415795cede61b3045e`
- Product behavior, layout, spacing, routing, and data contracts are unchanged.
- The patch is limited to readable foreground tokens on yellow actions, yellow labels on light surfaces, and muted workspace disclosure actions.

## Confirmed Live Failures

- White on `#f5c518`: `1.63:1` on module primary actions.
- `#ffd400` on white: `1.43:1` on landing pipeline labels.
- `#ffdc2e` on white: `1.35:1` on current-workpack actions.
- `#a4aab4` on `#fafafb`: `2.24:1` on collapsed workspace actions.

## Remediation Contract

- Yellow-filled module actions inherit `--workspace-ink` instead of white.
- Current-workpack links on light module surfaces use `--workspace-accent-text`.
- Landing pipeline labels use `--sc-hazard-text` while yellow remains available for fills and borders.
- Collapsed advanced/example actions use `--workspace-muted`.

Calculated replacement ratios:

- `#665100` on white: `7.66:1`.
- `#17191d` on `#f5c518`: `10.80:1`.
- `#5c6169` on `#fafafb`: `5.98:1`.

## Verification

- TDD RED: `tests/frontend-shared-surfaces.test.ts` failed on the original yellow landing label.
- TDD GREEN: `tests/frontend-shared-surfaces.test.ts` — 15/15 passed.
- Strict TypeScript: passed.
- Static frontend audit: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Browser regression: 3 files, 48 tests passed, 1 unrelated flow assertion failed, 1 skipped. The failure expected `.editor-focus-message` after edit entry and did not concern the changed color selectors.
- `product-module-shell` and `documents-editor-layout` completed without failures.
- Production build: passed, 28 pages.

## Follow-up Findings Kept Separate

- `/workspace` mobile document selector requires a non-scrolling presentation rather than a hidden native scrollbar.
- `/knowledge` needs Korean presentation labels and 44px evidence disclosure targets.
- `/knowledge` information architecture remains a separate progressive-disclosure workstream.
