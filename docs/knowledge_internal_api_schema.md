# SafeGuard Knowledge Layer Internal API Schema

## 목적

SafeGuard 지식층은 `기초 지식 DB -> live API 원본 이벤트 -> AI 재생성 번들 -> 검수 후 wiki 반영` 순서로 동작한다. 외부 API 호출부는 그대로 두고, 호출 결과를 받은 뒤 원본 이벤트와 문서 반영 후보를 관리하는 내부 레이어만 추가한다.

## 현재 제출 기준

- 기초 DB는 `data/safety-knowledge/*.json`과 `knowledge/wiki/**`에 저장한다.
- 런타임 매칭은 `/api/knowledge/match`가 담당한다.
- live 호출로 새로 들어온 원본은 `/api/knowledge/ingest`에서 스키마 검증과 wiki 반영 후보 생성을 수행한다.
- AI 재생성은 `/api/knowledge/regenerate`가 만든 bundle을 사용한다.
- 현 단계의 원본 이벤트 저장은 `stateless`이다. 영구 누적은 Supabase migration 승인 후 `knowledge_events` 또는 `daily_entries` 스냅샷 테이블로 전환한다.

## API

### `GET /api/knowledge/match`

질문 문장을 기초 지식 DB에 매칭한다.

Query:

```json
{
  "question": "서울 성수동 외벽 도장, 이동식 비계, 강풍, 추락 위험",
  "limit": 4
}
```

Response:

```json
{
  "ok": true,
  "source": "safety-knowledge-seed",
  "storageMode": "seed",
  "matches": [
    {
      "id": "hazard_scaffold_fall",
      "title": "이동식 비계 추락",
      "primaryDocuments": ["위험성평가표", "TBM", "안전보건교육"],
      "controls": ["작업 전 고정핀 확인", "바퀴 잠금", "강풍 시 작업중지"],
      "sources": [],
      "legalMappings": [],
      "score": 3
    }
  ]
}
```

### `POST /api/knowledge/ingest`

live API 호출 결과 또는 수동 확인 자료를 원본 이벤트로 검증한다. Supabase와 관리자 토큰이 있으면 `knowledge_events`에 저장하고, 없으면 stateless 검증 결과만 반환한다.

Request:

```json
{
  "source": "kosha-openapi",
  "sourceId": "smart-search-20260501-001",
  "capturedAt": "2026-05-01T09:00:00.000Z",
  "title": "이동식 비계 강풍 작업중지 기준 확인",
  "url": "https://apis.data.go.kr/B552468/srch/smartSearch",
  "payload": {
    "keyword": "이동식 비계 강풍 추락"
  },
  "relatedHazardIds": ["hazard_scaffold_fall"],
  "reflectedDocuments": ["위험성평가표", "TBM", "안전보건교육"]
}
```

Response:

```json
{
  "ok": true,
  "configured": true,
  "storageMode": "persistent",
  "savedEventId": "uuid",
  "savedRunId": "uuid",
  "event": {},
  "proposedWikiUpdate": {
    "hazardIds": ["hazard_scaffold_fall"],
    "documentNames": ["위험성평가표", "TBM", "안전보건교육"],
    "sourceTitle": "이동식 비계 강풍 작업중지 기준 확인",
    "reviewRequired": true
  }
}
```

### `POST /api/knowledge/regenerate`

기초 지식 DB와 원본 이벤트를 묶어 AI 재생성에 사용할 bundle을 만든다. 기본은 bundle 생성만 수행하고, `generate: true`일 때만 Gemini 또는 OpenAI를 호출한다.

Request:

```json
{
  "question": "서울 성수동 외벽 도장, 이동식 비계, 강풍",
  "rawEvents": [],
  "limit": 4,
  "generate": true
}
```

Response:

```json
{
  "ok": true,
  "configured": true,
  "storageMode": "persistent",
  "savedRunId": "uuid",
  "aiReady": true,
  "generated": {
    "configured": true,
    "text": "AI가 생성한 지식 위키 초안",
    "providerLabel": "Gemini (gemini-2.5-flash)",
    "policyNote": "Gemini 응답 정책"
  },
  "bundle": {
    "question": "서울 성수동 외벽 도장, 이동식 비계, 강풍",
    "matchedHazards": [],
    "templates": [],
    "rawEvents": [],
    "aiInstruction": "Use the seed safety knowledge...",
    "storagePolicy": {
      "mode": "stateless",
      "message": "영구 누적은 Supabase migration 승인 후 활성화합니다."
    }
  }
}
```

## 원본 이벤트 스키마

```ts
type KnowledgeRawEvent = {
  source: "kma" | "lawgo" | "work24" | "kosha" | "kosha-openapi" | "kosha-accident" | "manual";
  sourceId: string;
  capturedAt: string;
  title: string;
  url?: string;
  payload: Record<string, unknown>;
  relatedHazardIds: string[];
  reflectedDocuments: string[];
};
```

## Migration 003 저장 전략

`supabase/migrations/003_knowledge_runtime.sql`은 다음 테이블을 추가한다.

- `daily_entries`: 현장별·일자별 기상, 법령, 교육, KOSHA, 재해사례, 지식 DB 스냅샷을 동결한다.
- `knowledge_events`: live 호출 원본 이벤트와 문서 반영 위치, 검수 상태를 저장한다.
- `knowledge_regeneration_runs`: AI 재생성 bundle, provider, 생성 결과, 검수 상태를 저장한다.

큰 원본 JSON, PDF, HWPX, 이미지 증빙은 후속 단계에서 Object Storage에 저장하고 DB에는 참조만 두는 구조가 적합하다.

## Obsidian 사용 판단

Obsidian은 런타임 필수가 아니다. `knowledge/` 폴더를 vault로 열면 사람이 markdown wiki를 검수하기 좋지만, 서비스는 Supabase와 내부 API만으로 작동해야 한다. 따라서 Obsidian CLI는 제출 기준 기능이 아니라 운영자 편의 기능으로 둔다.

## Gemini 사용 판단

Gemini는 지식 위키 초안 재생성에 적합하다. 다만 모든 요청에서 호출하면 비용과 지연이 커지므로 `/api/knowledge/regenerate`에서 `generate: true`일 때만 호출한다. 기본 경로는 seed DB 매칭과 bundle 생성으로 유지한다.

## Ask 경로 반영

`/api/ask`는 이제 `externalData.safetyKnowledge`를 선택적으로 포함한다. 문서팩에는 내부 지식 DB 매칭 결과가 `위험성평가표`, `작업계획서`, `TBM`, `안전보건교육`의 반영 근거로 추가된다.
