# Workspace Share Desktop Width — 2026-07-20

## Verdict

**Improved.** The share step no longer remains capped at the previous 980px step surface on desktop.

## Geometry

- Viewport: 1440x723
- Panel width: 980px -> 1068px
- Form width: 598px -> 646px
- Preview width: 340px -> 380px
- Body height: 1039px
- Horizontal overflow: false

## Verification

- `npm.cmd test -- tests\workspace-layout-regression.test.ts --maxWorkers=1 --fileParallelism=false --testNamePattern "resumes the canonical browser workpack|does not pin"`: 1 file / 2 tests PASS
- `npm.cmd run build`: PASS, 28/28 static pages
