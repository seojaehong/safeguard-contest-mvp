# SafeClaw North Star service-auth integration

- Verified HEAD: `a58cc33fb11981414a81b58ad5ad76ace0b93fd0`
- Base: `f16d152e3c38669f69029dab45ebf2e7a645acb3`
- Status: code verified, pre-push
- Database mutation: none

## Delivered

- Remote Hermes service assertions now support current/next key rotation, bounded lifetime and future skew, exact request binding, and asynchronous atomic replay consumption with timeout/abort fail-closed behavior.
- Submission previews preserve every supplied section and row, while the expensive preview DOM is mounted only when the disclosure is opened.
- Provider dispatch capability is server-owned and separated into checking, error, preview-only, and live UI states. Unavailable paths cannot create share sessions or provider dispatch requests.
- Partial-live capability keeps blocked-channel guidance and retry visible. Foreign-language preview selection survives capability errors and retries.
- Kakao capability advertises only the relay transport that the POST path can actually execute. The settings link is labeled as preparation guidance rather than a completed configuration feature.
- Supabase tenant isolation was audited read-only and recorded as an approval-required packet. No migration, policy, or data change was applied.

## Verification

- Full serial suite: 196 files, 188 passed, 8 skipped; 2,305 tests, 2,291 passed, 14 skipped, 0 failed.
- Focused integration suite: 10 files, 182 tests passed.
- Final provider recovery suite: 4 files, 43 tests passed.
- Strict TypeScript typecheck: passed.
- Static frontend audit: 32 pages, 23 product components, 0 coverage issues, 0 violations.
- Browser audit: 108/108 rows passed; 0 failed rows, 0 recovered rows, 0 findings.
- Audit and normal production builds: 28/28 static pages generated.
- Normal bundle contract: 9/9 tests passed.
- Independent final review: SPEC PASS, CODE PASS, P0-P3 findings 0.

## Evidence

- `evaluation/northstar-service-auth-2026-07-17/full-test-final-head.log`
- `evaluation/northstar-service-auth-2026-07-17/build-final.log`
- `evaluation/northstar-service-auth-2026-07-17/browser-audit-final.log`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json`
- `evaluation/frontend-audit-runner-port-v2-2026-07-11/browser-report.json`
- `evaluation/supabase-rls-approval-2026-07-17/report.md`
- `evaluation/remote-hermes-service-auth-2026-07-17/report.md`
- `evaluation/workpack-submission-preview-completeness-2026-07-17/report.md`
- `evaluation/provider-capability-ui-containment-2026-07-17/report.json`

## Honest Remaining Gates

- Remote Hermes service auth is a verified boundary contract, but it is not wired into a production route, EngineAdapter, or durable DB replay ledger.
- Provider dispatch remains intentionally preview-only because persistent provider idempotency is not enabled.
- An authenticated recipient-scoped channel resolver and worker recipient portal do not yet exist.
- Supabase RLS remains approval-required: authoritative target confirmation, tenant A/B negative tests, Storage isolation, FORCE RLS policy decision, and migration-010 table readiness are unresolved.
- No Vercel deployment or live production probe is claimed by this report.
