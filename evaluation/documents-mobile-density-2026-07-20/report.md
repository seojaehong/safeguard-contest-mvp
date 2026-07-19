# Documents Mobile Density Check - 2026-07-20

## Verdict

PASS for bounded mobile density remediation.

This patch does not claim the entire `/documents` product surface is fully redesigned. It specifically reduces the stacked mobile pre-editor chrome so the editor starts much earlier while preserving the existing document selection and export contracts.

## Baseline

Production baseline at `4d9548543b9e052455b00252ab2264d8ff430253`:

- `/documents` mobile page height: 2806px
- `.safeclaw-current-workpack`: y=331px, h=142px
- `.safeclaw-document-cockpit`: y=489px, h=304px
- `.workpack-shell`: y=825px
- Horizontal overflow: 0 outside elements

## After Patch

Local patched branch `fix/documents-mobile-density-20260720`:

- `/documents` mobile page height: 2529px
- `.safeclaw-page-decision-header`: h=71px
- `.safeclaw-current-workpack`: y=211px, h=88px
- `.safeclaw-document-cockpit`: y=311px, h=222px
- `.workpack-shell`: y=549px
- Horizontal overflow: 0 outside elements

## UX Change

- `/documents` mobile hides the long hero description and status action row.
- The current/sample workpack banner becomes a compact single-column notice.
- The 3 primary document buttons become a one-row segmented chooser.
- The workpack editor starts 276px earlier than production baseline.

## Verification

- `npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false`
  - 1 file / 30 tests PASS
- `npm.cmd run typecheck`
  - PASS
- `npm.cmd run build`
  - PASS, 28/28 static pages
- `git diff --check`
  - PASS, line-ending warning only

## Evidence

- Raw metrics: `evaluation/documents-mobile-density-2026-07-20/report.json`
- Screenshot: `evaluation/documents-mobile-density-2026-07-20/documents-mobile-local.png`
