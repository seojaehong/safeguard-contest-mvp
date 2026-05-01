# KOSHA 재해사례 API 복구 메모

점검일: 2026-04-29

## 증상

Vercel production smoke에서 `KOSHA 재해사례`가 `fallback`으로 표시됐고, 상세 사유는 `KOSHA 국내재해사례 API 오류 응답: 99 / UNKNOWN_ERROR`였다.

## 확인 결과

- 현재 adapter의 기본 endpoint는 `https://apis.data.go.kr/B552468/disaster_api02/getdisaster_api02`이다.
- 로컬 `.env.local`의 `DATA_GO_KR_SERVICE_KEY`로 직접 호출하면 HTTP 200과 JSON 사례 목록이 반환된다.
- 따라서 endpoint 자체는 유효하며, production 실패 원인은 Vercel 환경변수의 서비스키 인코딩 형태 또는 공공데이터 API의 런타임 응답 차이일 가능성이 높다.
- 명세상 `business`는 산재 업종코드가 아니라 KOSHA 홈페이지 게시판 종류이다. 따라서 물류·창고 입력을 `운수창고업`으로 보내지 않고 홈페이지 게시판 축에 맞춰 `서비스업`으로 보낸다.

## 적용한 해결책

- 서비스키 후보 URL을 순차 재시도하도록 변경했다.
- 후보는 다음 방식이다.
  - `URLSearchParams`로 원문 키 전달
  - 원문 키를 query에 직접 전달
  - 키가 URL encoded 형태이면 decode 후 `URLSearchParams`로 전달
  - decode 후 query에 직접 전달
- 모든 후보가 실패할 때만 제품형 fallback을 사용한다.
- 실패 detail에는 어떤 후보가 어떤 오류를 반환했는지 남겨 운영 진단이 가능하게 했다.

## 기대 효과

- Vercel에 서비스키가 decoded 형태로 들어가도 동작한다.
- Vercel에 서비스키가 encoded 형태로 들어가도 동작한다.
- 공공데이터 포털이 특정 인코딩 조합에서 `UNKNOWN_ERROR`를 반환해도 다른 후보로 자동 복구한다.

## 남은 확인

- 배포 후 `npm.cmd run smoke:orchestration-download`에서 `KOSHA 재해사례` mode가 `live`로 바뀌는지 확인한다.
- 그래도 `fallback`이면 Vercel production의 `DATA_GO_KR_SERVICE_KEY` 값이 로컬과 다른지 확인해야 한다.
- Vercel CLI에서 env 값을 조회하려면 현재 터미널에 Vercel login/token이 필요하다.

## 추가 조치

서비스키 후보 재시도 후에도 production에서만 `UNKNOWN_ERROR`가 유지되면, Vercel 기본 함수 리전이 해외로 배정되어 공공 API 응답이 달라지는 케이스를 의심한다. 그래서 `vercel.json`에 `regions: ["icn1"]`을 지정해 API Route 실행 리전을 Seoul로 고정한다.

리전 고정 후에도 production에서 동일한 오류가 유지되면, Vercel 직접 호출 경로를 우회한다. `KOSHA_ACCIDENT_PROXY_URL`과 `KOSHA_ACCIDENT_PROXY_TOKEN`을 추가해 Oracle 서버 또는 n8n relay가 KOSHA 국내재해사례 API를 대신 호출하도록 한다.

권장 relay 입력:

```json
{
  "question": "작업 설명",
  "keyword": "지게차",
  "business": "서비스업",
  "pageNo": 1,
  "numOfRows": 100,
  "callApiId": "1060"
}
```

권장 relay 출력은 data.go.kr 원문 JSON 그대로 반환하는 방식이다. SafeGuard adapter가 기존 parser로 변환하므로 relay는 별도 정규화를 하지 않아도 된다.

`business` 값은 KOSHA 게시판 종류 기준으로 보낸다. 현재 adapter 기본값은 `건설업`, `제조업`, `조선업`, `서비스업`이며, 분류가 애매하면 business를 비워 전체 게시판에서 keyword 중심으로 조회한다.

환경변수:

```bash
KOSHA_ACCIDENT_PROXY_URL=https://<relay-domain>/webhook/kosha-accident
KOSHA_ACCIDENT_PROXY_TOKEN=<relay-secret>
```
