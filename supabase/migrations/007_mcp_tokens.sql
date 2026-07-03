-- MCP 토큰 테넌트 스코프화 v0 — 사이트/조직에 바인딩되는 Bearer 토큰 저장소.
--
-- 기존에는 env SAFECLAW_MCP_TOKENS(콤마 구분, 전체 신뢰) 하나로 모든 MCP 호출을
-- 인증했다. Tier 1 파일럿에서는 고객사별로 발급한 토큰이 자기 사이트에만 귀속되어야
-- 하므로, 토큰의 sha256 해시(평문 저장 금지)와 site_id/org_id/scopes를 이 테이블에 둔다.
-- lib/mcp-auth.ts가 Bearer 수신 → sha256 → 이 테이블 조회로 {siteId, orgId, scopes}
-- 컨텍스트를 해석하고, 미매칭 시 env 레거시 토큰(전체 신뢰)으로 폴백한다.
--
-- 적용은 서비스 롤(운영자/발급 스크립트)만 한다: RLS를 켜되 정책을 두지 않으므로
-- 익명/로그인 사용자는 접근 불가이고, service_role 키만 RLS를 우회해 읽고 쓴다.

create extension if not exists pgcrypto;

create table if not exists mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,          -- 토큰 평문의 sha256 hex (평문은 절대 저장하지 않는다)
  label text,                               -- 발급 메모 (예: "부평 파일럿 - 안전관리자")
  site_id uuid references sites(id) on delete set null,
  org_id uuid,                              -- organizations(id). 사이트 미지정 조직 단위 토큰용
  scopes jsonb not null default '["tools:*"]'::jsonb,
  disabled boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 조회 경로: 해시 정확 매칭 + 비활성 제외. token_hash unique 인덱스로 매칭은 커버되나
-- 활성 토큰 스캔용 부분 인덱스를 둔다.
create index if not exists idx_mcp_tokens_active
  on mcp_tokens(token_hash)
  where not disabled;

alter table mcp_tokens enable row level security;
-- 정책 없음 = service_role 전용(service_role은 RLS를 우회). 클라이언트 직접 접근 차단.
