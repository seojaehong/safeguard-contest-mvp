# SafeClaw North Star Continuation Ledger

Generated: 2026-07-20 KST

## Verdict

North-star mode remains active. Current master has made launch-surface progress and preserves the long-term Hermes / LLM Wiki direction as guarded, approval-gated architecture rather than claiming it as completed production autonomy.

## Current Head

- Latest pushed commit at ledger refresh: `a807c6d4`
- Production marker observed during this turn:
  - `acb94db188b46fb8d1e057fe13ef713950963277` after the workspace compact patch deployed.
  - `c9ed4d8947b0c9fcad0801d7123e7ad6f7764f06` after the live share-readiness smoke deployed.
  - `00d854f3` export-dispatch evidence commit had been pushed; production deployment may lag until Vercel finishes.
  - `daec3aa5d9ce25f150605c6ba686ab8feee1f76c` after the current live workspace UX check deployed. Later `a807c6d4` is evidence-only and does not change product UI.

## Closed Gates This Turn

| Gate | Commit / artifact | Evidence |
| --- | --- | --- |
| Workspace generation review compaction | `acb94db1` | `evaluation/workspace-doc-share-local-geometry-2026-07-20-after-collapse/report.md` |
| Live workspace documents geometry | `2144b5ba` | `evaluation/workspace-doc-share-live-geometry-2026-07-20-acb94db1/report.md` |
| Current KOSHA exact/materialization gate | `089fa8b6` | `evaluation/kosha-current-gate-2026-07-20-acb94db1/report.md` |
| Live share readiness smoke | `c9ed4d89` | `evaluation/workspace-share-readiness-live-2026-07-20/report.md` |
| Export / foreign dispatch current gate | `00d854f3` | `evaluation/export-foreign-dispatch-current-gate-2026-07-20/report.md` |
| Current live workspace documents/share check | `daec3aa5` | `evaluation/workspace-doc-share-live-current-2026-07-20-c6b2236f/report.md` |
| Current live critical surface check | `a807c6d4` | `evaluation/live-critical-surface-current-2026-07-20/report.md` |
| Broad KOSHA guide corpus audit | current refresh | `evaluation/kosha-guide-current-audit-2026-07-20/report.md` |

## Verified Commands

- Workspace / share / module / ontology browser regression:
  - `npm.cmd test -- tests\north-star-document-ux.test.ts tests\workspace-share-mobile-browser.test.ts tests\product-module-shell.test.ts tests\ontology-ui-remediation.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS, 3 files passed / 1 skipped, 11 tests passed / 4 skipped.
- TypeScript:
  - `npm.cmd run typecheck`
  - PASS.
- Production build:
  - `npm.cmd run build`
  - PASS, 28/28 static pages.
- KOSHA / Phase-A focused gate:
  - `npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-current-review-run-ask.test.ts tests\exact-kosha-applicability-policy.test.ts tests\kosha-materialization-matrix.test.ts tests\phase-a-product-materialization.test.ts tests\claw-tools-phase-a-materialization.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS, 9 files / 169 tests.
- KOSHA acquisition parser:
  - `python -m unittest scripts.tests.test_acquire_exact_kosha_body`
  - PASS, 19 tests.
- Export / foreign dispatch gate:
  - `npm.cmd test -- tests\document-export-localization.test.ts tests\editor-export-integrity.test.ts tests\xlsx-export-route.test.ts tests\pdf-korean-font-integration.test.ts tests\pdf-font-failure.test.ts tests\foreign-worker-languages.test.ts tests\foreign-parse.test.ts tests\workflow-dispatch-capability-policy.test.ts tests\provider-dispatch-idempotency-gate.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS, 9 files / 66 tests.
- Broad KOSHA corpus audit:
  - `npm.cmd run audit:kosha-guides -- --output-dir evaluation/kosha-guide-current-audit-2026-07-20`
  - PASS as a read-only audit execution with 1,040 items, 222 non-empty parsed bodies, 15 empty-output boundaries, 0 hard parser failures, and launch readiness `false`.
- Broad KOSHA audit regression:
  - `npm.cmd test -- tests\kosha-guide-corpus-audit.test.ts --maxWorkers=1 --fileParallelism=false`
  - PASS, 1 file / 110 tests.
- Broad KOSHA parser/ingest regression:
  - `python -m unittest scripts.tests.test_snapshot_kosha_guide_corpus scripts.tests.test_ingest_safety_reference_catalog`
  - PASS, 55 tests.

## Current Product Claims That Are Safe

- SafeClaw fixes SIF/KOSHA/legal/work-history evidence before LLM wording.
- The exact KOSHA production registry includes reviewed pins for D-C-13, D-C-7, and B-E-10; broader metadata-verified KOSHA candidates are not claimed as direct exact evidence.
- The broad KOSHA guide corpus is present and reproducibly audited: local ZIP and env-configured Supabase snapshot both expose 1,040 rows with matching canonical hash, but that parity proves corpus parity only.
- Workspace generation now keeps provenance/audit data available but does not auto-expand those details into the first review surface.
- The generated Documents step on production commit `acb94db1` measured 1149px at 1440x723 and 1348px at 390x844, with sticky count 0 and no horizontal overflow.
- The current live Documents step on production marker `c6b2236f` measured 1088px at 1440x723 and 1417px at 390x844, with sticky count 0 and no horizontal overflow.
- The current live Share step measured 1068px wide on desktop and 336px wide on mobile; the old narrow desktop mobile-card blocker did not reproduce.
- In live generation, Share is intentionally locked while the workpack is still 8/12; it unlocks after 12/12 when the document body is populated.
- Export, PDF/XLSX localization, foreign-language generation/parse, and dispatch capability policies pass current focused tests.

## Claims Still Forbidden

- Hermes/OpenClaw is the production source of truth.
- LLM Wiki publishes itself or mutates ontology/DB automatically.
- SIF vector retrieval is production-active before approved migration/upload/runtime verification.
- All KOSHA metadata-verified candidates are exact production evidence.
- Broad KOSHA Guide is launch-ready for authoritative grounding. The current broad audit is explicitly NOT launch-ready because 818 rows have empty parsed bodies, 1,040 rows lack item URL/file ID/published/current-state provenance, 7 rows have official version drift, 1 local row is officially retired, and 13 retrieval/document-reflection checks failed.
- Supabase tenant isolation is launch-proven beyond the existing approval-gated read-only/audit packets.
- External provider dispatch is fully live for unapproved channels.

## Remaining North-Star Gates

1. Re-run production marker after `00d854f3` and later commits deploy.
2. Continue RLS / LLM Wiki approval-gated path only after explicit DB/migration approval.
3. Expand exact KOSHA pins through the immutable acquisition/review pipeline, not by bulk-promoting metadata candidates. For the 1,040-row broad corpus, the next zero-mutation step is official URL/file ID/published/status provenance backfill dry-run plus body/OCR recovery candidates for the 818 empty-body rows.
4. Continue Hermes as a versioned EngineAdapter / remote naturalizer boundary; do not move it into `ai-provider-policy` or grant tool/effect authority.
5. Reduce remaining mobile/share IA burden and continue full-surface live browser checks after each UX patch.
