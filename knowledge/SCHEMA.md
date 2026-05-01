# SafeGuard Safety Knowledge Schema

## 목적

SafeGuard의 안전지식 베이스는 공식 출처 기반 초안 생성을 돕는 seed DB입니다. 법령 원문이나 KOSHA 원문을 대체하지 않습니다.

## 주요 파일

- `data/safety-knowledge/manifest.json`: 전체 출처와 생성 상태
- `data/safety-knowledge/hazards.json`: 위험요인별 키워드, 통제대책, 문서 반영 위치
- `data/safety-knowledge/legal-map.json`: 법령 근거 초안 매핑
- `data/safety-knowledge/kosha-resources.json`: KOSHA/MOEL/법제처 공식 출처
- `data/safety-knowledge/accident-cases.json`: 유사 재해사례 seed
- `data/safety-knowledge/training-map.json`: 후속 교육 추천 seed
- `data/safety-knowledge/templates.json`: 서식별 필수 항목

## 품질 기준

- 원문 URL을 보존한다.
- 문서 반영 위치를 명시한다.
- LLM 요약만 저장하지 않는다.
- 법적 효력 보장 표현을 쓰지 않는다.
- API 키와 비밀값을 저장하지 않는다.
