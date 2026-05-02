# SafeClaw 안전 참고자료 DB 마이그레이션 기록

## 목적
이번 보강은 작업 전 문서팩이 단순 템플릿처럼 보이지 않도록, KOSHA·공공 안전자료를 `검색 가능한 참고자료 카탈로그`로 분리해 쌓는 작업이다. 기존 기상청, Law.go, Work24, KOSHA live 호출부는 바꾸지 않고, 사용자가 제공한 원본 자료와 기술지원규정 묶음을 별도 지식층으로 정리한다.

## 반영한 원본
- `산업재해 고위험요인(SIF) 아카이브`: 제조업·건설업 고위험요인 사례.
- `건설업 공종별 세부공정 목록`: 작업계획서와 위험성평가의 공정 분류 기준.
- `업종별 기계설비 목록`: 장비·설비 기반 위험요인 분류 기준.
- `위험성평가 접근방법 메뉴얼`, `위험성평가 JSA 교육 교안`: 위험성평가와 JSA/TBM 절차 보강 자료.
- `기술지원규정` ZIP 묶음: 분야별 기술지원규정 및 안전보건 기술지침.

## DB 구조
신규 migration은 `supabase/migrations/004_safety_reference_catalog.sql`에 있다.

- `safety_reference_sources`: 원본 파일·자료 단위.
- `safety_reference_items`: 행, PDF, 기술지원규정 문서 단위 검색 항목.
- `safety_reference_ingestion_runs`: 수집·파싱 실행 기록.

이 구조는 `knowledge_events`와 역할이 다르다. `knowledge_events`는 그날 API 호출로 새로 들어온 원본 이벤트를 누적하고, `safety_reference_items`는 제출 전 미리 깔아두는 기초 지식 DB를 담당한다.

## 실행 결과
최신 dry run report:

- `evaluation/data-ingestion/safety-reference-catalog-report.json`
- seed file: `evaluation/data-ingestion/safety-reference-catalog.seed.json`

보고서 기준 파싱 결과:

- source count: 6
- item count: 8,431
- failed jobs: 0
- SIF cases: 6,033
- construction processes: 626
- machinery rows: 730
- technical support regulation/guideline PDFs: 1,040

## 업로드 상태
현재 Supabase REST 업로드는 `safety_reference_sources` 테이블이 아직 production DB schema cache에 없어 실패했다. 정상 절차는 아래 순서다.

1. `supabase/migrations/004_safety_reference_catalog.sql`을 Supabase SQL editor 또는 CLI로 적용한다.
2. schema cache가 갱신된 뒤 아래 명령을 실행한다.

```powershell
python scripts\ingest_safety_reference_catalog.py --output-dir evaluation\data-ingestion --upload
```

직접 DB URL을 사용할 수 있는 환경에서는 아래 스크립트로 migration을 적용할 수 있다.

```powershell
$env:SUPABASE_DB_URL="postgresql://..."
python scripts\apply_safety_reference_migration.py
```

## 문서팩 반영 방식
정적 기초 지식에는 아래 네 자료를 `data/safety-knowledge/kosha-resources.json`에 추가했다.

- `kosha-sif-archive`
- `kosha-construction-process-list`
- `kosha-machinery-list`
- `kosha-technical-support-regulations`

또한 `위험성평가·TBM·교육 닫힌 루프` hazard가 이 네 자료를 근거 묶음으로 참조하도록 업데이트했다. 생성 문서에는 기존 `내부 지식 DB 반영` 부록을 통해 위험성평가, TBM, 교육 기록에 연결된다.

## 남은 제출 전 확인
- Supabase production에 migration 적용.
- `--upload` 재실행 후 `uploaded.sources`, `uploaded.items`, `uploaded.runs`가 0이 아닌지 확인.
- `/api/safety-reference/search?q=추락`에서 검색 결과가 나오는지 확인.
- 이미지 기반 PDF는 OCR 보강이 필요하다. 현재는 기술지원규정 ZIP 내부 PDF 1,040건 전체를 카탈로그에 포함했고, 우선순위 파일은 추출 가능한 텍스트와 파일 메타데이터를 함께 쌓았다.
