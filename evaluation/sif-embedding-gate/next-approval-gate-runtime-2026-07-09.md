# SIF Embedding Next Approval Gate Runtime Check

Generated: 2026-07-09
Rechecked: 2026-07-09 19:36 KST

## 결론

SIF 코퍼스 준비는 완료됐다. 실제 운영 DB 임베딩 검색은 아직 준비되지 않았다.

- 운영 DB `safety_reference_items`: 6,033건 확인
- SIF embedding corpus: 6,032건 준비
- OpenAI embedding canary: 3건 생성 성공
- full OpenAI embedding: 미실행
- execution env: `.env.local` 로드, OpenAI key와 Supabase service role 확인
- DB upload: 0건
- 운영 DB `safety_reference_embeddings`: 없음
- 운영 DB `match_safety_reference_embeddings`: 없음
- `SAFETY_REFERENCE_VECTOR_SEARCH`: 비활성
- `/settings/ai-connect` API/UI: `learningLifecycle` 필드로 "코퍼스 준비 · 임베딩 전"을 직접 노출

따라서 다음 순서는 **DB migration 승인 → embedding upload 승인 → row count/RPC smoke → feature flag enable** 이다.

## 왜 아직 "학습 완료"가 아닌가

여기서 말하는 학습은 모델 파인튜닝이 아니다. 현재 구조는 아래 순서다.

1. SIF/KOSHA/개선 이력을 재생성 가능한 corpus로 정리한다.
2. corpus를 embedding으로 바꿔 DB에 저장한다.
3. 문서 생성 전에 DB harness가 유사 SIF/KOSHA 근거를 먼저 고정한다.
4. LLM은 고정된 근거를 문장화한다.

현재 1번은 완료, 2번은 canary 성공이며 전체 6,032건 embedding과 운영 DB 업로드는 승인 전이다. 2026-07-09 19:36 KST 재검증 기준 실행환경은 준비됐지만, 운영 DB의 table/RPC가 아직 없으므로 migration 승인이 먼저다.

`/api/sif-embedding-gate/status`는 이제 아래 lifecycle을 함께 내려준다.

- productTerm: `retrieval_embedding_index`
- label: `코퍼스 준비 · 임베딩 전`
- modelFineTuningPerformed: `false`
- corpusPrepared: `true`
- fullEmbeddingGenerated: `false`
- dbUploadVerified: `false`
- vectorSearchUsable: `false`
- nextGate: `apply-sif-only-migration`

## Evidence

### Corpus Gate

Source:

- `evaluation/sif-embedding-gate/report.json`
- `evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl`
- `evaluation/sif-embedding-gate/sif-embedding-batch-manifest.json`

Facts:

- itemCount: 6,033
- skippedCount: 1
- skipped reason: spreadsheet header
- corpusCount: 6,032
- batchCount: 61
- batchSize: 100
- embeddingModel: `text-embedding-3-small`
- embeddingDimensions: 1,536
- emptyEmbeddingTextCount: 0
- missingControlsCount: 0
- missingPrimaryDocumentsCount: 0
- duplicateContentHashCount: 0

### OpenAI Embedding Canary

Source:

- `evaluation/sif-embedding-canary-2026-07-09/report.json`
- `evaluation/sif-embedding-canary-2026-07-09/sif-embedding-vectors.jsonl`

Command:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --limit 4 --embed --approved-embedding --output-dir evaluation/sif-embedding-canary-2026-07-09
```

Facts:

- itemCount: 4
- skippedCount: 1
- corpusCount: 3
- embeddedCount: 3
- uploadedCount: 0
- uploadError: null
- mode: `embed-only`

This proves the OpenAI embedding runtime works for the approved model and dimension.

### Runtime DB Probe

Source:

- `evaluation/sif-embedding-gate/runtime-db-probe.json`

Command:

```powershell
npm.cmd run knowledge:sif-embedding-runtime-probe -- --output evaluation/sif-embedding-gate/runtime-db-probe.json
```

Facts:

- `safety_reference_items`: ok, count 6,033
- `safety_reference_embeddings`: 404, table missing
- `match_safety_reference_embeddings`: 404, RPC missing
- status: `migration-required`
- dbMutationPerformed: false

### Execution Environment

Source:

- `evaluation/sif-embedding-gate/approval-preflight-report.json`

Command:

```powershell
npm.cmd run knowledge:sif-embedding-preflight -- --require-execution-env --output evaluation/sif-embedding-gate/approval-preflight-report.json
```

Facts:

- `OPENAI_API_KEY`: present
- Supabase URL: present
- Supabase service role: present
- `SAFETY_REFERENCE_VECTOR_SEARCH`: off
- executionReadyAfterApproval: true
- embeddingGenerated: false
- uploaded: false
- migrationPath: `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`
- failedCheckIds: none
- SIF-only scope check: passed

### Vision/OCR Harness Path

Source:

- `app/api/input-photos/hazard-analysis/route.ts`
- `lib/photo-vision-analysis.ts`
- `lib/operation-improvements.ts`
- `app/api/workpacks/[id]/improvements/route.ts`
- `tests/photo-vision-analysis.test.ts`
- `tests/operation-improvements.test.ts`

Facts:

- 초기 입력 사진은 multipart `photos` 배열로 최대 10장까지 받는다.
- `/api/input-photos/hazard-analysis`는 OpenAI Responses vision 호출로 위험요인 후보, OCR 텍스트, siteSignals를 만든다.
- 사용자가 채택한 사진 위험요인만 `buildAcceptedHazardPhotoHarnessImprovements`를 통해 DB harness improvement memory로 전달된다.
- 문서 생성 후 Before/After 개선 사진은 workpack improvement API에서 `analyzeImprovementPhotos`를 호출한다.
- 분석 결과는 `analysis_payload`에 `visionStatus`, `analysisMode`, `detectedHazards`, `observedImprovement`, `ocrText`, `sourcePhotoNames`, `photoCount`, `siteSignals`로 저장/export된다.
- Vision/OCR 후보는 자동 확정 사실이 아니라 `reviewable candidate`이며, 사용자가 채택해야 위험성평가/TBM 하네스에 들어간다.

## SIF-only Migration Proposal

Source:

- `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`

This is intentionally narrower than `supabase/migrations/010_commercial_operations.sql`.
It includes only:

- `vector` extension
- `safety_reference_embeddings`
- reference and HNSW cosine indexes
- `match_safety_reference_embeddings` RPC
- RLS enabled
- public select blocked with `using (false)`

Share sessions, read confirmations, improvement photos, and workpack JSONB columns should stay in the commercial operations migration gate.

## Approval Sequence

Do not enable runtime vector search until all steps pass.

1. Approve and apply `sif-embedding-only-migration.sql` or an equivalent production migration.
2. Run read-only probe again.
3. Run upload:

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload
```

4. Verify uploaded row count equals 6,032.
5. Run `match_safety_reference_embeddings` smoke with a real query embedding.
6. Set `SAFETY_REFERENCE_VECTOR_SEARCH=1`.
7. Verify `/workspace` generation reports `hybrid-vector-rpc` in the harness evidence path.

## Current Decision

Proceeding to full upload before migration would fail. The correct next approval is **DB migration approval for the SIF-only runtime surface**, not the 6,032-row upload yet.
