# SafeClaw P1 검색 하네스 관련성 교정 보고서

작성일: 2026-07-10

## 결론

성수동 외벽 도장 시나리오에서 발생한 `기계 가동부`, `정전도장` 오탐과 `지게차 동선` 누락을 로컬 실 API까지 재현하고 교정했다.

교정 후 동일 입력의 구조화 위험성평가와 TBM에는 아래 세 공식 근거가 각각 대표 출처로 연결된다.

- `B-M-11-2025 지게차의 안전작업에 관한 기술지원규정`
- `D-C-13-2026 외벽도장보수공사에 안전작업에 관한 기술지원규정`
- `B-E-17-2026 도장 공정에서의 화재·폭발위험방지에 관한 기술지원규정`

`B-E-20 정전도장기`, 기계 방호덮개, 정비 LOTO 문구는 해당 시나리오의 검색 패킷, 구조화 행, TBM 링크, 하네스 답변에서 제외된다.

## 재현된 원인

1. REST fallback 검색어가 앞쪽 토큰에 제한되어 문장 후반의 `강풍`, `지게차`, `동선`이 검색 단계에서 사라졌다.
2. 도장이라는 넓은 단어만으로 정전도장 전용 자료가 함께 선택됐다.
3. SIF/KOSHA catalog의 범용 controls에 기계·밀폐·운반 조치가 혼합되어 있었고, 하네스 답변과 문서 부록이 이를 그대로 사용했다.
4. 같은 위험 도메인의 검색 결과가 상위 슬롯을 독점해 다른 명시 위험이 문서 행으로 내려오지 못했다.

## 적용 내용

- 문장 전체에서 핵심 위험 신호를 먼저 보존하는 fallback term 추출
- 최소 네 개 고신호 검색 경로 확인 후 결과 확정
- 지게차, 추락·비계, 도료 화재, 밀폐공간 등 위험 도메인별 대표 근거 다양화
- 동일 도메인에서는 공식 직접근거와 제목 특이성이 높은 자료 우선
- 정전도장·선박 내부도장·자동차 분무도장 전용 자료의 조건부 호환성 guard
- DB 하네스 packet과 문서 appendix를 동일 operational view로 정규화
- 구조화 위험성평가는 실제 ranked 결과를 사용
- 저장된 API 응답을 재검증하는 `--input-json` probe 모드
- probe 필수 항목에 도료·유기용제 화재 통제 추가
- 출처 summary의 과거 사고 서술을 현재 적용 controls로 오판하지 않도록 probe 범위 분리

## 검증 증거

기존 프리뷰 응답 오프라인 재검증:

- 결과: 실패
- 실패 계약: canonical scenario controls, irrelevant controls
- 보고서: `evaluation/preview-opus-2026-07-10/offline-before-relevance-fix/report.md`

교정 후 로컬 실 API 재검증:

- 응답: HTTP 200
- DB 하네스, 구조화 위험성평가, TBM 링크, 생성 증거 봉인, 온톨로지 검수 통과
- 추락·비계, 강풍, 지게차 동선, 도료 화재 필수 통제 확인
- 기계 방호·정전도장 오탐 없음
- UI 근거 패널용 `externalData.safetyReference.items`도 동일 operational controls로 정규화되어 오염 항목 없음
- 보고서: `evaluation/preview-opus-2026-07-10/local-after-relevance-fix-v4/probe/report.md`

로컬 probe의 전체 판정은 외부 API 키가 없는 개발 환경에서 법령·기상·훈련 경로가 fallback으로 표시되어 `quality_state_ready`만 실패했다. 검색 하네스, 문서 구조, 온톨로지, 무변경 API 계약은 통과했다. Preview에는 해당 외부 API 환경변수가 있으므로 배포 후 같은 probe로 최종 판정한다.

## 자동 검증

```powershell
npm.cmd test -- tests/commercial-harness.test.ts tests/safety-reference-relevance.test.ts tests/safety-reference-hybrid.test.ts tests/pump-confined-scenario.test.ts tests/quality-contract.test.ts tests/mock-deliverable-integrity.test.ts tests/workpack-readiness.test.ts tests/generation-evidence.test.ts tests/ask-generation-evidence-routes.test.ts tests/workpack-generation-evidence-route.test.ts tests/generation-evidence-operation-routes.test.ts tests/live-harness-quality-probe.test.ts --maxWorkers=1 --fileParallelism=false
npm.cmd run typecheck
npm.cmd run build
```

결과:

- 전체 회귀: 88 files, 651 tests passed
- TypeScript strict check: passed
- Next production build: passed, 27 static pages generated

## 별도 확인 사항

`aiMode=enhanced`는 DB 하네스 row-first 경로이며, 저장된 응답만으로 `claude-opus-4-8` 문서 생성 호출을 입증할 수 없다. 모델·provider 증명은 generation trace를 별도로 봉인하거나 `full` 모드의 문서별 provider/model trace를 남겨야 한다.

근거: `evaluation/preview-opus-2026-07-10/provider-trace-investigation-2026-07-10.md`
