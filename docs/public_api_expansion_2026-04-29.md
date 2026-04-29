# SafeGuard Public API Expansion Check

## Summary

2026-04-29 기준 공공데이터포털 승인 API 목록을 제품 호출 구조에 다시 매핑했다. 핵심 방향은 화면에 상태표만 보여주는 것이 아니라, 각 API가 위험성평가, TBM, 안전보건교육, 외국인 안내문, 전파 메시지 중 어디에 반영되는지 증빙하는 것이다.

## Implemented In This Pass

| API | Status | Product role |
| --- | --- | --- |
| 기상청 단기예보 조회서비스 | live | 초단기실황, 초단기예보, 단기예보를 현장 브리프와 작업중지 기준에 반영 |
| 기상청 기상특보 조회서비스 | added | 기상특보를 확인해 옥외·고소작업 작업중지 판단 문구에 반영 |
| 기상청 영향예보 조회서비스 | added | 폭염·한파 영향예보를 취약 작업자, 휴식, 음수, 보온·냉방 점검 문구에 반영 |
| KOSHA 국내재해사례 게시판 정보 조회서비스 | live | 유사 재해사례를 TBM, 교육기록, 예방 포인트에 반영 |
| KOSHA 국내재해사례 게시판 첨부파일 정보 조회서비스 | added | 국내재해사례 게시글 첨부파일을 근거 링크로 승격 |
| KOSHA 사고사망 게시판 정보 조회서비스 | live | 국내재해사례가 실패해도 독립적으로 사고사망 사례를 live 근거로 사용 |
| KOSHA 안전보건법령 스마트검색 | added, guide-dependent | 검색 결과가 반환되면 문서 반영 근거에 추가 |
| KOSHA 안전보건자료 링크 서비스 | added, code-list-dependent | 코드 목록이 확보되면 안전보건교육 자료와 외국인 안내문에 추가 |
| KOSHA MSDS 조회 서비스 | added, chemical-only | 화학물질 키워드가 있는 경우 MSDS 목록을 위험성평가와 비상대응에 추가 |

## Remaining API Detail Risks

- `KOSHA 안전보건자료 링크 서비스`는 공공데이터포털 참고문서인 `안전보건자료 링크 서비스 코드 목록.xlsx`를 확보해 `ctgr01`, `ctgr02`, `ctgr03`, `ctgr04`, `ctgr04_kr` 기반으로 고정했다.
- `KOSHA 안전보건법령 스마트검색`은 활용가이드에서 확인한 `searchValue`, `category` 기반으로 고정했다.
- `KOSHA MSDS`는 화학물질 키워드가 있는 작업에서만 호출한다. 일반 건설·물류 작업에는 노이즈가 될 수 있어 기본 노출하지 않는다.
- `한국산업안전보건공단_건설업 일별 중대재해 현황`은 endpoint와 요청 변수 확인 후 건설업 시나리오의 별도 보조 근거로 추가한다.

## Applied Guide Details

### KOSHA 안전보건법령 스마트검색

- Base URL: `http://apis.data.go.kr/B552468/srch/smartSearch`
- Required params: `serviceKey`, `pageNo`, `numOfRows`, `searchValue`, `category`
- Category mapping:
  - `0`: 전체
  - `6`: 미디어
  - `7`: KOSHA GUIDE
  - `8`: 중대재해처벌법

### KOSHA 안전보건자료 링크 서비스

- Endpoint: `https://apis.data.go.kr/B552468/selectMediaList01/getselectMediaList01`
- Code params:
  - `ctgr01`: 제작형태. SafeGuard default is `12` for OPS.
  - `ctgr02`: 업종. `1` 공통업종, `2` 제조, `3` 건설, `4` 서비스, `6` 기타.
  - `ctgr03`: 재해유형. 예: `11000001` 떨어짐, `11000007` 끼임, `11000004` 부딪힘, `11000011` 화재, `11000014` 화학물질누출·접촉.
  - `ctgr04`: 외국어. 예: `6200110` 베트남어, `6130110` 중국어, `6150110` 몽골어, `6180110` 태국어, `6190110` 우즈베크어.
  - `ctgr04_kr`: 한국어 자료 포함. SafeGuard uses `Y` so Korean manager materials and foreign-worker materials can be shown together.

## Verification

- `npm.cmd run build`: passed.
- `npm.cmd run typecheck`: passed after build regenerated `.next/types`.
- `npm.cmd run smoke:orchestration-download`: passed against production after deployment.

## Production Smoke Result

- 대상 URL: `https://safeguard-contest-mvp.vercel.app`
- 기상청: live, signal count 5. 초단기실황, 초단기예보, 단기예보, 기상특보, 영향예보 호출 경로가 WeatherSignal에 반영됐다.
- KOSHA 국내재해사례/첨부파일/사고사망: live, count 3. 국내재해사례와 사고사망 게시판 근거가 TBM과 교육 사례에 반영됐다.
- KOSHA 스마트검색/자료링크/MSDS: live, count 2. 스마트검색과 자료링크 근거가 문서 반영 근거로 연결됐다. MSDS는 화학물질 키워드가 없는 물류 시나리오라 의도적으로 건너뛰었다.
- 다운로드: TXT, JSON, CSV, XLS, DOC, HTML, HWPX, PDF, JPG, 전체 TXT, 전체 CSV, 전체 XLS 총 12개 artifact 생성 성공.

## Next Evidence Gate

- `안전보건자료 링크 서비스 코드 목록.xlsx`를 확보하면 제작형태, 업종, 재해유형, 외국어 코드를 고정 파라미터로 바꾼다.
- `안전보건법령 스마트검색 활용가이드.docx`를 확보하면 `smartSearch`의 검색 파라미터 후보 probing을 제거하고 단일 명세 기반 호출로 바꾼다.
- `건설업 일별 중대재해 현황` endpoint와 요청 변수를 확인해 건설업 시나리오의 별도 보조 근거로 추가한다.
