# Workspace Input Height Parity Check (2026-07-18)

## Scope

- Route: `/workspace`
- Patch owner: empty input workspace surface alignment
- Product files changed: `app/globals.css`
- No data, DB schema, or API behavior changes.

## User-Facing Findings Checked

1. Empty input did not retain a sample/default job string.
2. The desktop side navigation and right input surface had mismatched bottom edges.

## Local Browser Measurement

Command source: Playwright against local dev server `http://127.0.0.1:3025/workspace` after clearing `localStorage` and `sessionStorage`.

| Viewport | Horizontal overflow | Textarea value | Default job phrase | Side bottom | Input bottom | Main bottom | Side/Input delta |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1440x900 | false | empty | false | 925.05 | 925.05 | 925.05 | 0 |
| 390x844 | false | empty | false | 268.05 | 922.84 | 922.84 | stacked mobile |

Notes:
- The visible Korean text match in prior production probing came from the `예시 불러오기` control, not a retained textarea value.
- Desktop now gives the input page the same bottom edge as `.workspace-side-nav` and `.command-main`.
- Mobile remains intentionally stacked: the side rail sits above the input page, while input and main stay aligned with no horizontal overflow.

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\module-shell-design-regression.test.ts --maxWorkers=1 --fileParallelism=false`
  - Result: 2 files passed, 30 tests passed, 1 skipped
  - Duration: 217.02s
- `npm.cmd run typecheck`
  - Result: PASS

## Release Notes

This is a bounded visual fix for the recording/demo surface. It does not change share sessions, worker delivery, document generation, KOSHA trust registry, or ontology behavior.
