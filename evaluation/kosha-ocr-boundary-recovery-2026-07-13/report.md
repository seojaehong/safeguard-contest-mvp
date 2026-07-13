# KOSHA 이미지 PDF OCR 경계 복구

## 대상

- 문서: `B-E-3-2025 변전실 등의 양압유지에 관한 기술지원규정`
- corpus item: `kosha-60492776122f8b433994fc10`
- 원본 SHA-256: `24aee7bdb72a1d69159122329267eed2fd68dc607d35d5270eeb6b326513a3c9`
- 원본 상태: 14페이지 이미지 전용 PDF, native text 0자

## 재생성 결과

OpenAI Responses vision을 180 DPI 페이지 단위로 호출해 14페이지 모두 `completed` 상태인 OCR 후보를 만들었다. 공백 제외 본문은 8,946자다. 페이지별 렌더 이미지 해시, 본문 해시, 응답 ID·모델·완료 상태와 생성기 코드 해시를 함께 보존했다. 첫 응답부터 마지막 응답까지 144초, 첫 응답부터 후보 기록까지 148초가 걸렸다.

후보 파일:

- `B-E-3-2025-candidate.json`
- 파일 SHA-256: `8ded6bed994721546bf0f54a24f2612c4fc8fb0a5d339f48dce1b248688cff40`
- 본문 SHA-256: `fbe98a41cdae6dce7cf024649362786a81608233054a5fa7a11ef853b8a2ab02`
- 생성기 코드 SHA-256: `5c56fb8f35d9bf4349ae17c152d437dd86b2bc22a15b0fed212976873efebcdf`

첫 후보는 독립 검토에서 fail-open 경계가 발견되어 폐기했다. 두 번째 후보도 generator allowlist가 없는 검증기에서 만들어져 폐기했다. 현재 세 번째 후보를 만든 뒤에도 수입 허용 상태로 승격하지 않았다.

## 닫힌 경계

- OpenAI 응답은 `status=completed`일 때만 수용한다. 일부 텍스트가 있어도 `incomplete`면 전체 페이지를 거부한다.
- 후보 상태는 `candidate / draft / human_confirmed=false`다.
- 검토 완료는 JSON 플래그만으로 만들 수 없다. 신뢰 검토자 목록, RFC3339 검토시각, 후보 전체 내용 해시와 HMAC attestation을 요구한다.
- HMAC으로 후보를 다시 서명하더라도, 호출자가 별도로 고정한 trusted generator SHA-256과 후보 생성기 해시가 다르면 거부한다.
- 검증 시 원본 PDF SHA와 페이지 수를 다시 확인하고, 후보가 기록한 180 DPI로 전 페이지를 재렌더해 이미지 해시를 다시 대조한다.
- 출력은 원본과 다른 `.json` 파일만 허용하며 기존 파일 덮어쓰기는 명시적 `--overwrite` 없이는 막는다.
- 성공 로그에는 파일명만 남기며 절대경로, 환경파일 경로, API 키는 후보에 저장하지 않는다.
- DB와 Supabase는 호출하거나 수정하지 않았다.

## 검증

- 원본 해시 및 14페이지 preflight: PASS
- Python unit tests: 1 file / 9 tests PASS
- Python syntax compile: PASS
- 빈 OCR 페이지: 0
- incomplete 응답: 0
- 누락 response ID: 0
- generator hash 재검증: PASS
- draft 수입 차단: `ocr_candidate_not_human_confirmed`
- secret/absolute-path scan: 0
- fresh 독립 코드 경계 검토: `SPEC PASS / CODE PASS`, P0-P3 `0 / 0 / 0 / 0`
- 독립 generator mismatch probe: 정상 HMAC 재서명 후에도 `ocr_candidate_generator_hash_mismatch`로 거부

동일 OCR을 재현할 때 Python 의존성은 `scripts/requirements-kosha-ocr.txt`로 고정한다. API 키는 프로세스 환경에서만 읽는다.

현재 원본 이미지 대조에서 남은 교정 후보는 다음과 같다. 원시 OCR 후보는 provenance 보존을 위해 직접 고치지 않았다.

- 2페이지: `가입실` -> 원문 `가압실`
- 3페이지: `전산관` -> 원문 `전선관`
- 7페이지: `클랜드` -> 원문 `글랜드`
- 13페이지: `양압실폐시` -> 원문 `양압실패시`
- 12페이지 표 1: 병합 헤더와 4열 셀 귀속을 구조화 교정해야 함

따라서 사람 검토 상태는 `blocked`다. 위 교정사항을 provenance가 남는 별도 review overlay로 승인하기 전에는 현재 raw 후보에 `verified` attestation을 만들 수 없다.

## 수입 설계 경계

후보가 사람 검토를 통과하더라도 곧바로 direct 근거가 되지 않는다. 스냅샷 수입은 정확히 일치하는 boundary 항목에만 원자적으로 적용하고, 본문 origin을 `human-reviewed-ocr`로 보존해 검색 가능한 supporting 근거로만 사용해야 한다. production row와 local chunk는 `payload.zipFile + payload.internalPath`와 `source_zip + source_member`의 정확한 튜플로 연결하며, 제목 유사 일치는 허용하지 않는다.

## 출시 판정

이번 작업은 누락된 이미지 PDF를 재현 가능한 후보로 복구한 것이며 KOSHA corpus가 launch-ready가 됐다는 뜻은 아니다. 전 페이지 사람 확인과 production/local provenance bridge가 모두 닫힐 때까지 `bodyMissingCount=1`, `downloadProvenance=incomplete`, `productionChunkBridge=absent`의 fail-closed 상태를 유지한다. `corpusImportAllowed=false`, `ontologyPublicationAllowed=false`다.
