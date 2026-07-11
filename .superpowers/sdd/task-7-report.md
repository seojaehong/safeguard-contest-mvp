# Task 7 implementation report

## Outcome

- Browser matrix: 32 routes × 3 viewports = 96 rows.
- Workspace theme matrix: Day/Night × 3 viewports = 6 rows.
- Special states: not-found, error, global-error, loading = 4 rows.
- Generated states: document preview and PDF-ready HTML = 2 rows.
- Evidence: 108 screenshots, 108 successful rows, zero recorded failures.

## TDD and visual remediation

The reconciliation test first failed because no browser report existed (`reconciliation-red.log`). The first complete browser pass then exposed a real visual defect in the knowledge detail route: blank Markdown lines created loose vertical gaps, list items were not grouped in a semantic list, and Markdown links appeared as source notation. A focused RED test was added before the renderer and long-form CSS were corrected. The final desktop and mobile captures show a 72ch measure, 15px/1.75 long-form text, responsive 24px/16px padding, semantic lists, and rendered links.

## Verification

- `npm.cmd test`: 56 files, 514 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run audit:frontend-consistency`: 32 pages, 22 components, zero coverage issues, zero violations.
- `npm.cmd run audit:frontend-browser`: 108 screenshots, zero failures.
- `npm.cmd test -- tests/frontend-route-coverage.test.ts`: 19 tests passed.

## Limitations and coordination

The error and global-error boundaries are now exercised by environment-gated audit probes and verified through distinct boundary markers, DOM content, HTTP outcomes, and screenshots. The probes are inert unless `SAFECLAW_FRONTEND_AUDIT=1`, so ordinary production behavior is unchanged. Optimized workspace loading remains an explicitly labelled transient resolved state. Login and callback rows identify their expected deterministic authentication fallbacks. The parallel backend session should expect `app/globals.css` as the primary merge-conflict candidate. This task changes no database, API contract, or persistence behavior.

## Independent-review remediation

- Actual `not-found`, `error`, and `global-error` boundaries have distinct `data-audit-boundary` markers and screenshots; the error probe returns its real 500 boundary response without being misclassified.
- Every row now validates computed product/document font roles, numerical heading tuples, visible control geometry, key surface padding/radius values, and horizontal overflow.
- Workspace Day/Night rows compare color-independent geometry fingerprints at all three widths.
- Totals distinguish failed rows from finding count and enforce `successes + failedRows = 108`; a mutation test proves one row with two findings is counted once.
- Login and callback fallbacks are explicitly labelled; legal divider artifacts, 34px quick chips, and a 30px worker acknowledgement control were corrected through RED/GREEN checks.
- Final browser audit: 108 successes, zero failed rows, zero findings. Final regression: 56 files/517 tests, typecheck, normal production build, static audit 32 routes/22 components with zero coverage issues or violations.

## Exact computed-style remediation

- Replaced ratio-only role inference with exact viewport-derived Display and Page-title sizes, weights, line heights, and tracking values from the design specification.
- Added exact `15px/500/24px/0` product body checks, `document.fonts.check()` evidence, and exact generated title/section/body/table/note point-equivalent tuples.
- Mutation tests independently reject a ratio-preserving wrong heading size, wrong family, body line-height, body tracking, and an unloaded font.
- Boundary filtering removes only exact audit probe messages and their confirmed production 500 consequence; unrelated probe/hydration errors remain findings. React 418 retry requires a sole exact signature and zero console errors, with recovered rows separately labelled and counted.
- Browser review found and fixed the landing mobile hero's 32px regression; it now renders the required 44px Display tuple. The generated PDF fixture now includes a real table row so all five document roles are browser-verified.
- Final evidence: browser 108 successes, zero failed/recovered rows, zero findings; 56 files/519 tests; typecheck; audit-mode and normal builds; static audit 32 routes/22 components with zero issues.

## Generated font-family remediation

- Added a RED mutation proving a generated section with Pretendard fails even when all numerical values remain exact.
- Preview title, section, body, table, and note selectors now explicitly inherit the document stack, preventing stronger product heading rules from leaking into generated content.
- Every generated role records its computed family and role-specific `document.fonts.check()` result. The gate requires a Malgun Gothic-first stack with the Noto Sans KR fallback and a loaded available document face.
- Final browser evidence records all five roles on both preview and PDF with the document stack and `fontLoaded: true`: 108 successes, zero failed/recovered rows, zero findings.
- Final regression: 56 files/520 tests, typecheck, normal and audit-mode builds, static audit 32 routes/22 components with zero issues.

## Final review

- Final implementation head reviewed: `05ee201`.
- Verdict: specification compliance PASS; code quality PASS.
- Findings: 0 Important, 0 Minor.
- Final gates: browser 108/108 with failed/recovered/findings all zero; focused reconciliation 25/25; full 56 files/520 tests; typecheck; audit-mode and normal builds; static audit 32/22 with zero issues; diff-check.

F7 is complete with `passes: true`. PR 66 handoff remains a root-task coordination step, not an implementation blocker.

## Final-branch review remediation

- Route evidence now enforces expected HTTP statuses and final URL paths; mutation tests reject both classes of drift.
- Audit boundary queries require the server-only `SAFECLAW_FRONTEND_AUDIT=1` signal. A normal production build returned `/dryrun?__auditBoundary=error` as HTTP 200 with no audit signal or boundary marker.
- The binary PDF route uses statically traceable Regular/Bold TTF and OFL paths, returns a controlled `PDF_FONT_ASSET_UNAVAILABLE` 500 on asset failure, and converts the PDFKit buffer to a standards-compatible `Uint8Array` response body.
- Next output tracing includes all three font/license assets. A direct binary POST returned HTTP 200, `application/pdf`, 16,245 bytes, and the `%PDF-` signature.
- Browser audit: 108/108, failed 0, findings 0, recovered 1 (sole known React 418 on `/ontology` mobile, passed its immediate isolated retry). Expected-status and final-URL findings are zero.
- Final gates: 56 files/523 tests, typecheck, normal and audit-mode builds, static audit 32 routes/22 components with zero coverage issues/violations.
- `package-lock.json` is now tracked. Frontend/backend ownership, shared-file conflict risks, delegated P1/P2 followups, and mandatory post-integration gates are recorded in the audit JSON/Markdown merge matrix.

## Final closure and external handoff

- Final implementation head reviewed: `b61929f`.
- Final branch review: specification compliance PASS; code quality PASS; Critical 0, Important 0, Minor 0.
- Draft PR #66 body was updated on 2026-07-11 with the final evidence, merge matrix, backend blockers, and post-integration gates.
- Backend patch `99a42d2a3c6df8cbcc23786ee1dfdc3b09920c49` is pushed and backend-owned. It changes only the document-module shell CSS plus focused test/report evidence: Day `#f5c518`, Night `#6c6ff7`, mobile gap 8, controls 44, rail/nav radii 14/8, title 30 desktop/27 mobile.
- Backend geometry evidence: Workspace y 105/281 unchanged; Documents 218/446 to 218/331; Reports 218/446 to 218/285; sample y 659 to 498; horizontal overflow 0.
- The backend patch remains subject to independent backend review before integration. After integration, rerun the documented full tests, typecheck, build, static audit, 108 browser rows, and explicit identity/y-position comparison.

F7 is done with `passes: true`.
