# Workspace Documents/Share Mismatch Investigation

Checked at: 2026-07-20 KST

## Verdict

**PARTIALLY FIXED, WITH THE BOUNDED EDIT-MODE REMEDIATION SHIPPED.**

The default `입력 -> 문서 -> 공유` route flow and desktop share layout are fixed on current production. The document edit surface has also been compacted: normal sections are collapsed by default, risk rows no longer auto-open the first row, and the production editor panel height is materially lower.

## Current Authoritative Surface

- Source HEAD: `96d16238ae71896aa608d93ee9db25d455bd6894`
- Served URL: `https://www.safeclaw.kr/workspace`
- Served commit: `96d16238ae71896aa608d93ee9db25d455bd6894`
- Served branch: `master`
- Deployment URL: `safeguard-contest-8bkp35kfa-seojaehongs-projects.vercel.app`
- Probe guard: waits for `12/12 생성` or `안전 문서팩 3종 준비 완료` before measuring documents.

## What Was Implemented

These bounded UX commits are integrated into current HEAD:

- `54af1d7d` `fix: tighten workspace document and share stages`
- `652ba44c` `fix: widen workspace share desktop surface`
- `98ddcddd` `fix: widen workspace share desktop layout`
- `4a6e35fb` `fix: compact documents mobile editor entry`
- `a2535d21` `chore: tighten workspace doc share gate`

The older `ddda375d` geometry commit is not an ancestor of the current branch, but the current served geometry reflects the later integrated fixes above.

## Current Measurements

| Surface | Viewport | Height ratio | Key geometry | Status |
| --- | --- | ---: | --- | --- |
| Documents review | 1440x900 | 1.27x | page 1147px, document y=229, no overflow, sticky 0 | Fixed |
| Document edit | 1440x900 | 2.46x | textarea y=374, editor panel 1433px, sticky 0 | Improved |
| Share | 1440x900 | 1.30x | share width 1180px, one primary CTA, no overflow | Fixed |
| Documents review | 390x844 | 1.68x | document y=262, no overflow, sticky 0 | Fixed |
| Document edit | 390x844 | 2.35x | textarea y=361, editor panel 1359px, sticky 0 | Improved |
| Share | 390x844 | 1.76x | share width 336px, one primary CTA, no overflow | Fixed |

## Why The User Still Saw A Problem

The previous "done" signal was too broad. It closed the original default document review and desktop share layout blocker, then later closed the stacked-sticky edit rail. It did not fully close the edit-mode information-density problem, because the editor remains a long page by nature of the current textarea/provenance/export model.

If the user saw a narrow share card on desktop, that was likely stale/non-authoritative surface: old local dev server, old branch, cached deployment, wrong URL, or a build before the integrated share-width fixes. Current production renders an 1180px share surface at 1440px.

If the user clicked `편집` before `689a597d`, that was a real remaining issue. Current production now shows a compacted edit surface with sticky count 0, though it is still a full editing page rather than a tiny modal/card.

Static typography/design-contract passes should not be used as evidence for this workflow-level UX. The gate must explicitly measure generated-state readiness, stage separation, document height, edit entry y-position, sticky overlap, and desktop share width.

## Bounded Remediation Path

Keep the now-fixed default review/share/edit surfaces. Move the next work to document-specific field editors:

- Keep one visible stage at a time.
- Keep mobile first textarea near the top of the first viewport.
- Keep collapsed sections and provenance/export drawers by default.
- Add document-specific field editors for TBM, permit, education, and foreign-worker documents without deleting data contracts.
- Re-run `run-current-geometry-probe.mjs` against production and require fixed default review/share metrics to remain stable.

Raw evidence:

- `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/mismatch-investigation-2026-07-20.json`

Verification:

- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` — PASS, served commit `96d16238ae71896aa608d93ee9db25d455bd6894`, generated-state wait included.
- JSON parse for `current-geometry.json` and `mismatch-investigation-2026-07-20.json` — PASS.
- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` — 2 files / 28 tests PASS, 1 skipped. Duration 201.93s.
- `git diff --check` — PASS, line-ending warnings only.
