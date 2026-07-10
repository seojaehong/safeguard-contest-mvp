# KOSHA GUIDE Supabase / 최신화 / 임베딩 후보 독립 감사

- 감사일: 2026-07-10 KST
- 기준 커밋: `596ea1447702b4b13cf06f3b6014e7cb5e87e883`
- 브랜치: `audit/kosha-guide-embedding`
- DB 접근: Supabase REST/RPC 읽기 전용
- 공식 현황: 산업안전포털 공개 화면 및 공개 조회 API 읽기 전용
- DB mutation, schema 변경, migration 적용, embedding 생성·업로드: 미실행

## 결론

**판정: 조건부 채택.**

KOSHA GUIDE는 SIF 다음 embedding 후보로 가치가 높다. 공식 현행 목록 1,039개 규정의 안정 식별자(stable key)는 DB에서 모두 대응된다. 다만 현재 DB 1,040건 중 818건은 `body`가 비어 있고, 822건은 11개 정형 요약 문구 중 하나를 재사용한다. 공식 URL, 파일 ID, 상태, 실제 공표일도 저장하지 않는다. 이 상태를 그대로 임베딩하면 “원문 검색”이 아니라 제목·분야·추론형 controls를 임베딩하는 셈이다.

채택 조건은 다음과 같다.

1. 공식 현행 1,039건과 폐지 683건을 stable key로 재동기화하고, 폐지 문서를 active 검색에서 제외한다.
2. 현행 1,039건의 공식 파일 URL·파일 ID·공표일·상태·원문 hash를 저장한다.
3. 원문이 없는 818건을 보강하고 OCR/추출 실패를 일반 corpus에서 격리한다.
4. SIF용 1문서 1벡터 migration 후보를 그대로 적용하지 않고 KOSHA 문서의 다중 chunk를 수용하도록 수정한 뒤 별도 승인을 받는다.
5. SIF와 KOSHA GUIDE를 같은 무필터 vector pool에 섞지 않는다. 같은 물리 테이블을 쓰더라도 `corpus_kind`와 partial index/RPC를 분리한다.

## 감사 방법과 안전 경계

- credential은 지정된 `backend-harness-gate/.env.local`을 프로세스 환경에만 적재했다. 값은 출력·복사·커밋하지 않았다.
- Supabase는 `GET` 및 검색용 read-only `POST /rpc/...`만 호출했다.
- 공식 KOSHA는 공개 페이지와 공개 목록 API만 조회했다.
- 기존 `scripts/sif_embedding_runtime_probe.mjs`를 임시 출력 경로로 재사용했다.
- 새 probe 스크립트는 만들지 않았다.
- 최종 수치는 `evaluation/2026-07-10-kosha-guide-supabase-audit-report.json`과 동일한 마지막 통합 probe 기준이다.

## 1. Repo schema와 live Supabase 대조

### 1.1 실제 테이블과 필드

`supabase/migrations/004_safety_reference_catalog.sql`은 다음 세 테이블을 정의한다.

- `safety_reference_sources`: source 단위의 `id`, `source_group`, `source_type`, `agency`, `title`, `source_path`, `origin_url`, `file_format`, `published_at`, `metadata`.
- `safety_reference_items`: item 단위의 `id`, `source_id`, `item_type`, `category`, `subcategory`, `title`, `summary`, `body`, `keywords`, `risk_tags`, `primary_documents`, `controls`, `payload`.
- `safety_reference_ingestion_runs`: batch별 count, elapsed, status, details.

상태 판정에 필요한 `published/draft/review_state/active` 컬럼은 source/item에 없다. item별 공식 URL이나 공식 파일 ID 전용 컬럼도 없다. 세 테이블의 공개 select RLS는 `using (true)`다 (`004_safety_reference_catalog.sql:58-72`).

### 1.2 live 전체 분포

| 구분 | live count |
|---|---:|
| `safety_reference_sources` | 1,063 |
| `safety_reference_items` | 9,920 |
| `safety_reference_ingestion_runs` | 2 |
| `source_group=kosha-reference` sources | 6 |
| 위 6개 KOSHA source의 items | 8,431 |

KOSHA source별 분포:

| source_id | item_type | count | published_at | origin_url |
|---|---|---:|---|---|
| `kosha-sif-archive-20260401` | `sif-case` | 6,033 | 2026-04-01 | 없음 |
| `kosha-technical-support-regulations-2025` | 아래 2종 | 1,040 | 2025-01-01 | 없음 |
| `kosha-machinery-20210909` | `machinery` | 730 | 2021-09-09 | 없음 |
| `kosha-construction-process-20210910` | `construction-process` | 626 | 2021-09-10 | 없음 |
| `kosha-risk-assessment-approach-manual` | `risk-manual` | 1 | 없음 | 없음 |
| `kosha-jsa-training-deck` | `jsa-training` | 1 | 없음 | 없음 |

### 1.3 KOSHA GUIDE가 들어간 위치

KOSHA GUIDE 후보는 전부 아래 한 source에 있다.

- table: `safety_reference_items`
- `source_id`: `kosha-technical-support-regulations-2025`
- source title: `기술지원규정 및 안전보건 기술지침 묶음`
- source type: `zip-folder`
- source path: 로컬 Downloads 폴더
- item count: 1,040
- DB 생성·갱신 시각: 2026-05-02에 집중

`item_type` 분포:

| item_type | count | body 없음 | parsedPages=0 |
|---|---:|---:|---:|
| `technical-guideline` | 803 | 803 | 803 |
| `technical-support-regulation` | 237 | 15 | 0 |
| 합계 | 1,040 | 818 | 803 |

분야 분포:

| category | count |
|---|---:|
| 화학안전분야 | 234 |
| 산업위생분야 | 174 |
| 기계안전분야 | 138 |
| 전기안전분야 | 95 |
| 산업안전일반분야 | 84 |
| 산업보건일반분야 | 83 |
| 산업의학분야 | 81 |
| 건설안전분야 | 76 |
| 산업독성분야 | 44 |
| 리스크관리분야 | 31 |

제목/ID에서 추출한 연도 범위는 2010~2026이다. 2026 표기 항목은 175건이다. source의 `published_at=2025-01-01` 한 값만으로 이 문서별 범위를 표현하고 있어 source-level 날짜는 신뢰 가능한 최신성 키가 아니다.

### 1.4 누락과 품질

| 항목 | 누락/이슈 |
|---|---:|
| source `origin_url` | 1/1 누락 |
| item URL field | schema에 없음 |
| `body` | 818/1,040 누락 |
| `summary` | 빈 값 0, 그러나 정형 중복 822건 |
| `keywords` | 빈 값 0 |
| `risk_tags` | 764건 빈 배열 |
| `controls` | 빈 값 0, 고유 조합은 20개뿐 |
| `primary_documents` | 빈 값 0, 고유 조합은 8개뿐 |
| item 상태 | schema/payload 모두 없음 |
| 공식 파일 ID·seq | 없음 |

`controls`와 `primary_documents`가 모두 채워졌다는 사실은 원문 품질을 뜻하지 않는다. ingester가 제목/추출문에 정규식 키워드를 적용해 생성한다 (`scripts/ingest_safety_reference_catalog.py:118-139`, `:431-434`). 가장 흔한 controls 조합인 “작업 전 유해·위험요인 확인 / 관리감독자 확인 후 작업 시작”은 668건에 반복된다.

중복 후보:

- normalized title 중복은 검출되지 않았다.
- 동일 `body` hash 후보 4건은 PDF 추출 실패/보일러플레이트 가능성이 있어 원문 재확인이 필요하다.
- 822건이 11개 정형 summary 문구에 몰려 있다. 문서 중복이라기보다 빈 본문을 일반 문구로 덮은 품질 문제다.
- 공식 폐지 문서 `W-14-2022 경고표지 작성 지침` 1건이 DB current 후보에 남아 있다.

### 1.5 published/draft 상태

DB에서는 판정 불가다.

- source/item schema에 상태 컬럼이 없다.
- GUIDE item payload에도 상태 관련 값이 없다.
- 따라서 공개 검색은 현행·폐지·draft를 DB 차원에서 구분할 수 없다.
- 공식 API는 현행 1,039건과 폐지 683건을 분리해 제공하므로 이 값을 ingest provenance에 보존해야 한다.

## 2. 공식 KOSHA 현재 목록과 최신성

### 2.1 1차 출처

- [산업안전포털 KOSHA GUIDE 전체 조회](https://portal.kosha.or.kr/archive/resources/tech-support/search/all?page=1&rowsPerPage=10)
- [산업안전포털 KOSHA GUIDE 안내](https://portal.kosha.or.kr/archive/resources/tech-support/guide/overview)
- [공개 목록 API](https://portal.kosha.or.kr/api/portal24/bizV/p/VCPDG08009/selectList) - `POST`, 공개 화면이 사용하는 endpoint
- [A-G-12-2026 공식 PDF](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012909222643246624/1)
- [A-G-20-2026 공식 PDF](https://portal.kosha.or.kr/openapi/v1/file/down/CTC2026012910001894276482/1)

현행 목록 probe body의 핵심은 `techGdlnSttsSeCdIng=1`, `techGdlnSttsSeCdDel=0`, `page`, `rowsPerPage`다. 폐지 목록은 두 상태 플래그를 반대로 조회했다. endpoint 응답에는 규정번호, 제목, 분야, 공표일, 제정/개정/폐지 상태, 공식 파일 ID와 seq가 포함된다.

### 2.2 공식 live 현황

| 구분 | count |
|---|---:|
| 현행 | 1,039 |
| 폐지 | 683 |
| 현행 중 제정 | 280 |
| 현행 중 개정 | 759 |
| 가장 이른 현행 공표일 | 2010-08-31 |
| 최신 공표일 | 2026-01-30 |
| 최신 공표일의 제·개정 건 | 175 |

최신 목록의 예시는 `C-C-11-2026 공정용 안전밸브`, `B-M-15-2026 고온 염색기`, `E-G-18-2026 밀폐공간 작업프로그램`, `A-G-18-2026 항만하역작업`이다. 모두 2026-01-30 공표로 반환됐다.

### 2.3 DB 최신성 대조

| 비교 기준 | 결과 |
|---|---:|
| 공식 현행 stable key | 1,039 |
| DB에서 대응되는 stable key | 1,039 |
| 공식 규정번호까지 정확히 일치 | 1,032 |
| 같은 stable key이나 연도 표기가 다른 항목 | 7 |
| 공식 현행 stable key 누락 | 0 |
| DB에만 current처럼 남은 폐지 항목 | 1 |

연도 표기 불일치 7건:

| stable key | 공식 | DB |
|---|---|---|
| `B-M-7` | `B-M-7-2025` | `B-M-7-2026` |
| `C-C-83` | `C-C-83-2020` | `C-C-83-2026` |
| `W-26` | `W-26-2023` | `W-26-2022` |
| `A-48` | `A-48-2021` | `A-48-2018` |
| `A-46` | `A-46-2021` | `A-46-2018` |
| `D-61` | `D-61-2018` | `D-61-2017` |
| `M-91` | `M-91-2012` | `M-91-2011` |

DB-only 1건은 공식 폐지 683건에서 확인된 `W-14-2022 경고표지 작성 지침`이다.

**최신성 판정:** 목록 정체성 기준으로는 공식 현행을 모두 포함하지만, 정확한 버전·상태·공표일·공식 파일 provenance 기준으로는 최신이라고 승인할 수 없다. 특히 code가 동일성 키와 version 키 역할을 동시에 하도록 저장돼 7건의 불일치를 만들고, 폐지 1건을 active 후보에서 제거할 방법이 없다.

### 2.4 증분 최신화 가능성

공식 endpoint에는 pagination, 시작/종료일, 현행/폐지 필터가 있어 **기술적으로 가능**하다. 다만 안전한 증분은 단순 신규 append가 아니다.

권장 동기화 키:

- `stable_document_key`: 규정번호에서 마지막 연도를 제거하고 선행 0을 정규화한 값. 예: `E-G-18`.
- `official_version_code`: 공식 응답의 전체 규정번호. 예: `E-G-18-2026`.
- `official_file_key`: `techGdlnOrgnlAtcflNo` + `techGdlnOrgnlAtcflNoSeq`.
- `content_hash`: 다운로드한 공식 파일 bytes의 SHA-256.

권장 흐름:

1. `startDt` 이후 현행·폐지 목록을 각각 페이지네이션한다.
2. 빈 list/빈 파일 ID/빈 다운로드를 저장하지 않고 실패로 남긴다.
3. stable key별 공식 version과 file key를 기존 snapshot과 비교한다.
4. 변경 문서만 다운로드·hash·추출한다.
5. dry-run에서 insert/update/retire/unchanged를 분리한다.
6. 승인 후 upsert하고, 주기적으로 전체 현행 1,039 stable key reconciliation을 수행해 누락된 폐지를 잡는다.

## 3. ingest/update/search 파이프라인 판정

| 요구 | 판정 | 코드 근거와 이유 |
|---|---|---|
| 증분 저장 | 미지원 | `ingest_safety_reference_catalog.py`는 로컬 ZIP 전체를 매번 순회하고 기존 DB snapshot/ETag/공표일 checkpoint를 읽지 않는다 (`:380-446`). |
| stable key | 미지원 | item ID가 `zip_index + file_index + slug(title)`라 ZIP 순서·파일명 변경에 흔들린다 (`:394-423`). 공식 stable key/file key를 쓰지 않는다. |
| empty response filter | 미지원 | 비우선 문서는 애초에 text 추출을 하지 않고 빈 body와 일반 summary를 정상 item으로 만든다 (`:403-430`). PDF 추출 실패도 item 생성을 계속한다 (`:409-418`). |
| retry/timeout | 부분 지원 | Supabase upsert timeout 60초는 있으나 retry가 없다 (`:454-478`). 공식 GUIDE API adapter 자체가 없다. runtime query embedding은 20초 timeout과 1회 재시도가 있으나 ingest와 별개다 (`lib/safety-reference-catalog.ts:1067-1127`). |
| provenance | 부분 지원 | ZIP명, 내부 경로, 파일 크기, page count, OCR 필요 여부는 payload에 남긴다 (`ingest...py:435-444`). 공식 URL, 파일 ID/seq, 공표일, 상태, checksum, fetched_at은 없다. |
| upsert | 부분 지원 | `on_conflict=id` merge upsert는 지원한다 (`ingest...py:454-478`). 그러나 ID가 stable하지 않고 retire/delete reconciliation이 없다. |
| dry-run | 부분 지원 | 기본 실행은 seed/report만 만들고 `--upload` 때만 쓴다 (`:488-570`). 별도 prepare 스크립트는 review-only SQL을 만든다 (`prepare_supabase_safety_ingestion.py:628-672`). 하지만 live diff 기반 insert/update/retire plan은 없고 `execute_safety_reference_upsert.py`는 실행 즉시 write한다 (`:243-280`). |
| search fallback | 지원 | ranked RPC 실패 시 REST ilike로 fallback한다 (`lib/safety-reference-catalog.ts:1288-1382`). |
| vector gate | 준비만 됨 | feature flag 기본 off, query embedding timeout/retry, ranked+vector merge 코드는 있다 (`lib/safety-reference-catalog.ts:138-194`, `:1067-1238`). live table/RPC는 404다. |

추가 위험:

- `EXPECTED_TECHNICAL_TOTAL=1040`가 코드에 고정돼 있다 (`lib/safety-reference-catalog.ts:109-113`). 공식 현행은 1,039건이므로 폐지 `W-14-2022`를 포함한 현재 DB가 오히려 `technicalSplitOk=true`가 되는 false-green 구조다 (`:1467-1490`).
- 현재 ranked RPC는 작동하지만 `밀폐공간 작업` 10건 probe가 KOSHA 2건, SIF 5건, 사내 문서 3건을 한 pool에서 반환했다. corpus 라우팅 없이 그대로 vector까지 합치면 근거 역할이 섞인다.
- ingester test는 SIF 반복 header 한 사례만 다룬다. GUIDE stable key, empty body, official status reconciliation, retry, dry-run diff 테스트는 없다 (`scripts/tests/test_ingest_safety_reference_catalog.py`).

## 4. Embedding 후보 설계

### 4.1 SIF와의 분리 원칙

**별도 논리 index를 권장한다.**

- SIF는 사고 사례 한 건이 검색 단위다.
- KOSHA GUIDE는 긴 규정 문서의 section/chunk가 검색 단위다.
- SIF는 “유사 사고”, GUIDE는 “권고 조치와 기술 기준”이라는 근거 역할이 다르다.
- 동일 물리 테이블을 사용해도 `corpus_kind=sif-case|kosha-guide`, 별도 partial HNSW index, 별도 RPC를 둔다.
- 최종 answer assembly에서 SIF 사례와 KOSHA 규정을 함께 제시하되, 한 vector top-k에서 경쟁시키지 않는다.

### 4.2 corpus와 chunking

Corpus 단위:

- 현행 공식 규정 version 1개를 parent document 1개로 저장한다.
- 폐지 version은 audit/history에 보존하되 active retrieval에서 제외한다.
- parent는 stable key를 유지하고 version code/file key/content hash가 바뀔 때 새 version으로 갱신한다.

Chunking:

- PDF 목차/번호 heading을 이용한 section-aware chunking.
- 권장 chunk 크기: 700~900 tokens, overlap 100 tokens 이내.
- “목적/적용범위/용어/법적 필수사항/위험요인/조치/점검/교육” section path를 metadata에 보존한다.
- 표는 header와 행 묶음을 함께 유지한다. 페이지 경계만으로 자르지 않는다.
- 현재 SIF 구현의 `slice(0, 6000)` 1문서 1벡터 방식은 GUIDE에 적용하지 않는다 (`lib/sif-embedding-corpus.ts:75-112`).

### 4.3 필수 metadata

- `corpus_kind`, `reference_item_id`, `stable_document_key`, `official_version_code`
- `official_status`(current/retired), `change_state`(제정/개정/폐지), `published_at`
- `official_file_id`, `official_file_seq`, `official_url`
- `source_id`, `category`, `field_code`, `title`
- `chunk_index`, `section_path`, `page_start`, `page_end`
- `content_hash`, `document_hash`, `parser_version`, `extraction_method`, `needs_ocr`, `fetched_at`
- `keywords`, `controls`, `primary_documents`는 derived metadata로 표시하고 원문과 구분한다.

### 4.4 embedding table 연계와 승인 migration

현재 승인 후보 `evaluation/sif-embedding-gate/sif-embedding-only-migration.sql`은 `unique(reference_item_id, embedding_model)`이라 문서당 여러 chunk를 저장할 수 없다. live DB에는 이 table과 RPC가 아직 없다.

승인 전 migration 후보를 다음처럼 수정해야 한다.

1. `vector` extension 생성.
2. chunk row를 저장할 `safety_reference_embedding_chunks` 또는 확장된 `safety_reference_embeddings` 생성.
3. `reference_item_id` FK, `corpus_kind`, `chunk_index`, `chunk_text`, `content_hash`, `embedding_model`, `embedding vector(1536)`, provenance metadata 추가.
4. unique key를 `(reference_item_id, corpus_kind, chunk_index, embedding_model, content_hash)`로 설계.
5. SIF와 GUIDE용 partial HNSW index를 분리.
6. `match_sif_embeddings`와 `match_kosha_guide_chunks` RPC를 분리하고 current GUIDE만 반환.
7. raw vector는 public select 금지, server-side service role만 사용.
8. parent document가 retired되거나 hash가 바뀐 경우 old chunk를 active retrieval에서 제외하는 상태 컬럼/조건 추가.

이 변경은 schema migration이므로 사용자 명시 승인 전 적용하면 안 된다. 이번 감사에서는 후보만 정의했고 SQL 작성·적용은 하지 않았다.

### 4.5 retrieval과 rerank

1. query router가 SIF, KOSHA GUIDE, 양쪽 중 어느 corpus가 필요한지 결정한다.
2. GUIDE 경로는 규정번호 exact match + title/FTS ranked + vector chunk를 병렬 조회한다.
3. 현행 상태, exact code/title, 분야 일치, section 적합성, 공식 원문 존재 여부를 deterministic rerank 신호로 쓴다.
4. 동일 규정은 상위 chunk를 2개 이하로 제한하고 parent 단위로 dedupe한다.
5. 최종 근거에는 공식 규정번호, 제목, 공표일, section, 공식 PDF URL을 반드시 포함한다.
6. vector/RPC 실패 시 현재 ranked/REST fallback을 유지하되 폐지 문서는 동일하게 차단한다.

### 4.6 품질 gate

Embedding 비용 승인 전:

- 공식 현행 stable key 1,039개가 DB active parent 1,039개와 일치.
- 공식 폐지 683개가 active retrieval에서 0건.
- 공식 규정번호 불일치 0건, stale DB current 0건.
- 현행 parent의 공식 URL/file ID/published_at/status 누락 0건.
- 빈 body, 정형 summary-only, 빈 chunk 0건.
- OCR 필요 문서는 OCR 완료 또는 quarantine 상태로만 존재.
- document/chunk content hash 중복 후보를 review artifact에 기록.
- 고정 질의셋에서 기대 규정번호가 반환되고, 폐지 규정은 반환되지 않음.
- 모든 결과 citation이 공식 파일 다운로드로 열림.

업로드 승인 후:

- manifest chunk count와 embedding row count가 일치.
- 모델/차원/content hash가 manifest와 일치.
- SIF-only, GUIDE-only, combined evidence assembly를 각각 검증.
- feature flag는 위 검증이 끝난 뒤 별도 승인으로 활성화.

### 4.7 비용과 운영 위험

현재 1,040개 placeholder item의 제목·요약·본문·배열 문자열은 약 737,249자, 거친 추정 약 368,625 tokens다. 현재 공식 `text-embedding-3-small` 가격은 1M input tokens당 USD 0.02이므로 이 불완전 corpus 1회 embedding 비용은 USD 0.01 미만이다. [공식 모델 가격](https://developers.openai.com/api/docs/models/text-embedding-3-small)

그러나 이 수치는 818개 빈 body 때문에 실제 전체 GUIDE 비용을 과소평가한다. 전체 PDF 추출 후 tokenizer 기반 token manifest를 다시 만들고 비용 승인을 받아야 한다. 운영 비용은 최초 embedding보다 다음이 더 중요하다.

- 1,039개 전체 파일 download/OCR/section parsing
- version 변경분 재임베딩과 old chunk retirement
- HNSW storage/index 유지
- 매 query embedding 호출과 timeout/retry
- 공식 endpoint schema 변경 감시
- 저작물 이용조건과 citation 유지

OpenAI embedding API는 입력별 token 한도와 batch 전체 token 한도가 있으므로 chunk/batch manifest가 필요하다. [공식 Embeddings API](https://platform.openai.com/docs/api-reference/embeddings)

## 5. Blocker와 후속 승인 항목

현재 blocker:

1. live DB에 `safety_reference_embeddings`와 `match_safety_reference_embeddings`가 없어 둘 다 404다.
2. 818개 GUIDE item의 body가 비어 있다.
3. 공식 상태/URL/file ID/published_at provenance가 없다.
4. 폐지 1건이 active 후보에 남고 code version 7건이 공식값과 다르다.
5. 현재 `EXPECTED_TECHNICAL_TOTAL=1040` gate가 공식 현행 count와 충돌한다.
6. 공식 조회 endpoint는 공개 화면에서 사용되지만 별도 안정성 계약을 확인하지 못했으므로 adapter contract test와 schema-change 경보가 필요하다.

승인이 필요한 작업:

- 공식 current/retired sync를 위한 DB field/table migration
- chunk-level embedding table/RPC/index migration
- OpenAI embedding 비용 발생 실행
- Supabase embedding upsert
- 검증 후 vector feature flag 활성화

이번 감사에서는 위 작업을 하나도 실행하지 않았다.

## 6. 실행 증거와 명령

핵심 명령 형태:

```powershell
git status --short --branch
git rev-parse HEAD
rg -n -i "safety_reference|embedding|primary_documents|source_id|item_type" supabase lib scripts tests
node scripts/sif_embedding_runtime_probe.mjs --output "$env:TEMP\2026-07-10-kosha-sif-runtime-probe.json" --env-file "...\backend-harness-gate\.env.local"
npx.cmd --yes --package @playwright/cli playwright-cli -s=kosha open https://portal.kosha.or.kr/
npx.cmd --yes --package @playwright/cli playwright-cli -s=kosha requests
```

Supabase/공식 API 통합 probe는 PowerShell 프로세스에서 env를 읽고 inline Node로 실행했다. secret은 출력하지 않았다. 마지막 통합 probe 결과:

- `item_count=1040`
- `success_count=1040`
- `failure_count=0`
- `elapsed_seconds=11.581`
- `read_only=true`

상세 JSON: `evaluation/2026-07-10-kosha-guide-supabase-audit-report.json`

검증 결과:

- `npm.cmd test -- tests/safety-reference-hybrid.test.ts`: 16/16 통과
- `python -m unittest scripts.tests.test_ingest_safety_reference_catalog`: 1/1 통과
- `git diff --check`: 통과
