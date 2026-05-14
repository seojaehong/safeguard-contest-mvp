# LLM Wiki DB Query Review

## 판정

`llm-wiki`를 "정보를 프롬프트에 넣는 위키"가 아니라 "DB query로 근거 항목과 숫자를 먼저 확정한 뒤 LLM이 문장화하는 위키"로 바꾼 방향은 맞습니다. 특히 `safety_reference_*` 카탈로그는 Supabase count와 ranked RPC를 사용하므로, "몇 건 연결" 같은 숫자를 LLM이 추정하지 않고 DB가 확정합니다.

## 현재 강점

- `lib/safety-reference-catalog.ts`는 `safety_reference_sources`, `safety_reference_items`, `safety_reference_ingestion_runs`를 `Prefer: count=exact`로 직접 조회합니다.
- `getSafetyReferenceStats()`는 기술지원규정 기준 건수와 실제 Supabase 연결 건수를 비교하고, split이 맞지 않으면 `degraded`로 낮춥니다.
- `searchSafetyReferences()`는 ranked RPC(`search_safety_references_ranked`)를 우선 사용하고, 실패하면 REST 검색으로 fallback합니다.
- `/knowledge`는 마크다운 위키와 Supabase 카탈로그 건수를 함께 보여주므로, "읽을 수 있는 위키"와 "검색 가능한 근거 DB"를 분리해 설명할 수 있습니다.

## 보강한 API 확인 범위

- `KOSHA MSDS`: 목록 조회 후 대표 후보 1건에 대해 `getChemDetail01`부터 `getChemDetail16`까지 상세 호출을 시도합니다. 응답된 항목은 `sourceFields`에 항목명별로 저장하고, 미응답 항목은 `MSDS 상세 미응답`으로 남깁니다.
- `법제처 국가법령정보`: 상세 법령 응답에서 별표/서식 단위와 개정문/제개정이유 단위를 읽어 `별표목록`, `개정이력요약`, `annexSummaries`, `revisionSummaries`로 보존합니다.
- `기상청 기상특보`: 발표시각 외에 `tmEf` 기반 발효시각, `tmEnd/tmEd/endTm/releaseTime` 기반 해제시각 후보를 `sourceFields`에 직접 보존합니다.

## 다음 개선 방향

- 숫자 표시에는 항상 `query`, `filters`, `count source`, `fetchedAt`을 함께 붙입니다. 심사위원에게 "AI가 말한 숫자"가 아니라 "DB/API가 반환한 숫자"임을 보여주는 장치입니다.
- `/api/knowledge/match`의 seed 위키 매칭과 Supabase ranked catalog 검색을 UI에서 더 명확히 분리합니다. seed는 설명 지식, Supabase는 원본 근거 카탈로그입니다.
- MSDS 상세는 API가 화학물질 식별자 파라미터를 엄격하게 요구할 수 있으므로, 지금은 상세 호출 시도와 응답 보존까지를 제출 기준으로 삼고, 실제 사업화 단계에서는 화학물질 식별자 매핑 테이블을 따로 두는 것이 안전합니다.
- 법제처 별표/개정이력은 상세 화면에서 확인하는 근거로 우선 노출하고, 문서 본문에는 꼭 필요한 경우에만 짧은 요약으로 넣어야 합니다. 본문에 긴 별표 목록을 밀어 넣으면 문서 품질이 떨어집니다.

## 결론

지금 방향은 제출용으로 방어 가능합니다. 핵심 메시지는 "LLM Wiki가 숫자를 생성하는 것이 아니라, DB/API 쿼리가 숫자와 원본 필드를 확정하고 LLM은 이를 문서 문장으로 바꾼다"입니다.
