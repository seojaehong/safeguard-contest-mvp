# SafeGuard safety evidence and foreign-worker service report

Generated: 2026-04-27

## Scope
- Added KOSHA-like accident case evidence layer with `DATA_GO_KR_SERVICE_KEY` live attempt and fallback fixtures.
- Added foreign-worker printable briefing and transmission message as first-class workpack deliverables.
- Added a default multilingual safety phrase pack for Vietnamese, Chinese, Thai, Uzbek, Mongolian, Nepali, Khmer, English, Indonesian, and Burmese.
- Extended Workpack export and n8n dispatch payload to include accident cases, citations, and foreign-worker deliverables.
- Grouped Law.go evidence UI by law, precedent, and interpretation, and clarified that citations are draft support evidence.

## Research basis
- Ministry of Justice immigration monthly statistics show China, Vietnam, United States, Thailand, and Uzbekistan among the largest foreign-resident nationality groups in the 2025 monthly data. This supports Chinese, Vietnamese, English, Thai, and Uzbek as core languages.
- The field-worker language pack also includes Mongolian, Nepali, Khmer, Indonesian, and Burmese because these languages are common in workplace communication for migrant-worker safety briefings and employment-permit contexts.
- Data.go.kr notice identifies the KOSHA disaster API URL family as `apis.data.go.kr/B552468/disaster_api02`, so the adapter uses this endpoint candidate with graceful fallback.
- Work24 OpenAPI is XML over HTTP and includes employer training course APIs, so foreign-worker training recommendations remain in the Work24 evidence layer.

Sources:
- https://www.moj.go.kr/bbs/immigration/227/483375/download.do
- https://www.data.go.kr/en/bbs/ntc/selectNotice.do?originId=NOTICE_0000000004222
- https://www.work24.go.kr/cm/e/a/0110/selectOpenApiSvcInfo.do?fullApiSvcId=000000000000000000000000000108%5E000000000000000000000000000163%5E000000000000000000000000000174

## API configuration needed
- `DATA_GO_KR_SERVICE_KEY`: required for live KMA weather and KOSHA accident-case candidate API.
- `WORK24_AUTH_KEY`: required for live Work24 employer-training recommendations.
- `LAWGO_OC`: required for live Law.go law, precedent, and interpretation citations.
- `GEMINI_API_KEY`: optional but recommended for live answer generation.
- `PAPAGO_CLIENT_ID`, `PAPAGO_CLIENT_SECRET`, `GOOGLE_TRANSLATION_API_KEY`: optional future translation providers. Current implementation works without them through curated multilingual safety phrases.

## Verification
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run e2e:scenarios`: passed with 6 scenario runs, including foreign-worker and accident-case checks.
- Live smoke with loaded `.env.local`: passed for Law.go, Gemini, KMA weather, Work24, KOSHA official references, and KOSHA accident cases.
- Live accident-case ranking sample: `산소절단 작업 중 화재폭발 / 제조업` selected for the manufacturing hot-work scenario.

## Remaining risk
- KOSHA accident-case endpoint fields can vary by public-data gateway version. The adapter parses `keyword`, `contents`, `business`, and `boardno`, then ranks the first 100 live records by industry and risk keyword.
- Multilingual strings are safety phrase-pack defaults, not certified translation. UI and exports include manager/interpreter review wording before field use.
