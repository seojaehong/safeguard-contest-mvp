# SIF Archive XLSX Analysis

## Scope

- Source file: `C:\Users\iceam\Downloads\한국산업안전보건공단_산업재해 고위험요인(SIF) 아카이브_20260401.xlsx`
- 담당 범위: 한국산업안전보건공단 산업재해 고위험요인(SIF) 아카이브 XLSX 구조 분석 및 SafeClaw/SafeGuard knowledge seed 반영 설계
- 작성일: 2026-05-02
- Repo target: `C:\Users\iceam\dev\safeguard-contest-mvp`
- Output file: `evaluation/data-ingestion/sif-analysis.md`

## Workbook Structure

| Sheet | Role | Header Rows | Data Rows | Notes |
| --- | --- | ---: | ---: | --- |
| `개요` | 표지/개요 이미지성 시트 | 없음 | 0 | `openpyxl` 기준 셀 텍스트가 비어 있음. WMF 이미지는 파서에서 drop warning 발생. |
| `아카이브(제조업등)` | 건설업 외 SIF 사례 | row 3 | 2,573 | row 1은 제목, row 2는 blank, row 4부터 데이터. |
| `아카이브(건설업)` | 건설업 SIF 사례 | row 3-4 | 3,459 | row 3-4가 병합 헤더. row 5부터 데이터. |

Total normalized case rows: 6,032.

## Sheet Columns

### 아카이브(제조업등)

| Excel Column | Source Header | Proposed Field | Null Count | Unique Count | Notes |
| --- | --- | --- | ---: | ---: | --- |
| B | `연번` | `source_serial_no` | 0 | 2,573 | 1부터 2,573까지 연속. |
| C | `산재업종(대분류)` | `industry_major` | 0 | 9 | 건설업 외 업종 대분류. |
| D | `산재업종(중분류)` | `industry_mid` | 0 | 30 | 업종 중분류. |
| E | `산재업종(소분류)` | `industry_minor` | 0 | 164 | 업종 소분류. |
| F | `재해개요` | `accident_summary` | 0 | 2,573 | 연월/현장/작업/결과가 한 문장에 포함됨. |
| G | `기인물` | `source_object` | 0 | 626 | 설비, 장비, 물질, 구조물 등. |
| H | `고위험작업·상황` | `high_risk_work_situation` | 0 | 37 | 비정형 작업, 지게차, 사다리 등 seed hazard 후보로 적합. |
| I | `재해유발요인` | `causal_factor` | 0 | 124 | 반복되는 위험 패턴 설명. |
| J | `위험성 감소대책(예시)` | `risk_reduction_measures_raw` | 0 | 2,529 | `▶` bullet 및 줄바꿈 기반으로 세부 대책 분리 가능. |

Top values:

| Field | Frequent Values |
| --- | --- |
| `industry_major` | 제조업 1,546, 기타의사업 689, 운수창고통신업 147, 임업 80, 농업 50 |
| `industry_mid` | 기계기구·금속·비금속광물제품제조업 771, 시설관리및사업지원서비스업 267, 화학및고무제품제조업 245 |
| `source_object` | 분류 불가 398, 지게차 189, 크레인(천장주행크레인) 76, 사다리(이동식/A형) 73, 나무(벌도목) 67 |
| `high_risk_work_situation` | 비정형 작업(정비·수리·교체·조정) 190, 작업장소 통행·이동 182, 비정형 작업(이물질 제거·청소) 170, 비정형 작업(점검) 167 |

Sample rows:

| source_serial_no | industry_major | source_object | high_risk_work_situation | causal_factor Summary |
| ---: | --- | --- | --- | --- |
| 1 | 제조업 | 분류 불가 | 리프트·승강기 관련 작업 | 화물용 승강기 또는 리프트 운반구 작업 중 끼임/떨어짐 위험 |
| 2 | 제조업 | 컨베이어 | 비정형 작업(점검) | 안전장치 미설치/불량/해제 상태의 설비 사용 중 사고 위험 |
| 3 | 제조업 | 혼합기 | 비정형 작업(점검) | 점검 중 다른 사람이 설비를 가동하여 갑자기 작동된 설비 사고 위험 |

### 아카이브(건설업)

| Excel Column | Source Header | Proposed Field | Null Count | Unique Count | Notes |
| --- | --- | --- | ---: | ---: | --- |
| B | `연번` | `source_serial_no` | 0 | 3,459 | 1부터 3,459까지 연속. |
| C | `고위험작업·상황 > 공종` | `construction_work_type` | 0 | 13 | `1. 토공사` 같은 코드 prefix 포함. |
| D | `고위험작업·상황 > 작업명` | `work_name` | 0 | 49 | `1.1 굴착 작업` 같은 계층 코드 포함. |
| E | `고위험작업·상황 > 단위작업명` | `unit_work_name` | 0 | 112 | 가장 구체적인 작업 분류. |
| F | `재해종류` | `accident_type` | 0 | 20 | 추락, 깔림, 낙하 등. |
| G | `재해개요` | `accident_summary` | 0 | 3,458 | 동일 사고개요 텍스트 1쌍 존재. 연번으로 원본 보존 필요. |
| H | `기인물` | `source_object` | 0 | 57 | 비계, 고소작업대, 지붕 채광판 등. |
| I | `재해유발요인` | `causal_factor` | 0 | 3,300 | 제조업등보다 구체 사례형 문장이 많음. |
| J | `위험성 감소대책(예시)` | `risk_reduction_measures_raw` | 0 | 1,686 | 동일 대책 템플릿 재사용이 많아 별도 measure table로 dedupe 가능. |

Top values:

| Field | Frequent Values |
| --- | --- |
| `construction_work_type` | 4. 마감공사 863, 13. 기타 건설공사 534, 5. 전기·기계 설비공사 525, 2. 철근콘크리트 공사 433 |
| `work_name` | 4.8 판넬 등 외부마감 작업 298, 13.6 기타(작업환경, 청소 등) 248, 5.1 전기 설비 작업 246 |
| `unit_work_name` | 4.8.2 판넬 등 외부마감 시공 261, 13.6.1 기타(작업환경, 청소 등) 248, 12.1.1 철거 및 해체작업 235 |
| `accident_type` | 추락 2,030, 깔림 250, 낙하 246, 붕괴 179, 부딪힘 164 |
| `source_object` | 비계 196, 고소작업대(차) 173, 지붕 채광판 등(선라이트, 슬레이트) 167, 사다리 165 |

Sample rows:

| source_serial_no | construction_work_type | work_name | unit_work_name | accident_type | source_object |
| ---: | --- | --- | --- | --- | --- |
| 1 | 1. 토공사 | 1.1 굴착 작업 | 1.1.1 굴착 장비반입 | 추락 | 바닥개구부(자재인양구 등) |
| 2 | 1. 토공사 | 1.1 굴착 작업 | 1.1.1 굴착 장비반입 | 전도 | 굴착기(백호우) |
| 3 | 1. 토공사 | 1.1 굴착 작업 | 1.1.1 굴착 장비반입 | 부딪힘 | 굴착기(백호우) |

## Data Quality Notes

- 필수 데이터 컬럼 결측은 두 데이터 시트 모두 0건이다.
- 제조업등 `source_serial_no`는 1-2,573, 건설업 `source_serial_no`는 1-3,459까지 누락 없이 연속이다.
- `개요` 시트는 셀 텍스트가 없어 ingestion 대상에서 제외하는 것이 안전하다. 원본 개요 이미지가 필요하면 별도 OCR/수동 확인 태스크로 분리한다.
- 건설업 `accident_summary`는 중복 1쌍이 있다. Excel row 2323/2324, source serial 2319/2320이 동일 사고개요를 공유한다. 다만 `causal_factor` 또는 대책 조합까지 포함한 core tuple 중복은 0건이므로 삭제하지 않는다.
- `risk_reduction_measures_raw`는 줄바꿈과 `▶` marker로 분해 가능하다. 제조업등은 총 6,716개, 건설업은 총 10,578개 bullet 후보가 추출된다.
- `accident_summary`에서 연도 추출이 가능하다. 제조업등은 2014-2023, 건설업은 2013-2024 범위가 관찰된다. 월은 `03월경`, `10월경` 등 문자열 패턴으로 별도 best-effort 추출 가능하다.
- 업종/공종 코드 prefix는 문자열에 포함되어 있으므로 seed 단계에서는 원문을 보존하고, 검색/필터용으로 `code`와 `label`을 파생 저장하는 방식을 권장한다.

## Recommended Normalized Schema

이 파일은 Supabase schema 변경까지 수행하지 않는 분석 태스크이므로, 아래는 migration 후보 설계이다. 실제 DB 반영 전에는 별도 승인과 migration 태스크가 필요하다.

### Option A: Knowledge Event Payload First

현재 `knowledge_events` 테이블에 바로 넣기 좋은 최소 침습 방식이다.

```sql
-- source = 'kosha-accident' or a future allowed value such as 'kosha-sif'
source_id = 'kosha-sif:manufacturing:1'
title = '[SIF] 제조업 / 리프트·승강기 관련 작업 / 분류 불가'
payload = {
  "dataset": "kosha_sif_archive_20260401",
  "sheet": "아카이브(제조업등)",
  "domain": "non_construction",
  "source_serial_no": 1,
  "taxonomy": {
    "industry_major": "제조업",
    "industry_mid": "화학및고무제품제조업",
    "industry_minor": "화학비료제조업"
  },
  "accident_summary": "...",
  "source_object": "분류 불가",
  "high_risk_work_situation": "리프트·승강기 관련 작업",
  "causal_factor": "...",
  "risk_reduction_measures": [
    "개구부에 추락방지용 덮개 설치",
    "카(운반구)에 울 추가 설치"
  ],
  "observed_year": 2019,
  "observed_month": 10
}
related_hazard_ids = derived from source_object, high_risk_work_situation, accident_type
reflected_documents = ['riskAssessment', 'tbmBriefing', 'safetyEducation', 'workPlan']
```

Pros:

- 기존 `knowledge_events.payload`와 `related_hazard_ids`를 재사용한다.
- 빠르게 seed 가능하고 UI/API 변경 부담이 작다.
- 원본 컬럼 추가/보정이 있어도 JSONB payload로 흡수 가능하다.

Cons:

- 중복 대책/분류값 dedupe와 facet 검색은 JSONB index 설계 없이는 제한적이다.
- `source` check constraint에 `kosha-sif`를 추가하려면 migration이 필요하다. migration 없이 진행하려면 기존 허용값인 `kosha-accident`를 쓰고 `payload.dataset`으로 구분한다.

### Option B: Dedicated Normalized Tables

대량 검색, facet, 추천 랭킹, 문서 자동 반영까지 고려한 정규화 방식이다.

```sql
create table sif_cases (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  source_sheet text not null,
  domain text not null check (domain in ('non_construction', 'construction')),
  source_serial_no integer not null,
  accident_summary text not null,
  source_object text not null,
  causal_factor text not null,
  accident_type text,
  observed_year integer,
  observed_month integer,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, domain, source_serial_no)
);

create table sif_taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null,
  term_type text not null,
  code text,
  label text not null,
  parent_id uuid references sif_taxonomy_terms(id) on delete set null,
  unique (dataset_id, term_type, label)
);

create table sif_case_terms (
  case_id uuid not null references sif_cases(id) on delete cascade,
  term_id uuid not null references sif_taxonomy_terms(id) on delete cascade,
  role text not null,
  primary key (case_id, term_id, role)
);

create table sif_case_measures (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references sif_cases(id) on delete cascade,
  sequence_no integer not null,
  measure_text text not null,
  measure_hash text not null,
  reflected_documents text[] not null default '{}'::text[],
  unique (case_id, sequence_no)
);
```

Recommended indexes:

```sql
create index idx_sif_cases_domain_serial on sif_cases(domain, source_serial_no);
create index idx_sif_cases_accident_type on sif_cases(accident_type);
create index idx_sif_cases_source_object on sif_cases(source_object);
create index idx_sif_cases_year on sif_cases(observed_year);
create index idx_sif_terms_type_label on sif_taxonomy_terms(term_type, label);
create index idx_sif_measures_hash on sif_case_measures(measure_hash);
```

Pros:

- 작업분류, 업종, 재해종류, 기인물 기준 facet 검색이 쉽다.
- 반복 감소대책을 dedupe하고 문서별 반영 규칙을 붙이기 좋다.
- 이후 embedding/chunk 생성과 Supabase full-text search를 붙이기 좋다.

Cons:

- 신규 migration이 필요하고 RLS/seed/rollback 설계가 필요하다.
- 현재 MVP에는 Option A보다 구현 부담이 크다.

### Recommended Path

1. Phase 1 seed는 Option A로 진행한다. `knowledge_events` 또는 JSON seed 파일에 원본 row를 최대한 보존한다.
2. `data/safety-knowledge/sif-cases.json` 같은 파일 seed를 먼저 만들고, manifest counts와 source policy를 갱신한다.
3. 검색/추천 품질 개선 단계에서 Option B로 분리한다.
4. DB migration이 필요한 경우, `source` check constraint에 `kosha-sif`를 추가할지 또는 별도 `sif_cases` 테이블을 둘지 먼저 결정한다.

## Proposed JSON Seed Shape

```json
{
  "id": "kosha-sif-construction-0001",
  "sourceId": "kosha-sif-archive-20260401",
  "sourceSheet": "아카이브(건설업)",
  "domain": "construction",
  "sourceSerialNo": 1,
  "taxonomy": {
    "constructionWorkType": { "code": "1", "label": "토공사" },
    "workName": { "code": "1.1", "label": "굴착 작업" },
    "unitWorkName": { "code": "1.1.1", "label": "굴착 장비반입" }
  },
  "accidentType": "추락",
  "accidentSummary": "2019년 03월경 ...",
  "sourceObject": "바닥개구부(자재인양구 등)",
  "causalFactor": "굴착기 진입을 위해 ...",
  "riskReductionMeasures": [
    "추락할 위험이 있는 개구부에는 안전난간 또는 덮개 등을 충분한 강도를 가진 구조로 튼튼하게 설치",
    "개구부 덮개를 설치할 경우 뒤집히거나 떨어지지 않도록 견고히 설치하고 개구부임을 표시",
    "안전모 등 개인보호구 착용철저"
  ],
  "derived": {
    "observedYear": 2019,
    "observedMonth": 3,
    "relatedHazardIds": ["fall-scaffold"],
    "reflectedDocuments": ["riskAssessment", "tbmBriefing", "safetyEducation", "workPlan"]
  },
  "qualityFlags": {
    "hasRequiredFields": true,
    "isOverviewSheet": false,
    "isDuplicateAccidentSummary": false
  }
}
```

## Content Reflection Points

### Risk Assessment

- `causal_factor`를 유해·위험요인 파악 문구의 1차 근거로 사용한다.
- `risk_reduction_measures`를 감소대책 후보로 분해해 제안한다.
- 제조업등은 `high_risk_work_situation`, 건설업은 `construction_work_type/work_name/unit_work_name`을 작업 조건 필터로 사용한다.
- `source_object`는 기계·장비·물질·구조물 위험요인 매칭 키로 사용한다.

### TBM Briefing

- `accident_summary`는 유사사례 한 줄 설명으로 짧게 축약한다.
- `risk_reduction_measures`의 첫 2-4개 bullet을 당일 작업 전 점검 항목으로 변환한다.
- 건설업은 `accident_type`이 `추락`, `낙하`, `붕괴`, `끼임`, `감전`일 때 TBM 강조 문구를 다르게 만든다.

### Safety Education

- 반복 사고 유형별로 교육 주제를 만들 수 있다.
- 제조업등 `high_risk_work_situation` 37개와 건설업 `unit_work_name` 112개는 교육 커리큘럼 태그로 적합하다.
- 동일 감소대책 hash를 묶어 교육자료/체크리스트 공통 항목으로 재사용한다.

### Work Plan

- 지게차, 크레인, 굴착기, 고소작업대, 화기/화학물질, 밀폐공간처럼 작업계획서가 필요한 장비/작업은 `source_object`와 `high_risk_work_situation`에서 rule 기반으로 감지한다.
- 건설업 계층 코드가 있는 경우 `공종 > 작업명 > 단위작업명` 순서로 작업계획서 작업범위를 자동 채운다.

### Knowledge Runtime

- `related_hazard_ids`는 기존 hazard seed와 매핑한다. 초기 rule 예시는 아래와 같다.
- `추락`, `비계`, `고소작업대`, `사다리`, `지붕`, `개구부` -> `fall-scaffold`
- `지게차`, `화물운반트럭`, `트럭류`, `상하차` -> `forklift-traffic` 또는 vehicle-contact 계열 신규 hazard
- `용접`, `절단`, `인화성물질`, `화재`, `폭발` -> `hot-work-fire`
- `맨홀`, `밀폐공간`, `질식`, `산소결핍` -> `confined-space`
- `화학물질`, `황산`, `MSDS`, `누출`, `비산` -> `chemical-msds`

## Parser Recommendations

- `openpyxl` read-only mode로 처리한다.
- `개요` 시트는 skip한다.
- 제조업등은 `min_row=4`, `min_col=2`, `max_col=10`으로 읽는다.
- 건설업은 `min_row=5`, `min_col=2`, `max_col=10`으로 읽는다.
- 모든 텍스트는 trim하되 원문 문장과 bullet 순서는 보존한다.
- `▶` prefix는 제거한 별도 array를 만들고, raw string도 함께 저장한다.
- `OO`, `○○` 비식별 표기는 원문 그대로 보존한다.
- 연월 추출은 best-effort derived field로만 사용하고, 원문 대체값으로 사용하지 않는다.
- duplicate 처리는 삭제가 아니라 `qualityFlags`에 표시한다.

## Ingestion Checklist

- Source metadata: dataset id `kosha_sif_archive_20260401`, agency `KOSHA`, source file basename 보존.
- Row identity: `(dataset_id, domain, source_serial_no)` unique.
- Raw preservation: 원본 sheet명, 원본 컬럼명, raw row JSON 보존.
- Normalized search fields: domain, accident_type, source_object, industry/work taxonomy, observed_year.
- Measures: raw string과 bullet array 동시 저장.
- Document mapping: `riskAssessment`, `tbmBriefing`, `safetyEducation`, `workPlan` 기본 반영.
- QA report: row count, null count, duplicate summary count, skipped overview sheet count를 evaluation에 남긴다.

## Suggested Next Task

이 분석 파일만으로 다음 작업자는 `scripts/parse_sif_archive.*` 또는 `scripts/build_sif_knowledge_seed.*`를 만들 수 있다. 단, DB schema 변경은 migration이 필요하므로 별도 승인 후 진행한다.
