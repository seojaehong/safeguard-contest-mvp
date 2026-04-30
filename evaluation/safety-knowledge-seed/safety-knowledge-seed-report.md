# SafeGuard 안전지식 Seed DB 수집 리포트

## 판정

- 결과: `pass`
- 생성 시각: 2026-04-30T23:32:56.809Z

## 수집 범위

- 위험요인: 8개
- 공식 출처: 14개
- 법령 매핑: 3개
- 재해사례 seed: 5개
- 교육 추천 seed: 3개
- 서식 기준: 4개

## Live 수집 시도

- KOSHA OpenAPI 표시 항목: 7건
- 응답은 받았으나 표시 항목 없음: 7건
- 호출 실패: 0건

## 품질 게이트

- 통과: hazard-count - 8개 위험요인
- 통과: official-source-count - 14개 공식 출처
- 통과: legal-map-count - 3개 법령 매핑
- 통과: template-count - 4개 서식 매핑
- 통과: accident-case-count - 5개 재해사례 seed
- 통과: source-url-preserved - 모든 공식 출처 URL 보존
- 통과: hazard-document-mapping - 모든 위험요인 문서 반영 위치 보유
- 통과: controls-present - 모든 위험요인 통제대책 보유
- 통과: live-attempt-recorded - KOSHA OpenAPI live 수집 시도 기록
- 통과: no-secret-leak - 서비스키 미저장

## 산출물

- `data/safety-knowledge/manifest.json`
- `data/safety-knowledge/hazards.json`
- `data/safety-knowledge/legal-map.json`
- `data/safety-knowledge/kosha-resources.json`
- `data/safety-knowledge/accident-cases.json`
- `data/safety-knowledge/training-map.json`
- `data/safety-knowledge/templates.json`
- `knowledge/SCHEMA.md`
- `knowledge/log.md`
- `knowledge/wiki/index.md`
- `knowledge/wiki/hazards/*.md`
- `knowledge/wiki/forms/*.md`
- `evaluation/safety-knowledge-seed/safety-knowledge-seed-report.json`
- `evaluation/safety-knowledge-seed/safety-knowledge-seed-report.md`

## 사용 원칙

이 seed DB는 공식자료 기반 초안 생성 보조 자료입니다. 법령 원문, KOSHA 원문, 사업장 내부 기준을 대체하지 않습니다.
