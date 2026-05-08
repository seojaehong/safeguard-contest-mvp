# SafeClaw grill-with-docs review closeout

## Reviewed documents

- `C:\Users\iceam\OneDrive\바탕 화면\SafeGuard 다운로드 파일(xlsx_hwp) 심층 분석 검토 의견서.md`
- `C:\Users\iceam\OneDrive\바탕 화면\SafeGuard (safeclaw.kr) 전면 개정판 검토 의견서.md`
- `C:\Users\iceam\OneDrive\바탕 화면\SafeGuard UI 드라이런 검토 의견서 (Playwright 기반).md`

## Findings closed

1. Worker count parsing no longer treats subgroup counts such as `외국인 근로자 2명` or `신규 작업자 1명` as the total workforce when a later total `작업자 6명` exists.
2. Scenario site names now honor explicit location hints in the user prompt. For example, an `안산` hot-work prompt no longer inherits the fixed `창원 산업단지` profile site name.
3. The workspace default generation mode is now `enhanced`, so the contest-facing default uses Gemini structured form generation for the core documents. The faster template mode remains available as an explicit choice.

## Verification

- `npm.cmd run typecheck`: pass
- `npm.cmd run build`: pass
- `npm.cmd run smoke:output-contract`: pass

## Remaining notices

- Kakao/Band channels remain outside the current submission gate until channel/template approval is complete.
- HWPX remains a text/submission draft path, while HWP/XLSX are the stronger tabular submission-support formats.
