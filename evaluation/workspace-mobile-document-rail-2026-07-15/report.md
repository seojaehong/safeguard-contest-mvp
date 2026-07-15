# Workspace Mobile Document Rail Remediation

## Live Finding

- Route: `/workspace`, mobile `390x844`, Night, document step.
- The core document rail measured `clientWidth=296`, `scrollWidth=498`, `overflow-x:auto`.
- The native horizontal scrollbar remained visible and the third core document required horizontal scrolling.

## Product Decision

- Mobile uses a single-column document selector.
- All three core documents are visible without horizontal scrolling.
- Existing selected-state styling is preserved.
- Each document button keeps the canonical control minimum height.
- Desktop document rail geometry is unchanged.

## Verification

- TDD RED reproduced the missing mobile row-flow contract.
- Focused contract test: 16/16 passed.
- Static audit: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Strict TypeScript: passed.
- Live browser confirmation is required after deployment.
