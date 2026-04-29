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

- `KOSHA 안전보건자료 링크 서비스`는 공공데이터포털 참고문서인 `안전보건자료 링크 서비스 코드 목록.xlsx`의 제작형태, 업종, 재해유형, 외국어 코드가 있어야 정확한 조건 검색이 가능하다.
- `KOSHA 안전보건법령 스마트검색`은 활용가이드의 정확한 검색 파라미터가 확인되면 candidate parameter probing을 고정 파라미터로 바꿔야 한다.
- `KOSHA MSDS`는 화학물질 키워드가 있는 작업에서만 호출한다. 일반 건설·물류 작업에는 노이즈가 될 수 있어 기본 노출하지 않는다.
- `한국산업안전보건공단_건설업 일별 중대재해 현황`은 endpoint와 요청 변수 확인 후 건설업 시나리오의 별도 보조 근거로 추가한다.

## Verification

- `npm.cmd run build`: passed.
- `npm.cmd run typecheck`: passed after build regenerated `.next/types`.
- `npm.cmd run smoke:orchestration-download`: passed against production before this deploy. It confirmed current production already returns live `KOSHA 국내재해사례/사고사망` evidence and all 12 download artifacts.

## Next Evidence Gate

After deployment, rerun:

```powershell
npm.cmd run smoke:orchestration-download
```

Expected changes:

- Weather signal count should increase from 3 to up to 5 when `기상특보` and `영향예보` endpoints return usable data.
- API mapping should include `KOSHA 스마트검색/자료링크/MSDS` with either live references or a guide-dependent detail message.
