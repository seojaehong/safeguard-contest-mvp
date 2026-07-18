# Share Recipient Localized Labels - 2026-07-18

## Summary

The recipient-facing `/share/[sessionId]` portal already existed on the current master. This patch tightens the foreign-worker presentation boundary so a Vietnamese recipient does not see mixed Korean document chrome for the default safety notice and core document titles.

## Changes

- The worker notice card now uses page copy (`Thông báo an toàn`, `Safety notice`, `작업자 안전공지`) instead of the raw server payload title.
- The three core document summaries now use localized display labels:
  - Korean: `위험성평가표`, `TBM 브리핑`, `TBM 기록`
  - Vietnamese: `Đánh giá rủi ro`, `Họp an toàn TBM`, `Biên bản TBM`
  - English: `Risk assessment`, `TBM briefing`, `TBM log`
- The original document titles and recipient message payload remain unchanged for server/audit provenance.

## Verification

```powershell
npm.cmd test -- tests\share-recipient-portal-browser.test.ts tests\workpack-share-authority-routes.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
npm.cmd run build
npm.cmd test -- tests\share-recipient-portal-browser.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run audit:frontend-consistency
npm.cmd test -- tests\frontend-route-coverage.test.ts --maxWorkers=1 --fileParallelism=false
```

## Results

- Focused route/security tests: 2 files, 34 tests PASS, 2 skipped before production build.
- TypeScript strict typecheck: PASS.
- Production build: PASS, 28/28 static pages generated, `/share/[sessionId]` dynamic route present.
- Production browser contract: 1 file, 2 tests PASS.
- Frontend static consistency audit: PASS, 33 pages, 23 product components, 0 coverage issues, 0 violations.
- Frontend route coverage: 1 file, 39 tests PASS.

## Locked Regression

The Vietnamese invited-worker browser contract now rejects the old mixed labels:

- `Tiếng Việt 안내`
- `위험성평가표`
- `TBM 브리핑`

The same contract requires:

- `Thông báo an toàn`
- `Đánh giá rủi ro`
- `Họp an toàn TBM`
- `Biên bản TBM`
