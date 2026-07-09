# SIF Embedding / Harness Approval Gate

생성 시각: 2026-07-08 17:27 KST
최신 재검증: 2026-07-09 12:28 KST

## 판정

SIF 임베딩 과정은 “지나간 것”이 아니라 **업로드 전 승인 게이트에 진입한 상태**다.

- 완료: `safety_reference_items`의 SIF 6,033건 전수 조회
- 완료: 스프레드시트 헤더 1건 제외
- 완료: 임베딩 코퍼스 6,032건 생성
- 완료: 빈 embedding text, 관리대책 누락, 문서반영 누락, 중복 contentHash 검출 0건
- 미실행: 전체 6,032건 OpenAI embedding 생성
- 확인: canary 3건 OpenAI embedding 생성 성공
- 미실행: `safety_reference_embeddings` DB 업로드
- 미실행: migration 적용

## 현재 증거

명령:

```powershell
npm.cmd run knowledge:sif-embedding-corpus
```

산출물:

- `evaluation/sif-embedding-gate/report.json`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.md`
- `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json`

핵심 수치:

- itemCount: 6,033
- skippedCount: 1
- corpusCount: 6,032
- missingControlsCount: 0
- missingPrimaryDocumentsCount: 0
- emptyEmbeddingTextCount: 0
- duplicateContentHashCount: 0
- embeddingModel: `text-embedding-3-small`
- embeddingDimensions: 1,536
- batchSize: 100
- batchCount: 61
- corpusHash: `2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e`

## Batch Manifest

`sif-embedding-batch-manifest.json`은 실제 embedding 생성/업로드 전 승인자가 확인할 고정 manifest다.

- 전체 6,032개 코퍼스를 100개 단위 61개 batch로 나눴다.
- 각 batch는 `batchId`, index 범위, reference item id 목록, batch content hash를 가진다.
- manifest 자체의 `approvalGate.dbMutationPerformed`는 `false`다.
- 따라서 현재 단계는 DB 변경이 아니라 “무엇을 임베딩할지 고정한 승인 대기 상태”다.

## Upload Safety Gate

`scripts/prepare_sif_embedding_corpus.mjs`는 `--upload`만으로 DB mutation을 실행하지 않는다. 실제 업로드에는 아래 둘이 모두 필요하다.

- DB migration 승인 및 적용
- `--upload --approved-upload`

또한 `--batch-size`로 OpenAI embedding 생성과 Supabase upsert를 batch 단위로 나눠 실행한다. 기본값은 100이다.

검증 명령:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --limit 2 --upload --output-dir evaluation/sif-embedding-upload-guard
```

결과:

- uploadedCount: 0
- uploadError: `--upload requires explicit --approved-upload after DB migration approval`

## Next Gate Preflight

생성 시각: 2026-07-09 12:28 KST

명령:

```powershell
npm.cmd run knowledge:sif-embedding-preflight -- --require-execution-env --output evaluation/sif-embedding-gate/approval-preflight-report.json
```

산출물:

- `evaluation/sif-embedding-gate/approval-preflight-report.json`

판정:

- corpus/manifest/report 일치: 통과
- JSONL line count와 corpusCount 일치: 통과
- 빈 embedding text, 관리대책 누락, 문서반영 누락, 중복 contentHash: 0건
- 업로드 승인 플래그 가드: 통과
- `010_commercial_operations.sql`의 `safety_reference_embeddings`, HNSW index, `match_safety_reference_embeddings` RPC 계약: 통과
- RLS: `safety_reference_embeddings` public select는 `using (false)`로 차단
- DB mutation: 미실행
- OpenAI embedding 생성: 미실행
- Supabase upload: 미실행

현재 실행 환경:

- Supabase URL/service role: 있음
- `OPENAI_API_KEY`: 있음
- `SAFETY_REFERENCE_VECTOR_SEARCH=1`: 꺼짐
- 따라서 승인 후 실제 embedding 생성/업로드를 실행할 수 있는 로컬 환경은 준비되어 있다.

## Runtime DB Probe

생성 시각: 2026-07-09 12:28 KST

명령:

```powershell
npm.cmd run knowledge:sif-embedding-runtime-probe -- --output evaluation/sif-embedding-gate/runtime-db-probe.json
```

판정:

- `safety_reference_items`: 조회 성공, SIF 6,033건
- `safety_reference_embeddings`: 404, table 없음
- `match_safety_reference_embeddings`: 404, RPC 없음
- status: `migration-required`
- DB mutation: 미실행

따라서 지금 승인할 대상은 임베딩 생성/업로드가 아니라 **SIF-only DB migration**이다.

다음 승인 결정:

- `010_commercial_operations.sql` 전체 적용 또는 embedding-only migration 분리
- 실행 환경의 `OPENAI_API_KEY`와 Supabase service role 유지
- 승인 후에만 `--embed --approved-embedding` 실행
- DB migration과 row count 검증 후에만 `--upload --approved-upload` 실행
- 업로드 row count가 6,032인지 검증한 뒤 `SAFETY_REFERENCE_VECTOR_SEARCH=1` 활성화

## Vision/OCR 연결 상태

Before/After 개선 사진은 `app/api/workpacks/[id]/improvements/route.ts`에서 `analyzeImprovementPhotos`를 호출한다.

- 사진이 둘 다 있으면 OpenAI Responses API에 before/after image를 전달
- JSON 필드: `summary`, `detectedHazards`, `observedImprovement`, `ocrText`, `reflectedDocuments`
- `OPENAI_API_KEY`가 없으면 `unconfigured`로 저장하고, 수동 개선사항 텍스트를 우선 사용
- 결과는 `workpack_improvements.analysis_payload`에 저장

## Ontology / LangGraph / Habermas Machine

이번 단계에서는 LangGraph나 Habermas Machine 구현이 필수는 아니다.

- LangGraph/LangSmith는 durable execution, streaming, deployment 같은 agent runtime에 강점이 있다. SafeClaw의 현재 병목은 agent orchestration보다 DB 근거 고정과 작업 이력 회수다.
- Habermas Machine은 집단 숙의에서 공통 진술을 만드는 연구 방향이다. SafeClaw의 핵심은 합의문 생성보다 “지난 개선사항이 오늘 위험성평가/TBM으로 돌아오는 운영 그래프”다.

따라서 이번 구현은 `/ontology`의 리스트 기반 온톨로지와 hover card 시각화를 우선한다. LangGraph는 장기적으로 “하네스 실행 이력, 재시도, human approval workflow”가 복잡해질 때 재검토한다.

참고:

- LangGraph/LangSmith deployment docs: https://docs.langchain.com/langsmith/deployment
- Habermas Machine publication page: https://deepmind.google/research/publications/65220/
- Habermas Machine paper DOI: https://www.science.org/doi/10.1126/science.adq2852

## Learning 표현

제품 안에서는 “학습” 대신 아래 표현을 쓴다.

- 현장 개선 이력 메모리
- 근거 기반 재사용
- 유사 SIF 사례 매칭
- 운영 지식 베이스 갱신 후보

기술적으로는 `lib/workpack-learning-export.ts`가 workpack, reference, improvement, ack 이벤트를 MD/JSONL로 내보내는 구조를 제공한다. 파인튜닝은 하지 않는다.

## 다음 승인 후 실행 명령

승인 전에는 실행하지 않는다.

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --upload --approved-upload
```

이 명령은 migration 적용, `OPENAI_API_KEY`, Supabase service role 설정이 모두 확인된 뒤에만 실행한다.
