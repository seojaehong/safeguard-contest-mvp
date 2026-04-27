# SafeGuard full function audit

Date: 2026-04-27

## Scope

- Golden-path `/` home rendering
- `/api/ask` live integration chain
- `/api/search` evidence search
- Law.go precedent mapping for work-risk evidence
- Work24 training recommendation fit check
- KOSHA official guide/manual verification and workpack reflection
- HWPX WASM asset availability

## Result

The current local build is field-demo ready for the representative scenario.

| Area | Result |
| --- | --- |
| TypeScript | Passed: `npm.cmd run typecheck` |
| Production build | Passed: `npm.cmd run build` |
| `/api/ask` mode | `live` |
| Law.go | `live` |
| AI | `live` |
| KMA weather | `live` |
| Work24 training | `live` |
| KOSHA resources | `live` |
| Citations | 6 shown, source mix contains Law.go evidence |
| Law.go precedents | 3 mapped precedents in ask response |
| `/api/search` | 9 results, 3 Law.go precedent results |
| HWPX WASM | HTTP 200, 4,069,304 bytes |
| Home UI | Rendered with workpack, training-fit label, KOSHA confirmation label |

## Integration notes

- Law.go now prefers live mode when `LAWGO_OC` exists and only forces mock when `LAWGO_MOCK_MODE=force`.
- Law.go precedent search maps work-risk queries such as fall, scaffold, forklift, education, PPE, and contractor safety obligations into precedent queries.
- Work24 training results are no longer blindly shown as direct matches. Each recommendation now carries a fit label: `현장 적합`, `대상 적합`, or `조건부 후보`.
- KOSHA resources are selected by scenario keywords and can combine multiple axes. The representative question now maps both construction risk and forklift/logistics risk.
- KOSHA official URLs are checked at request time with timeout and retry. Verified references are surfaced in the UI and appended to TBM/risk/education drafts.

## Representative scenario evidence

Question:

```text
서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM 초안을 만들어줘.
```

Observed response:

- `mode`: `live`
- `status.lawgo`: `live`
- `status.ai`: `live`
- `status.weather`: `live`
- `status.work24`: `live`
- `status.kosha`: `live`
- Top Work24 recommendation: `[스킬업] 건설안전기사 필기 1편 (개정)`
- Training fit label: `현장 적합`
- KOSHA verified references: 4
- KOSHA mapped references:
  - KOSHA 작업 전 안전점검회의(TBM) 안내
  - KOSHA 위험성평가 교육자료
  - KOSHA Guide: 추락재해 예방
  - 지게차의 안전작업에 관한 기술지원규정

## Official resource checks

- KOSHA TBM article: `https://www.kosha.or.kr/kosha/business/constructionLife.do?mode=view&articleNo=459856&article.offset=0&articleLimit=10`
- KOSHA risk-assessment education file: `https://edu.kosha.or.kr/headquater/support/pds/filedownload/20240618161529_4648504880514822912_pdf`
- KOSHA Guide list: `https://www.kosha.or.kr/kosha/data/guidanceX.do`
- KOSHA forklift technical resource: `https://oshri.kosha.or.kr/kosha/info/koshaGuideData.do?articleNo=453866&mode=view`

## Artifacts

- `evaluation/2026-04-27-full-audit/final-summary.json`
- `evaluation/2026-04-27-full-audit/ask-response-final.json`
- `evaluation/2026-04-27-full-audit/search-response-final.json`
- `evaluation/2026-04-27-full-audit/server-final.log`

## Remaining risk

- KOSHA does not expose a clean public JSON search endpoint in the current integration path. The product therefore verifies and maps official public pages/files instead of scraping deep board contents.
- Work24 course matching should stay conservative. If a question does not mention foreign workers, foreign-worker training is kept as a conditional candidate rather than treated as the primary fit.
- Live integrations depend on public API availability and may still require fallback during rate limiting or provider downtime.
