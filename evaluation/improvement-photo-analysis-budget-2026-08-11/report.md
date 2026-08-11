# Improvement photo analysis budget

Verdict: `PASS_LIVE_PRODUCTION_IMPROVEMENT_PHOTO_ANALYSIS_BUDGET_WITH_INSTANCE_ADMISSION`

## Scope

- Product commit: `8b3428023e424b03586626912ad522f271e3a371`
- Production marker: `8b3428023e424b03586626912ad522f271e3a371`
- Deployment: `safeguard-contest-r81tlz1fv-seojaehongs-projects.vercel.app`
- Corrected scan: `c4e9e2f1-7ce4-4313-a651-32205fca401f`
- Finding: `Improvement photo analysis buffers uploads before enforcing file budgets` (`medium`)
- The sealed finding remains immutable. This report records bounded source remediation and does not remove the finding from the canonical scan.

## Security closure

- Improvement multipart requests require a bounded `Content-Length` before `formData()` parsing.
- Before/After input is limited to two recognized file fields, 20 MiB per photo, and 40 MiB aggregate.
- MIME allowlisting and file-signature matching execute before vision provider or database work.
- `analyzeImprovementPhotos()` repeats the shared file validation before any provider call.
- Dedicated hazard-photo analysis and improvement-photo analysis share the `photo-analysis` admission namespace.
- The namespace applies 8 requests per minute and aggregate concurrency 2. Distributed rate/concurrency is used when configured; current production explicitly reports `instance` fallback.

## Verification

- Focused and adjacent suite: 7 files, 76 tests PASS.
- Strict TypeScript: PASS.
- Next.js 15.5.22 production build: PASS, 28 static pages.
- `git diff --check`: PASS.
- Targeted secret scan: PASS.
- Production build-info includes product commit `8b342802`.
- Live unauthenticated probes for both photo endpoints returned HTTP 401 before multipart parsing, provider work, or DB mutation, with `X-SafeClaw-Work-Unit: photo-analysis` and `X-SafeClaw-Rate-Limit: instance`.
- A fake oversized `Content-Length` without a complete body was held by the platform until timeout, so no live 413 is claimed. The focused route tests prove the pre-parse 413 path without sending a live oversized payload.

## Boundaries

- No DB write, photo provider call, provider dispatch, Share-session creation, vector/embedding mutation, wiki publication, or KOSHA registry mutation was performed for this evidence.
- Production distributed admission remains inactive; current live protection is process-instance fallback.
- A follow-up full security scan remains required before the immutable finding can be considered absent from a fresh canonical scan.
- Other canonical findings and deferred candidates remain visible.
- Exact saved `/share/[sessionId]` remains `MISSING_EVIDENCE`.
