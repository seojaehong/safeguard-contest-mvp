-- 011: 안전 참고자료(safety_reference_*) 출처·국가·라이선스·검수 상태 칸 추가.
-- additive 전용 — 컬럼 추가(기본값 포함)와 인덱스 생성만 한다. 기존 행의 값은 기본값으로만 채워지고
-- 그 밖에는 바뀌지 않는다. 테이블·컬럼 삭제, 타입 변경, RLS 정책 변경은 없다.
--
-- 기존 행 기본값의 뜻
--   country='KR', language='ko', translation='original', legal_basis_scope='domestic'
--   review_status='published' — 지금까지 화면·생성 경로가 쓰던 행을 그대로 쓴다는 뜻(동작 변화 없음).
--
-- 주의: 현재 조회 코드(lib/safety-reference-catalog.ts SELECT_FIELDS·fetchReferenceItems,
-- match_safety_reference_embeddings)는 review_status 로 거르지 않는다. 따라서 review_required 행을
-- 이 테이블에 넣으면 그대로 검색·생성에 쓰인다. 조회 쪽 필터가 들어가기 전까지 적재 도구는
-- published 행만 넣는다(safety-db-research/scripts/load.mjs 기본 동작).

alter table safety_reference_sources
  add column if not exists country text not null default 'KR',
  add column if not exists language text not null default 'ko',
  add column if not exists license text,
  add column if not exists license_url text;

alter table safety_reference_items
  add column if not exists country text not null default 'KR',
  add column if not exists language text not null default 'ko',
  add column if not exists license text,
  add column if not exists translation text not null default 'original'
    check (translation in ('original', 'machine', 'human_reviewed')),
  add column if not exists review_status text not null default 'published'
    check (review_status in ('published', 'review_required', 'rejected')),
  add column if not exists legal_basis_scope text not null default 'domestic'
    check (legal_basis_scope in ('domestic', 'overseas_reference')),
  add column if not exists source_url text,
  add column if not exists excerpt_locator text,
  add column if not exists task_ids text[] not null default '{}'::text[];

comment on column safety_reference_items.country is 'ISO 3166-1 alpha-2. 국외 행은 국내 법령 근거가 아니다(legal_basis_scope 참조).';
comment on column safety_reference_items.translation is 'original=원문 그대로, machine=기계(AI) 번역·요약, human_reviewed=사람이 검수한 번역';
comment on column safety_reference_items.review_status is 'published=공식 원천에서 기계적으로 뽑은 행, review_required=AI 요약·번역·분류가 섞인 행(검수 전), rejected=검수 탈락';
comment on column safety_reference_items.legal_basis_scope is 'overseas_reference=국내 법령 근거 아님(참고 사례)';
comment on column safety_reference_items.excerpt_locator is '원문 발췌 위치(문단·섹션·쪽 등)';
comment on column safety_reference_items.task_ids is 'lib/task-scenario-profiles.ts TaskId (보류군은 X- 접두)';

create index if not exists idx_safety_reference_items_review_status on safety_reference_items(review_status);
create index if not exists idx_safety_reference_items_country on safety_reference_items(country);
create index if not exists idx_safety_reference_items_task_ids on safety_reference_items using gin(task_ids);

notify pgrst, 'reload schema';
