# Workspace composer touch-target remediation

## Scope

- Base: `5249be5e6c36c15d1f3359aab8e0f65868574e8c`
- Product surface: `/workspace` input composer
- Schema or data mutation: none
- Visual direction: unchanged

## Finding

The attachment action used a 36px minimum height and the generate action used
38px. An ultra-short viewport override reduced both actions to 32px. Those
values conflicted with the existing `--control-height: 44px` interaction token.

## Remediation

All declarations that own `.composer-attach-button` or
`.composer-submit-button` minimum height now use `var(--control-height)`. Padding,
color, type, and layout ownership remain unchanged.

## Verification

- RED: `tests/workspace-input-css-contract.test.ts` rejected the 36px base rule.
- GREEN: `npm.cmd test -- tests/workspace-input-css-contract.test.ts tests/workspace-layout-regression.test.ts`
  - 2 files passed
  - 28 tests passed
  - 1 conditional test skipped
- `npm.cmd run typecheck`: passed after lock-respecting dependency sync.
- `package.json` and `package-lock.json`: no diff after `npm.cmd install`.
- `git diff --check`: passed.

