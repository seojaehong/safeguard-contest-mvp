# SIF Embedding Approval Packet

Generated: 2026-07-09T11:00:46.545Z
Gate: apply-sif-only-migration

## Current State

- Verdict: 코퍼스 준비 · 임베딩 미실행
- Answer: SIF 코퍼스 6,032건은 준비됐지만, 임베딩 생성과 DB 업로드는 아직 실행되지 않았습니다.
- Next action: SIF-only migration SQL을 승인 후 적용합니다.
- DB mutation performed: no
- Full embedding generated: no
- DB upload verified: no
- Vector search usable: no
- Model fine-tuning performed: no

## Corpus

- SIF source items: 6,033
- Embedding corpus: 6,032
- Skipped rows: 1
- Batch count: 61
- Embedding model: text-embedding-3-small
- Embedding dimensions: 1,536
- Corpus hash: 2712c6eafd24962588293749bb12d249cf761972dcdea7b249f16efea76b8f3e

## Required Decision

1. Approve and apply the SIF-only embedding migration, or explicitly choose the broader 010_commercial_operations.sql gate.
2. Confirm OPENAI_API_KEY and Supabase service role are available in the execution environment.
3. Run embedding generation only with --embed --approved-embedding.
4. Run embedding upload only with --embed --approved-embedding --upload --approved-upload.
5. Verify uploaded row count equals 6032 before enabling SAFETY_REFERENCE_VECTOR_SEARCH=1.
6. Enable runtime vector retrieval after RPC smoke test passes.

## Required Artifacts

- Preflight report: `evaluation\sif-embedding-gate\report.json` (코퍼스 수량, 품질 게이트, 승인 보류 상태를 확인합니다.)
- Batch manifest: `evaluation\sif-embedding-gate\sif-embedding-batch-manifest.json` (임베딩 배치 수량과 corpus hash를 고정합니다.)
- SIF corpus JSONL: `evaluation\sif-embedding-gate\sif-embedding-corpus.jsonl` (임베딩 입력 원문과 SIF 레코드 매핑을 검토합니다.)
- SIF-only migration: `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql` (운영 DB에 필요한 table, RPC, index 범위만 승인합니다.)

## Safety Locks

- 승인 전 실행 보류: locked - 명시 승인 전 command 실행을 보류합니다.
- DB 변경 없음: locked - 현재 패키지는 DB mutation 없이 준비됐습니다.
- 임베딩 미생성: locked - 비용 발생 단계는 아직 실행되지 않았습니다.
- 업로드 미수행: locked - DB upsert는 승인 전 보류 상태입니다.
- Vector 검색 잠금: locked - 임베딩 생성과 DB 업로드가 승인 전 보류되어 있으므로 vector 검색은 꺼진 상태를 유지합니다.

## Preflight Checks

- pass: SIF 원본과 코퍼스 수량 확인 (itemCount: 6033 · skippedCount: 1 · corpusCount: 6032)
- pass: 배치 manifest와 보고서 일치 (manifestRecordCount: 6032 · reportCorpusCount: 6032 · manifestBatchCount: 61)
- pass: JSONL 코퍼스 라인 수 확인 (corpusLineCount: 6032 · reportCorpusCount: 6032)
- pass: 빈 텍스트/관리대책/중복 품질 게이트 (emptyEmbeddingTextCount: 0 · missingControlsCount: 0 · missingPrimaryDocumentsCount: 0)
- pass: 승인 전 임베딩 미생성 (embeddedCount: 0 · uploadedCount: 0 · vectorsPath: null)
- pass: 임베딩 비용 승인 플래그 필요 (scriptPath: scripts/prepare_sif_embedding_corpus.mjs)
- pass: 업로드 승인 플래그 필요 (scriptPath: scripts/prepare_sif_embedding_corpus.mjs)
- pass: migration에 table/RPC/index 포함 (migrationPath: evaluation/sif-embedding-gate/sif-embedding-only-migration.sql)
- pass: 임베딩은 서버 측에서만 조회 (table: safety_reference_embeddings · publicSelect: false)
- pass: SIF-only migration 범위 확인 (migrationPath: evaluation/sif-embedding-gate/sif-embedding-only-migration.sql · sifOnly: true)
- pass: 업로드 검증 전 vector flag 잠금 (vectorFeatureFlagEnabled: false · uploadedCount: 0 · corpusCount: 6032)

## Runtime DB Probe

- Status: migration-required
- Table ready: no
- RPC ready: no
- Message: SIF embedding table/RPC is not ready on the target DB. Apply approved migration before upload.

## Vision/OCR Harness Path

- Initial field photos: multipart `photos` to `/api/input-photos/hazard-analysis`, up to 10 files
- Photo hazards are reviewable candidates, not final facts.
- Only user-accepted candidates enter the DB harness improvement memory.
- Before/After improvements: `/api/workpacks/[id]/improvements` with vision/OCR payload
- OCR text, detected hazards, observed improvement, source photo names, and reflected documents are exported to the workpack learning corpus.

## Held Command

Do not run before the required approval gate passes.

```powershell
npm.cmd run knowledge:sif-embedding-corpus -- --embed --approved-embedding --upload --approved-upload
```
