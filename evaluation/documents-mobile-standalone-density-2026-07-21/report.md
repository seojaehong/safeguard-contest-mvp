# Documents Mobile Standalone Density Gate

- Checked at: 2026-07-21T02:11:03+09:00
- Source HEAD before commit: 58831542f44f3d027ea6d4f4d2e09245636db770
- Branch: chore/recipient-foreign-live-gate-20260720
- Scope: route-scoped `/documents` mobile density and context preservation.

## Verdict

PASS for the bounded current-source gate.

This patch keeps the standalone `/documents` screen from solving length by hiding context. The current-work strip remains visible in the mobile cockpit, the core document launcher still appears before the editor, and the desktop short-height `/documents` cockpit gate remains inside the viewport after restoring that context strip.

This does not claim a full route-split IA redesign. The product answer remains: route/page split alone is insufficient; each step needs a viewport-first cockpit, and long document bodies, evidence ledgers, and detailed editors must live in drilldown/detail surfaces.

## Baseline Production Debt

Previous production evidence at the desktop/share IA wave showed standalone `/documents` mobile was still long:

- Production product marker: be7f45cdf06f5a807b4fc024edf1210da334a46b
- Mobile viewport: 390x844
- `/documents` body height: 1816px, 2.15x viewport
- Workpack top: 545px
- Editor top: 671px
- Textarea top: 1005px
- Horizontal overflow: false
- Outside viewport elements: 0

The desktop `/documents` and desktop share blocker were already bounded by prior production evidence; this gate addresses the remaining mobile density concern without changing WorkpackEditor data, export, or provider contracts.

## Current Patch Contract

- Preserve a compact current-work identity strip on mobile `/documents`.
- Keep visible cockpit text that identifies the surface as "오늘 문서" and "핵심 3종".
- Hide only secondary route chrome on mobile `/documents`, such as the route-specific toolbar and duplicate mobile heading.
- Keep live/sample current-work counters visible enough for existing display-count tests.
- Preserve the desktop short-height bounded `/documents` workpack shell.
- Do not modify WorkpackEditor structured editing, export rendering, document data, Supabase, provider dispatch, or evidence harness contracts.

## Current-Source Mobile Geometry

Measured against a local current-source Next dev server at `http://127.0.0.1:3457/documents?theme=day` after the patch. This is not production evidence until the commit is deployed.

- Viewport: 390x844
- Body height: 1634px, 1.94x viewport
- Workpack shell top: 476px
- Document editor top: 602px
- Document textarea top: 823px
- Current-work strip: visible, top 207px, bottom 297px
- Current-work strip text: "기본 예시 표시... 실제 저장·전파는 작업 입력 후 진행합니다."
- Cockpit text contains: "오늘 문서", "핵심 3종"
- Mobile core launcher top/bottom: 305px / 468px
- Horizontal overflow: false
- Outside viewport elements: 0

Compared with the prior production baseline, the standalone mobile route still remains a long working page, but the first context and action surfaces are closer:

- Body height: 1816px -> 1634px
- Editor top: 671px -> 602px
- Textarea top: 1005px -> 823px
- Current-work/provenance context: preserved, not hidden

## Verification

Commands run:

```powershell
npm.cmd test -- tests\documents-editor-layout.test.ts -t "bounds the default documents route editor|counts only non-empty|keeps sample display|puts the core launcher before the mobile editor" --maxWorkers=1 --fileParallelism=false
npm.cmd test -- tests\documents-editor-layout.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
git diff --check -- app\globals.css tests\documents-editor-layout.test.ts
```

Results:

- Focused regression slice: PASS, 1 file / 5 tests selected, 26 skipped.
- Full documents editor layout suite: PASS, 1 file / 31 tests.
- Strict TypeScript typecheck: PASS.
- Diff whitespace check: PASS, line-ending warnings only.

## Product Interpretation

The user's structural concern is valid: splitting `/input`, `/documents`, and `/share` alone does not fix long pages if each route defaults to all documents, all evidence, all channels, and all preview text. The working model is:

- Step split for orientation: Input -> Documents -> Share.
- Viewport-first cockpit for decisions: status, core documents, risk assessment entry, next action.
- Drilldown/detail for long content: full editor, 12-document library, evidence ledger, transmission history, and language/channel details.

This bounded patch keeps that direction while closing the immediate mobile `/documents` context-preservation regression in the current source.
