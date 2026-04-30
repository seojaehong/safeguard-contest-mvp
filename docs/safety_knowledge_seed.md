# SafeGuard 안전지식 Seed DB 운영 기준

## 목적

SafeGuard는 외부 API를 실시간으로 조합하지만, 제출·운영 단계에서는 기본 안전지식 레이어가 필요하다. 이 문서는 무차별 크롤링이 아니라 `공식 출처 기반 curated seed DB`를 기준으로 삼는다.

## 이번에 만든 것

- 대표 위험요인 8개
- KOSHA, 고용노동부, 법제처 중심 공식 출처 14개
- 법령 매핑 3개
- 재해사례 seed 5개
- 교육 추천 seed 3개
- 제출 서식 기준 4개
- Karpathy식 wiki 구조
- KOSHA OpenAPI live 수집 시도 로그

## 파일 구조

```text
data/safety-knowledge/
  manifest.json
  hazards.json
  legal-map.json
  kosha-resources.json
  accident-cases.json
  training-map.json
  templates.json
  live-supplements.json

knowledge/
  SCHEMA.md
  log.md
  wiki/
    index.md
    hazards/*.md
    forms/*.md

evaluation/safety-knowledge-seed/
  safety-knowledge-seed-report.json
  safety-knowledge-seed-report.md
```

## 수집 원칙

- 원문 URL을 반드시 보존한다.
- API 키와 비밀값은 저장하지 않는다.
- LLM 요약만 저장하지 않는다.
- 각 위험요인은 문서 반영 위치와 통제대책을 가진다.
- 법령·KOSHA 자료는 최종 판단이 아니라 문서 초안의 근거 보조로 사용한다.

## 품질 게이트

`npm.cmd run knowledge:seed` 실행 시 아래 조건을 확인한다.

- 대표 위험요인 수집 여부
- 공식 출처 URL 보존 여부
- 법령 매핑 존재 여부
- 서식 매핑 존재 여부
- 재해사례 seed 존재 여부
- 모든 위험요인의 문서 반영 위치 존재 여부
- 모든 위험요인의 통제대책 존재 여부
- KOSHA OpenAPI live 수집 시도 기록 여부
- 서비스키 미저장 여부

## 현재 결과

`evaluation/safety-knowledge-seed/safety-knowledge-seed-report.json` 기준 결과는 `pass`다.

핵심 수치:

- 위험요인: 8개
- 공식 출처: 14개
- 법령 매핑: 3개
- 재해사례 seed: 5개
- 교육 추천 seed: 3개
- 서식 기준: 4개
- KOSHA OpenAPI 표시 항목: 7건
- KOSHA OpenAPI 호출 실패: 0건

## 운영 연결 방식

1. `/api/ask`는 기존 외부 API 호출부를 유지한다.
2. API 결과가 부족하거나 느릴 때 seed DB를 보조 근거로 사용한다.
3. UI에는 seed DB를 원문처럼 표시하지 않고, 원문 URL과 함께 `공식자료 기반 보조 근거`로 표시한다.
4. 문서팩에는 위험요인별 통제대책과 서식 필수 섹션을 보강한다.

## 다음 단계

- `lib/safety-knowledge.ts`를 추가해 `/api/ask`에서 위험요인별 seed를 조회한다.
- Law.go 검색 결과와 `legal-map.json`을 연결해 법령 반영 근거를 더 안정화한다.
- KOSHA 재해사례 API가 표시 항목을 반환하는 키워드를 별도 shard로 확장한다.
- MSDS는 화학물질명이 명확할 때만 세부 섹션을 추가 호출한다.

## 주의

이 DB는 공식자료 기반 초안 생성 보조 자료다. 법령 원문, KOSHA 원문, 사업장 내부 기준을 대체하지 않는다.
