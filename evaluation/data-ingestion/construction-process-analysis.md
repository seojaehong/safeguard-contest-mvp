# Construction Process CSV Analysis

## Scope

- Source file: `C:\Users\iceam\Downloads\한국산업안전보건공단_건설업 공종별 세부공정 목록_20210910.csv`
- Dataset owner/title from filename: 한국산업안전보건공단, 건설업 공종별 세부공정 목록, 2021-09-10
- SafeClaw ingestion role: construction work input normalization, process taxonomy matching, and work-document context enrichment
- This note only analyzes the CSV above. No app code or database schema change is proposed as an immediate change.

## Parsing Findings

| Item | Finding |
| --- | --- |
| File size | 24,795 bytes |
| Encoding | `cp949` and `euc-kr` decode cleanly; `utf-8` and `utf-8-sig` fail |
| CSV header | `번호`, `공사종류`, `공종명`, `세부공정명` |
| Data rows | 626 |
| Number sequence | `번호` is continuous from 1 to 626 with 626 unique values |
| Missing values | 0 missing values in all four columns |
| Extra CSV fields | 0 rows with unexpected extra fields |
| Unique `공사종류` | 6 |
| Unique `공종명` | 51 |
| Unique `세부공정명` | 169 |

Parsing recommendation:

- Read the file with `encoding="cp949"` as the default, with `euc-kr` as an equivalent fallback if the ingestion helper exposes a fallback list.
- Keep `번호` as source-row provenance, not as a business identifier. The stable matching key should be derived from `공사종류 + 공종명 + 세부공정명`.
- Normalize whitespace and Korean middle-dot variants, but preserve the original labels for citations and user-facing document output.
- Treat repeated `세부공정명` values as valid, because many detailed processes intentionally repeat across construction types.

## Distribution Summary

### Construction Types

| 공사종류 | Rows |
| --- | ---: |
| 지하철 | 127 |
| 아파트 | 116 |
| 빌딩 | 112 |
| 교량 및 도로 | 109 |
| 터널 | 86 |
| 댐 | 76 |

### Top Work Types

| 공종명 | Rows |
| --- | ---: |
| 안전가시설작업 | 96 |
| 가설전기작업 | 48 |
| 위험기계기구작업 | 48 |
| 양중기작업 | 36 |
| 발파작업 | 30 |
| 작업환경 | 24 |
| 거푸집작업 | 20 |
| 굴착작업 | 18 |
| 철근작업 | 18 |
| 콘크리트작업 | 18 |
| 기초파일작업 | 16 |
| 흙막이지보공작업 | 16 |
| 지장물조사 및 이설작업 | 16 |

### Shared Detailed Processes

The most repeated detailed processes are not duplicates to remove. They are common tasks reused across several construction types.

Examples:

- `굴착 장비반입`, `굴착`, `굴착 토사반출`: appear across all 6 construction types.
- `발파 천공`, `발파 장약`, `발파`, `발파 암처리`, `발파 화약고 관리`: appear across all 6 construction types.
- `철근반입`, `철근가공 및 운반`, `철근조립`: appear across all 6 construction types.
- `콘크리트 반입`, `콘크리트타설`, `콘크리트양생`: appear across all 6 construction types.
- `수배전설비`, `분전반`, `전선`, `충전부`, `조명등`, `교류아크 용접기`, `접지`: appear across all 6 construction types.

## Sample Rows

| 번호 | 공사종류 | 공종명 | 세부공정명 |
| ---: | --- | --- | --- |
| 1 | 아파트 | 기초파일작업 | 기초파일 자재·장비반입 |
| 2 | 아파트 | 기초파일작업 | 기초파일 천공 |
| 3 | 아파트 | 기초파일작업 | 기초 파일항타 |
| 4 | 아파트 | 기초파일작업 | 기초파일 두부정리 |
| 5 | 아파트 | 굴착작업 | 굴착 장비반입 |
| 6 | 아파트 | 굴착작업 | 굴착 |
| 7 | 아파트 | 굴착작업 | 굴착 토사반출 |
| 8 | 아파트 | 발파작업 | 발파 천공 |
| 9 | 아파트 | 발파작업 | 발파 장약 |
| 10 | 아파트 | 발파작업 | 발파 |

## SafeClaw Product Implications

### 1. Work Input Auto-Classification

Use the CSV as a controlled taxonomy for construction task parsing:

- First classify `공사종류` from the site context or project title, such as apartment, subway, tunnel, bridge/road, dam, or building.
- Then classify `공종명` from the user's task text, schedule row, or uploaded work instruction.
- Finally match `세부공정명` as the most specific process label.

Suggested matching hierarchy:

1. Exact match on `세부공정명`.
2. Exact or normalized match on `공종명`.
3. Keyword match on repeated process nouns such as 굴착, 발파, 철근, 콘크리트, 양중기, 비계, 분전반, 전선, 타워크레인.
4. Site-type constrained match using `공사종류` when the same detailed process appears in multiple construction types.
5. Low-confidence fallback to `공종명` only, while asking the operator to choose the detailed process before final document generation.

Important nuance:

- A phrase like `발파` alone is too broad because the dataset separates `발파 천공`, `발파 장약`, `발파`, `발파 암처리`, and `발파 화약고 관리`.
- A phrase like `전기 작업` should not directly map to one task. It should open choices under `가설전기작업` and `전기설비작업`.
- `안전가시설작업`, `가설전기작업`, `위험기계기구작업`, and `양중기작업` are cross-cutting categories. They should be attachable as supporting hazards even when the main task is another work type.

### 2. Document Generation Quality

The taxonomy can improve generated safety documents in three concrete ways:

- Title and scope: generate document headers like `아파트 / 굴착작업 / 굴착 토사반출` instead of a generic `굴착 작업`.
- Hazard checklist selection: choose task-specific hazards from the matched `공종명` and supplement them with cross-cutting categories such as temporary electricity, lifting equipment, temporary structures, and hazardous machinery.
- Evidence traceability: include the original CSV labels as source taxonomy fields so generated documents can show why a specific checklist or control measure was selected.

Recommended document fields:

| Field | Source | Use |
| --- | --- | --- |
| `constructionType` | `공사종류` | Scenario/site-type gating |
| `workType` | `공종명` | Main safety checklist family |
| `detailProcess` | `세부공정명` | Specific work-step controls |
| `sourceRowNumber` | `번호` | Audit trail back to source CSV |
| `taxonomyVersion` | filename date `20210910` | Reproducible generation |

### 3. Suggested Ingestion Shape

Use a compact normalized record rather than storing the raw CSV only:

```ts
type ConstructionProcessTaxonomyEntry = {
  sourceRowNumber: number;
  constructionType: string;
  workType: string;
  detailProcess: string;
  normalizedSearchText: string;
  taxonomyVersion: "20210910";
};
```

`normalizedSearchText` should combine the three Korean labels after trimming whitespace and normalizing separators. Example:

```text
아파트 기초파일작업 기초파일 자재 장비반입
```

## Integration Recommendations

1. Add an offline ingestion fixture generated from this CSV, not a live dependency. This dataset is small enough to bundle as a curated taxonomy after license/source review.
2. Build a classifier that returns the top matching taxonomy entries and the matched level: `detailProcess`, `workType`, or `constructionType`.
3. Gate construction-specific public API evidence behind successful construction taxonomy matching, consistent with the existing SafeGuard/SafeClaw evidence rule that construction evidence should only appear for construction-like scenarios.
4. In document generation, require a selected `detailProcess` for high-specificity controls. If only `workType` is matched, generate a draft but mark the detailed process as requiring operator confirmation.
5. Preserve original Korean labels in generated documents. Normalized labels are for search and matching only.

## Risks And Follow-Ups

- The CSV is encoded in CP949/EUC-KR, so UTF-8-only ingestion will fail before parsing any rows.
- Some detailed process labels are repeated across all construction types. Deduplicating by `세부공정명` alone would lose important site-type context.
- `공종명` contains both main construction work families and cross-cutting risk families. The classifier should support primary and supporting matches instead of forcing exactly one category.
- Before database insertion or schema changes, confirm the target schema and migration plan with the user because this would cross the DB safety gate.
