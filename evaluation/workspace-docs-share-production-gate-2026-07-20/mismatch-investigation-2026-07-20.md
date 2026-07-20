# Workspace Documents/Share Mismatch Investigation

Checked at: 2026-07-20 KST

## Verdict

**PARTIALLY FIXED.**

The default `입력 -> 문서 -> 공유` route flow and desktop share layout are fixed on current production. The remaining issue is the document edit surface: the first textarea is visible in the first viewport, but the editor panel still has excessive internal depth.

## Current Authoritative Surface

- Source HEAD: `778f4601b359adc7ea716ee84eebdaa58f026115`
- Served URL: `https://www.safeclaw.kr/workspace`
- Served commit: `778f4601b359adc7ea716ee84eebdaa58f026115`
- Served branch: `master`
- Deployment URL: `safeguard-contest-iig0xw90t-seojaehongs-projects.vercel.app`
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
| Document edit | 1440x900 | 1.65x | textarea y=350, editor panel 2561px, sticky 1 | Partial |
| Share | 1440x900 | 1.30x | share width 1180px, one primary CTA, no overflow | Fixed |
| Documents review | 390x844 | 1.68x | document y=262, no overflow, sticky 0 | Fixed |
| Document edit | 390x844 | 1.36x | textarea y=407, editor panel 2696px, sticky 0 | Partial |
| Share | 390x844 | 1.76x | share width 336px, one primary CTA, no overflow | Fixed |

## Why The User Still Saw A Problem

The previous "done" signal was too broad. It closed the original default document review and desktop share layout blocker, but it did not fully close the edit-mode information-density problem.

If the user saw a narrow share card on desktop, that was likely stale/non-authoritative surface: old local dev server, old branch, cached deployment, wrong URL, or pre-`778f4601` build. Current production renders an 1180px share surface at 1440px.

If the user clicked `편집` and judged the long edit screen, that is a real remaining issue. The current production editor still carries a long internal panel below the first editable area.

Static typography/design-contract passes should not be used as evidence for this workflow-level UX. The gate must explicitly measure generated-state readiness, stage separation, document height, edit entry y-position, sticky overlap, and desktop share width.

## Bounded Remediation Path

Keep the now-fixed default review/share surfaces. Remediate only document edit mode:

- Keep one visible stage at a time.
- Keep desktop textarea y <= 350 and mobile textarea y <= 420.
- Reduce editor internal panel height materially from 2561px desktop and 2696px mobile.
- Move provenance/export/supporting content behind collapsed controls without deleting data contracts.
- Re-run `run-current-geometry-probe.mjs` against production and require fixed default review/share metrics to remain stable.

Raw evidence:

- `evaluation/workspace-docs-share-production-gate-2026-07-20/current-geometry.json`
- `evaluation/workspace-docs-share-production-gate-2026-07-20/mismatch-investigation-2026-07-20.json`

Verification:

- `node evaluation\workspace-docs-share-production-gate-2026-07-20\run-current-geometry-probe.mjs` — PASS, served commit `778f4601b359adc7ea716ee84eebdaa58f026115`, generated-state wait included.
- JSON parse for `current-geometry.json` and `mismatch-investigation-2026-07-20.json` — PASS.
- `npm.cmd test -- tests\workspace-layout-regression.test.ts tests\workspace-share-mobile-browser.test.ts --maxWorkers=1 --fileParallelism=false` — 2 files / 28 tests PASS, 1 skipped. Duration 201.93s.
- `git diff --check` — PASS, line-ending warnings only.
