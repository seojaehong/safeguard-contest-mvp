# SafeClaw Public Data Field Coverage

검증 기준일: 2026-05-13

범위: Worker D 문서/검증 작업. 런타임 코드는 수정하지 않았고, `docs/submission_form_data_entries.md`와 이 coverage 문서만 대상으로 삼았다.

## Legend

| 분류 | 의미 |
| --- | --- |
| `query-filter` | API 호출 파라미터, 검색어, 지역·기간·분류 필터로 사용 |
| `parsed-output` | 응답에서 파싱해 `externalData`, `sourceFields`, 추천/근거 객체 등에 보존 |
| `document-context` | 문서 본문, 부록, AI prompt context, 작업중지/교육/TBM 문장 생성에 사용 |
| `UI/evidence` | evidence 카드, 홈/근거 화면, 상태 detail, metadata 확인 경로에 노출 |
| `not-yet-used` | 현재 코드 경로에서 직접 사용 근거를 확인하지 못함 |

## Summary

| 데이터셋 | 판정 | 코드 경로 | 제출 문구 조정 |
| --- | --- | --- | --- |
| 고용24 훈련과정 | partial | `lib/work24.ts`, `lib/search.ts` | "후속 교육 후보 추천"으로 낮춤 |
| KOSHA 안전보건자료 링크 | partial | `lib/kosha-openapi.ts`, `lib/search.ts` | 업종·재해유형·외국어는 조회조건, 자료명·링크는 근거 후보 |
| KOSHA 국내재해사례 | partial | `lib/accident-cases.ts`, `lib/search.ts` | 유사 재해사례 후보와 예방 포인트 보조 반영 |
| KOSHA 사고사망/건설업 일별 중대재해 | partial | `lib/accident-cases.ts`, `lib/kosha-openapi.ts` | 사고사망 게시판과 건설업 일별 중대재해를 분리 설명 |
| KOSHA 안전보건법령 스마트검색 | pass | `lib/kosha-openapi.ts`, `lib/search.ts` | 검색결과 제목·분류·요약·링크 확인 가능 |
| KOSHA MSDS | pass_with_notice | `lib/kosha-openapi.ts`, `lib/search.ts` | 목록 후보 + 대표 후보의 getChemDetail01~16 상세 호출 결과를 보존. API 미응답 항목은 미응답 사유로 분리 |
| 기상청 단기예보 | pass | `lib/weather.ts`, `lib/search.ts` | 기상 신호와 작업중지·TBM 문구에 직접 연결 |
| 기상청 기상특보 | pass_with_notice | `lib/weather.ts`, `lib/search.ts` | 발표·발효·해제시각 후보를 sourceFields로 보존. 해제시각 미제공 특보는 빈 필드로 유지 |
| 법제처 국가법령정보 | pass_with_notice | `lib/lawgo.ts`, `lib/search.ts` | 조문 전문과 함께 별표/서식·개정이력 요약을 상세 metadata/sourceFields로 보존 |

## New Metadata Exposed By Other Workers

| 위치 | 확인 내용 | Worker D 문서 반영 |
| --- | --- | --- |
| `lib/types.ts` | `SourceMetadata`, `sourceFields`, `filters`, `PublicDataUsage*` 타입이 추가되어 데이터 사용 근거를 구조화할 수 있음 | coverage에서 `metadata/sourceFields/filters`를 증거 경로로 명시 |
| `lib/weather.ts` | 기상 신호별 `sourceFields`, `filters`, `metadata`가 추가됨 | 단기예보·특보의 필드 단위 판정에 반영 |
| `lib/work24.ts` | 훈련과정 추천에 `metadata.usedFields`, `sourceFields`, `filters`가 추가됨 | 고용24 필드 일부를 parsed-output/UI-evidence로 상향 |
| `lib/kosha-openapi.ts` | KOSHA OpenAPI reference별 `metadata.usedFields`, `sourceFields`, `filters`가 추가됨 | KOSHA 자료 링크, 스마트검색, MSDS, 건설업 일별 중대재해 필드 판정에 반영 |
| `lib/lawgo.ts` | 법령 검색·상세 결과에 `sourceFields`, `filters`, `metadata`가 추가됨 | 법제처 필드 중 MST·조문 계열 판정에 반영 |

## Field Matrix

### 고용24 훈련과정

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `authKey` | query-filter | `fetchCourseXml`에서 인증 파라미터로 사용 |
| `srchNcs1` / 직종·NCS분류 | query-filter, UI/evidence | `외국인`, `안전` 조회 모두 `srchNcs1=23`; metadata에 `srchNcs1:*` 보존 |
| `srchTraProcessNm` | query-filter | `외국인`, `안전` 키워드 조회 |
| `srchTraArea1` / 훈련지역 | query-filter, UI/evidence | 질문 지역 매핑 후 필터로 사용, sourceFields에 지역 코드 보존 |
| `srchTraStDt`, `srchTraEndDt` | query-filter | 현재일 기준 기간 조회 |
| 과정명 | parsed-output, document-context, UI/evidence | `title` 파싱, 추천 문구와 교육 appendix에 사용 |
| 훈련기관명 | parsed-output, document-context, UI/evidence | `subTitle` 파싱, 추천 문구에 사용 |
| 훈련시작일 / 훈련종료일 | parsed-output, document-context, UI/evidence | `traStartDate`, `traEndDate` 파싱, 교육 appendix에 사용 |
| 훈련비 | parsed-output, UI/evidence | `realMan` 파싱 후 metadata 보존 |
| 수강대상 | parsed-output, document-context, UI/evidence | `trainTarget` 파싱, 적합성 판단에 사용 |
| 과정상태 | UI/evidence | 실제 응답 필드 파싱이 아니라 "조회 기간 내 모집/운영 후보"로 보수 표기 |

### KOSHA 안전보건자료 링크 서비스

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `serviceKey`, `pageNo`, `numOfRows` | query-filter | `fetchSafetyMedia` 호출 파라미터 |
| `callApiId` | query-filter, parsed-output, UI/evidence | `selectMediaList01`로 호출, metadata에 보존 |
| 제작형태 | parsed-output, UI/evidence | 응답 키 후보가 있으면 `sourceFields`에 보존 |
| 업종 | query-filter, parsed-output, UI/evidence | 질문 키워드로 `ctgr02` 산정, 응답명 있으면 보존 |
| 재해유형 | query-filter, parsed-output, UI/evidence | 질문 키워드로 `ctgr03` 산정, 응답명 있으면 보존 |
| 외국어 구분 | query-filter, parsed-output, document-context, UI/evidence | 외국인/언어 키워드로 `ctgr04` 산정, 외국인 안내문 근거 후보 |
| 자료명 | parsed-output, document-context, UI/evidence | `title` 후보 파싱 후 교육/외국인 출력본 근거 |
| 자료 링크 URL | parsed-output, UI/evidence | `url/link/fileUrl` 후보 파싱 |
| 내용요약 | parsed-output, document-context | `summary/contents/desc` 후보 파싱 후 근거 요약 |

### KOSHA 국내재해사례

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `ServiceKey`, `pageNo`, `numOfRows` | query-filter | `fetchAccidentCases` URL 후보와 relay 호출 |
| `business`, `keyword` | query-filter | 질문에서 업종·재해 키워드 선택 |
| `callApiId` | query-filter | URL 후보 호출에 사용되는 서비스 식별자 |
| `boardno` / 게시글번호 | parsed-output, UI/evidence | 상세/첨부 URL 구성에 사용 |
| 제목 | parsed-output, document-context, UI/evidence | 유사 재해사례 제목으로 문서와 evidence 카드에 사용 |
| 게시일 | not-yet-used | 현재 `toAccidentCase`에서 직접 파싱·문서 반영 근거 없음 |
| 내용요약 / 사고개요 | parsed-output, document-context | 사례 요약과 예방 포인트 문구 생성 |
| 예방대책 / 재발방지대책 | parsed-output, document-context | TBM·교육·비상대응 appendix에 사용 |
| 첨부파일 여부 / 첨부 링크 | parsed-output, UI/evidence | boardNo가 있으면 첨부 조회 후 sourceUrl로 대체 가능 |

### KOSHA 사고사망 게시판 / 건설업 일별 중대재해

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `callApiId`, `pageNo`, `numOfRows` | query-filter | 건설업 일별 중대재해 호출 및 사고사망 후보 호출 |
| 사망사고 일자 | parsed-output, UI/evidence | 건설업 일별 중대재해 경로에서 `dsstrDy` 후보 파싱 |
| 장소 | parsed-output, document-context, UI/evidence | 건설업 일별 중대재해 경로에서 장소를 summary에 포함 |
| 사고개요 | parsed-output, document-context, UI/evidence | 건설업 일별 중대재해 경로에서 사례 문장에 포함 |
| 원인 | parsed-output, UI/evidence | metadata sourceFields로 보존 |
| 사망자 수 / 부상자 수 | parsed-output, UI/evidence | metadata sourceFields로 보존, 문장 직접 반영은 제한적 |
| 사고사망 게시판 제목 | parsed-output, document-context, UI/evidence | `keyword/title` 파싱 후 사망사고 유사 위험으로 반영 |
| 사고사망 게시판 내용 | parsed-output, document-context | `contents` HTML 제거 후 summary로 사용 |
| 세부 피해 추적 | not-yet-used | 제출 문구에서 원문 전체 분석처럼 표현하지 않음 |

### KOSHA 안전보건법령 스마트검색

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `serviceKey`, `pageNo`, `numOfRows` | query-filter | `fetchSmartSearch` 호출 파라미터 |
| `searchValue` | query-filter | 질문 키워드에서 `보호구`, `비계`, `추락`, `위험성평가` 등 선택 |
| `category` | query-filter, UI/evidence | 중대재해·가이드·교육 여부로 분류 코드 선택 |
| 검색결과 제목 | parsed-output, document-context, UI/evidence | `title/ttl/sj/lawNm/guideNm` 파싱 |
| 분류 | parsed-output, UI/evidence | `category/categoryNm/ctgrNm` 후보 파싱 |
| 요약 | parsed-output, document-context | `summary/contents/highlight_content` 후보 파싱 |
| 링크 | parsed-output, UI/evidence | `filepath/url/link/detailUrl` 후보 파싱 |

### KOSHA MSDS

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| 화학물질 검색어 | query-filter | 질문에 화학물질·세척제 키워드가 있을 때만 조회 |
| `chemNm`, `chemName`, `searchWrd`, `keyword` | query-filter | 여러 후보 파라미터를 순차 시도 |
| 화학물질명 | parsed-output, document-context, UI/evidence | 응답 XML에서 이름 후보 파싱 |
| 제품명 | parsed-output, UI/evidence | 응답에 있으면 sourceFields 보존 |
| 유해성·위험성 | parsed-output, document-context | 응답 필드가 있으면 위험성평가 근거로 보존 |
| 구성성분 | parsed-output, UI/evidence | 응답 필드가 있으면 보존 |
| 응급조치요령 | parsed-output, document-context | 응답 필드가 있으면 비상대응 문구 보강 |
| 폭발·화재시 대처방법 | parsed-output, document-context | 응답 필드가 있으면 화재·비상대응 문구 보강 |
| 누출사고시 대처방법 | parsed-output, document-context | 응답 필드가 있으면 누출 대응 문구 보강 |
| 취급 및 저장방법 | parsed-output, document-context | 응답 필드가 있으면 작업계획·교육 문구 보강 |
| 노출방지 및 개인보호구 | parsed-output, document-context | 응답 필드가 있으면 보호구 문구 보강 |
| 법적 규제현황 | parsed-output, UI/evidence | 응답 필드가 있으면 metadata 보존, 법령 해석 자체는 별도 Law.go 경로 |

### 기상청 단기예보

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `baseDate`, `baseTime` | query-filter, parsed-output, UI/evidence | 초단기실황·초단기예보·단기예보 호출 및 sourceFields 보존 |
| `nx`, `ny` | query-filter, parsed-output, UI/evidence | 질문 지역을 격자로 매핑 |
| `category` | query-filter, parsed-output, UI/evidence | `T1H`, `TMP`, `WSD`, `POP`, `PTY`, `SKY`, `RN1` 값 선택 |
| `fcstDate`, `fcstTime` | parsed-output, UI/evidence | 예보시각 보존 |
| `fcstValue`, `obsrValue` | parsed-output, document-context, UI/evidence | 기온·풍속·강수·하늘상태로 변환 |
| 기온 | parsed-output, document-context, UI/evidence | 고온 조치 및 summary |
| 강수형태 | parsed-output, document-context, UI/evidence | 미끄럼·감전·우천 작업 조치 |
| 강수확률 | parsed-output, document-context, UI/evidence | 작업중지·TBM 기상 신호 |
| 풍속 | parsed-output, document-context, UI/evidence | 고소·비계 작업중지 기준 |
| 하늘상태 | parsed-output, document-context, UI/evidence | 현장 브리프 summary |

### 기상청 기상특보

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `stnId`, `fromTmFc`, `toTmFc` | query-filter, UI/evidence | 최근 특보 범위 조회 |
| 발표시각 | parsed-output, document-context, UI/evidence | `tmFc`를 forecastTime/sourceFields로 보존 |
| 특보구역 | parsed-output, document-context, UI/evidence | `stnNm` 지역 필터와 summary |
| 특보종류 | parsed-output, document-context, UI/evidence | `wrn`을 sourceFields로 보존 |
| 특보수준 | parsed-output, document-context, UI/evidence | `lvl`을 sourceFields로 보존 |
| 발효시각 | parsed-output, UI/evidence | `tmEf` 우선, 없으면 `tmFc`를 대체 발효시각 후보로 sourceFields에 보존 |
| 해제시각 | parsed-output, UI/evidence | `tmEnd`, `tmEd`, `endTm`, `releaseTime` 후보를 sourceFields에 보존. 응답이 없으면 빈 값으로 유지 |
| 특보명령 | parsed-output, UI/evidence | `cmd`를 sourceFields로 보존 |

### 법제처 국가법령정보

| 필드 | 분류 | 근거 |
| --- | --- | --- |
| `OC` | query-filter | Law.go 인증 파라미터 |
| `target`, `query`, `type` | query-filter, UI/evidence | 법령·판례·해석례 검색 필터 |
| 법령명 | parsed-output, document-context, UI/evidence | 검색 결과 title, 상세 lawName |
| 법령ID | parsed-output, UI/evidence | 검색 결과 URL fallback 후보 |
| `MST` | parsed-output, query-filter, UI/evidence | 상세 조회 키와 원문 URL 구성 |
| 시행일자 | parsed-output, document-context, UI/evidence | 상세 `기본정보`에서 points/summary에 사용 |
| 공포일자 / 공포번호 | parsed-output, UI/evidence | 검색 citation, 상세 citation에 사용 |
| 소관부처 | parsed-output, document-context, UI/evidence | 검색 summary와 상세 points에 사용 |
| 조문번호 | parsed-output, document-context | 상세 조문 heading 구성 |
| 조문제목 | parsed-output, document-context | 상세 조문 heading 구성 |
| 조문내용 | parsed-output, document-context | 법령 상세 body와 문서 근거 |
| 별표 | parsed-output, UI/evidence | 상세 응답의 `별표/별표단위`를 읽어 개수와 `별표목록` 요약을 보존 |
| 개정이력 | parsed-output, UI/evidence | 상세 응답의 `개정문/제개정이유` 단위를 읽어 개수와 `개정이력요약`을 보존 |

## Submission Guardrails

| 주제 | 안전 문구 |
| --- | --- |
| live API | "조회/파싱 가능한 항목을 문서 근거 후보로 연결" |
| seed/reference DB | "내장 지식 DB 또는 Supabase 안전 참고 DB를 보조 맥락으로 사용" |
| 조건부 호출 | "작업 키워드가 맞을 때 호출" |
| 빈 응답·키 없음 | "fallback 또는 보수 문구로 전환" |
| 아직 미사용 필드 | "제출서에는 전체 원문 반영처럼 쓰지 않음" |
