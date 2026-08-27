# Final 99 12-document no-mutation gate

## Current 2026-08-27 refresh

- Source and production: `dc97877267a48525b9c30b80f9bdd2b2e5d82e18`
- Deterministic live generation: 12/12 documents PASS with `template` mode.
- Current-source local production: 4/4 core PDFs and 14/14 orchestration downloads PASS.
- Live downloads: BLOCKED at `DISTRIBUTED_RATE_LIMIT_UNAVAILABLE` on core PDF export and weather preflight.
- This is a horizontal admission configuration boundary, not a document-content failure and not permission to bypass distributed admission.

Verdict: `PASS_CURRENT_SOURCE_LOCAL_PRODUCTION_12_DOCUMENT_NO_MUTATION_LIVE_HORIZONTAL_ADMISSION_BLOCKED`

## Measured result

- Product source: `e740b92ef3192caeefa06634dca0e70ad9791db6`
- Current source and production: `dc97877267a48525b9c30b80f9bdd2b2e5d82e18`
- Current-source local production: 12/12 canonical documents passed.
- Core exports: risk assessment, work plan, work permit, and TBM log HTML/PDF checks passed 4/4.
- Orchestration export: 12 documents, 14 downloads, 0 failures.
- UI evidence: 5 screenshots passed.
- Verification: current no-mutation contract 4/4, strict typecheck PASS, production build PASS, 28 static pages. Earlier focused gate/PDF 14/14 and Documents/Knowledge UI 55/55 receipts remain retained.

The permit renderer now preserves distinct permit, PPE, isolation, shutdown, access-control, and completion controls even when generic permit rows appear first. The gate reads the canonical `workPermitDraft` rather than substituting another document.

## Honest live boundary

The source-aligned live rerun at `dc978772` generated 12/12 canonical documents through `/api/ask` in deterministic `template` mode, but remained RED for document downloads because production returned `503 DISTRIBUTED_RATE_LIMIT_UNAVAILABLE`. All four core PDF requests were blocked before rendering, and the orchestration export stopped at its weather preflight for the same reason. The current-source local PASS does not hide or override that production infrastructure condition.

This fresh rerun proves that deployment lag and document generation are no longer the explanation: source and production both reported `dc978772`, and live generation passed 12/12. Production distributed admission configuration must be restored before live export and weather-dependent orchestration can pass.

The initial and pre-commit local directories are retained only as discovery traces. Their source SHA does not describe the dirty working-tree content, so they are explicitly excluded from the authoritative verdict.

## No-mutation boundary

No database write, provider generation, provider dispatch, Share-session creation, vector/embedding mutation, wiki publication, or KOSHA registry mutation was performed. Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`, provider persistence remains approval-gated, and a fully automated launch claim is not allowed by this evidence.

## Evidence

- `evaluation/final-99-current-no-mutation-2026-08-27-after-local/report.json`
- `evaluation/final-99-current-no-mutation-2026-08-27-after-local/document-download-smoke.json`
- `evaluation/final-99-current-no-mutation-2026-08-27-after-live/report.json`
- `evaluation/final-99-current-no-mutation-2026-08-27-after-live/document-download-smoke.json`
- Historical 2026-08-17 artifacts remain retained as the earlier distributed-admission baseline.
