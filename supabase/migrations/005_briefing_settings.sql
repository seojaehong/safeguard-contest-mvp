-- 아침 자동 브리핑 v1 — 사업장(사이트)별 브리핑 설정 컬럼.
-- 기존에는 env BRIEFING_SITES(정적 JSON, 운영자 1인용)만 읽었으나, 고객 셀프서브
-- 제품화를 위해 sites 테이블에 브리핑 설정을 둔다. app/api/briefing/run(cron)이
-- 서비스롤로 briefing_enabled=true 사이트를 조회하고, app/api/briefing/settings가
-- 로그인 사용자의 설정 저장을 담당한다. RLS는 기존 "owners can manage sites"
-- 정책이 그대로 적용된다(새 정책 불필요).

alter table sites add column if not exists briefing_enabled boolean not null default false;
alter table sites add column if not exists briefing_question text;
alter table sites add column if not exists briefing_email text;

-- cron 조회 최적화: 활성 사이트만 담는 부분 인덱스.
create index if not exists idx_sites_briefing_enabled
  on sites(briefing_enabled)
  where briefing_enabled;
