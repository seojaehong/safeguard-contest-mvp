# SafeClaw Backend Harness Gate Review

작성일: 2026-07-08

## 결론

SIF 임베딩은 완료된 단계가 아니라 승인 게이트에 들어온 상태다. 현재 완료된 것은 `safety_reference_items` 기반 SIF 코퍼스 정제와 업로드 가드이며, 실제 OpenAI embedding 생성, `safety_reference_embeddings` 업로드, vector 검색 RPC 연결은 아직 실행하지 않았다.

이번 작업은 DB schema 변경 없이 아래 표면을 보강했다.

- 작업팩 학습/메모리 export API 추가: `/api/workpacks/[id]/learning-export`
- MD/JSONL export가 `workpack`, `reference`, `improvement`, `ack` 이벤트를 보존
- Before/After vision 분석 결과 중 `summary`, `ocrText`를 하네스 프롬프트와 export에 포함
- 작업팩 operation context에 실제 `created_at`을 포함해 “언제 한 작업인지”를 export에 반영

## 현재 상태 판정

### SIF / 임베딩

- 완료: `safety_reference_items.item_type = "sif-case"` 조회 및 코퍼스 생성
- 완료: `evaluation/sif-embedding-gate/report.json` 기준 SIF 6,033건 중 header 1건 제외, corpus 6,032건
- 완료: `scripts/prepare_sif_embedding_corpus.mjs`의 `--upload --approved-upload` 가드
- 미완료: embedding 생성, DB 업로드, vector RPC, runtime hybrid retrieval
- 승인 필요: `010_commercial_operations.sql` 적용 또는 embedding-only migration 분리

### Vision / OCR

- 서버 경로 존재: `app/api/workpacks/[id]/improvements/route.ts`
- 모델 어댑터 존재: `lib/photo-vision-analysis.ts`
- 동작: Before/After 파일이 모두 있고 `OPENAI_API_KEY`가 있으면 OpenAI Responses API에 이미지 2장을 전달
- 결과 저장 위치: `workpack_improvements.analysis_payload`
- 보강: 하네스 메모리와 learning export가 `analysis_payload.summary`, `analysis_payload.ocrText`를 회수
- 남은 일: 사용자-facing `/workspace` localStorage UI를 실제 workpack 개선사항 API로 연결

### 온톨로지

- 현재 `/ontology`는 published graph를 list + hover card로 보여준다.
- LangGraph/Habermas Machine 구현은 이번 게이트의 필수 조건이 아니다.
- 지금 병목은 agent orchestration보다 DB 근거 고정, 개선 이력 회수, 승인된 지식 승격이다.
- 다음 UI 후보는 Obsidian식 hover card + 리스트 기반 탐색을 유지하면서 작업팩 하네스 패킷과 연결하는 것이다.

### 당일 작업 메모리

새 API:

```text
GET /api/workpacks/:id/learning-export?format=markdown
GET /api/workpacks/:id/learning-export?format=jsonl
```

포함 데이터:

- 작업팩 id, 생성시각, 입력문
- safety reference / SIF / KOSHA 근거
- 개선사항 후보, 반영 문서, source type
- vision summary, OCR text
- 작업자 열람 확인 이력

이 export는 제품 안에서 “학습”이라는 표현 대신 “현장 개선 이력 메모리”, “운영 지식 베이스 갱신 후보”로 취급한다.

## 다음 승인 게이트

승인 전 실행 금지:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --upload --approved-upload
```

승인 시 필요한 결정:

- `010_commercial_operations.sql` 전체 적용 vs embedding-only migration 분리
- `safety_reference_embeddings`에 HNSW/IVFFLAT vector index 추가
- query embedding RPC 추가
- `searchSafetyReferences()`의 embedding-first 또는 hybrid retrieval 전략
- OpenAI key / Supabase service role / migration 적용 순서

## 검증

```powershell
npm.cmd test -- tests/commercial-harness.test.ts tests/photo-vision-analysis.test.ts tests/workpack-commercial.test.ts tests/commercial-migration.test.ts tests/mcp-tools.test.ts
npm.cmd run typecheck
```

결과:

- 5 test files passed
- 38 tests passed
- typecheck passed
