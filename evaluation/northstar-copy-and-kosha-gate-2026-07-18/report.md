# North Star Copy and KOSHA Gate

검증 시각: 2026-07-18T13:27:02+09:00
기준 HEAD: 15144645d130453a14db8b5a41dfe82a783c52e9

## 목적

SafeClaw 제품 표면에서 `학습`, `파인튜닝`이라는 표현이 모델 가중치 변경처럼 오해되지 않도록 정리했다. 사용자에게는 `검증 코퍼스`, `SIF 코퍼스/임베딩`, `모델 가중치 변경 없음`으로 표시하고, 내부 machine field는 기존 계약 호환성을 위해 유지한다.

## 변경 범위

- `components/AiConnectPanel.tsx`: SIF 상태 카드를 `SIF 코퍼스/임베딩`과 `모델 가중치 변경 있음/없음`으로 표시.
- `components/SafeGuardCommandCenter.tsx`: 홈페이지 proof section을 `검증 코퍼스`로 표시.
- `lib/web-safe-presentation.ts`: 사용자 노출 문구 변환 boundary에 파인튜닝/학습 표현 교정 추가.
- `lib/sif-embedding-gate-status.ts`: SIF gate 답변을 모델 가중치 변경과 임베딩 생성으로 분리.
- `lib/reporting-downloads.ts`, `lib/workpack-learning-export.ts`: 보고서/학습 export 설명을 모델 가중치 변경 산출물이 아니라고 명시.
- `tests/sif-embedding-gate-status.test.ts`, `tests/commercial-harness.test.ts`: 변경된 사용자 문구와 fixture hash 고정.

## 검증

### 사용자 문구 boundary

명령:

```powershell
npm.cmd test -- tests\customer-terminology-boundary.test.ts tests\sif-embedding-gate-status.test.ts tests\commercial-harness.test.ts tests\reporting-downloads.test.ts tests\ai-connect-production-matrix.test.ts --maxWorkers=1 --fileParallelism=false
```

결과:

- Test Files: 4 passed, 1 skipped
- Tests: 109 passed, 2 skipped

### KOSHA / 온톨로지 하네스

명령:

```powershell
npm.cmd test -- tests\exact-trusted-kosha-grounding.test.ts tests\exact-trusted-kosha-registry-wave2.test.ts tests\exact-trusted-kosha-registry-wave3.test.ts tests\kosha-current-review-lifecycle.test.ts tests\kosha-current-review-photo-storage.test.ts tests\kosha-current-review-provenance.test.ts tests\kosha-current-review-run-ask.test.ts tests\kosha-grounding-fail-closed.test.ts tests\kosha-guide-corpus-audit.test.ts tests\kosha-guide-offline-harness-expanded.test.ts tests\kosha-guide-offline-harness.test.ts tests\kosha-guide-provenance-gate.test.ts tests\kosha-guide-supporting-row-relevance.test.ts tests\kosha-verified-subset-gate.test.ts tests\ontology-evidence-chains.test.ts tests\ontology-graph-store.test.ts tests\ontology-knowledge-tool.test.ts tests\ontology-operation-memory.test.ts tests\ontology-qa-review.test.ts tests\ontology-query.test.ts tests\ontology-schema.test.ts tests\ontology-seed.test.ts tests\workpack-ontology-qa.test.ts --maxWorkers=1 --fileParallelism=false
```

결과:

- Test Files: 23 passed
- Tests: 392 passed

### UI 핵심 회귀

명령:

```powershell
npm.cmd test -- tests\ontology-ui-browser.test.ts tests\ontology-ui-remediation.test.ts tests\ontology-tablet-overflow.test.ts tests\ontology-visualization.test.ts tests\why-mobile-layout.test.ts tests\knowledge-mobile-ia-browser.test.ts tests\knowledge-page-layout.test.ts tests\knowledge-governance-ui-contract.test.ts --maxWorkers=1 --fileParallelism=false
```

결과:

- Test Files: 6 passed, 2 skipped
- Tests: 31 passed, 3 skipped

### TypeScript / Production Build

명령:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

결과:

- TypeScript strict check: PASS
- Production build: PASS, 28/28 static pages generated

## 판정

이번 변경은 schema, DB data, LLM provider, SIF/KOSHA retrieval ranking을 바꾸지 않는다. 제품 설명만 `모델 파인튜닝` 오해에서 `재생성 가능한 코퍼스 + 임베딩 준비 + DB 하네스 고정` 구조로 맞췄고, 기존 하네스 회귀는 통과했다.
