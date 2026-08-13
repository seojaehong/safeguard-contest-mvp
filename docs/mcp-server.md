# SafeClaw MCP Server v0 — 에이전트 네이티브 도구 계층

외부/내장 AI 에이전트(Claude Code, OpenClaw, Hermes 등)가 SafeClaw의 안전관리 도구를
**Streamable HTTP MCP**로 호출할 수 있게 하는 순수 추가 라우트다. v1 웹 서비스는 전혀
건드리지 않는다.

- 라우트: `app/api/mcp/[transport]/route.ts`
- 라이브러리: [`mcp-handler`](https://www.npmjs.com/package/mcp-handler)(구 `@vercel/mcp-adapter`) + `@modelcontextprotocol/sdk`
- 전송: Streamable HTTP (SSE 응답)

## 접속 방법

```bash
claude mcp add --transport http safeclaw \
  https://www.safeclaw.kr/api/mcp/mcp \
  -H "Authorization: Bearer <token>"
```

> **URL 주의:** 실제 streamable 엔드포인트는 `/api/mcp/**mcp**` 이다.
> `mcp-handler`가 `basePath`(`/api/mcp`)에 `/mcp`를 붙여 엔드포인트를 유도하고, Next의
> `[transport]` 동적 세그먼트가 있어야 라우팅되기 때문이다. 즉 마지막 `mcp`는
> transport 세그먼트다. (`/api/mcp` 단독 경로는 404.)

## 인증 · rate limiting

| 조건 | 응답 |
|------|------|
| env `SAFECLAW_MCP_TOKENS` 미설정 | `501 Not Implemented` — `{ "error": "MCP not enabled" }` |
| Authorization Bearer 없음 | `401` |
| 토큰 불일치 | `401` |
| 정상 토큰 | `200` (JSON-RPC over SSE) |
| 토큰당 20회/분 초과 (POST) | `429` (`Retry-After` 헤더) |

- `SAFECLAW_MCP_TOKENS`는 콤마 구분 다중 토큰(`token-a,token-b`)을 지원한다.
- DB 토큰은 `created_at`부터 90일 뒤 만료된다. 누락·잘못된 시각·미래 발급 시각은 인증에서
  fail-closed(안전하게 거부)한다.
- production의 레거시 env 토큰은 `SAFECLAW_MCP_LEGACY_EXPIRES_AT`에 현재보다 미래이면서
  90일 이내인 ISO 8601 만료시각을 함께 설정해야 한다. 이 경계가 없거나 범위를 넘으면 `401`이다.
- MCP 접근 토큰은 v0에서 정적 Bearer 토큰이다. 사용자 로그인은 Supabase Auth의 이메일
  매직링크와 소셜 OAuth(예: Kakao)를 사용할 수 있지만, SafeClaw가 외부 AI 대신 OpenAI OAuth를
  중계하지는 않는다.
- rate limit은 서버리스 웜 인스턴스 단위 소프트 가드(분산 쿼터 아님).

### 테넌트 스코프 토큰 (DB, `mcp_tokens`)

env `SAFECLAW_MCP_TOKENS`는 **전체 신뢰**(모든 사이트 접근) 레거시 토큰이다. Tier 1
파일럿에서는 고객사별 토큰이 자기 사이트에만 귀속되어야 하므로, 사이트/조직에 바인딩된
토큰을 Supabase `mcp_tokens`(마이그레이션 `007_mcp_tokens.sql`)에 둔다.

- 인증 해석은 [`lib/mcp-auth.ts`](../lib/mcp-auth.ts) `resolveMcpAuth`가 담당한다:
  Bearer → `sha256` hex → `mcp_tokens` 조회(`disabled=false`) → `{siteId, orgId, scopes}`
  컨텍스트. **평문 토큰은 저장·로그하지 않는다**(DB엔 해시만, 컨텍스트/로그엔 토큰 없음).
- **DB 우선, env 폴백**: DB에서 매칭되지 않을 때만 env 레거시 토큰을 검토한다. DB 행이
  disabled·만료·시각 오류이면 같은 평문이 env에 있어도 폴백하지 않는다. Supabase 서비스 롤
  미설정 시 env만으로 동작하지만 production은 명시된 90일 이내 만료시각이 필수다.
- 활성화 조건도 확장됐다: env 토큰이 있거나 **Supabase 서비스 롤이 설정**되면 MCP 계층이
  켜진다(DB 전용 운영 시에도 `501`이 아니라 정상 동작).
- 컨텍스트는 도구 핸들러의 `extra.authInfo.extra`로 전달되며, 중앙 `registerScopedTool`
  wrapper가 모든 등록 도구의 작업보다 먼저 `scopes`를 집행한다. 권한이 없거나 컨텍스트가
  누락되면 고정 공개 오류 `MCP_TOOL_FORBIDDEN`으로 종료한다. DB scope 배열에 비문자열,
  trim 후 빈 문자열, 과도한 길이, 알 수 없는 scope가 하나라도 있으면 일부 유효 scope도
  보존하지 않고 배열 전체를 무권한으로 처리한다.
- 권한 오류가 아닌 내부 예외는 서버 logger에 기록하되, MCP caller에는 고정 공개 오류
  `MCP_TOOL_INTERNAL_ERROR`와 일반 메시지만 반환한다. transport/Supabase 오류 본문, 내부
  코드, secret 필드는 공개 응답에 포함하지 않는다.
- 지원 scope는 정확한 `tools:<tool_name>`, 제한된 `tools:read`/`tools:write`, 기존 DB·env
  운영자 호환용 `tools:*`다. 신규 웹/CLI 발급 토큰은 현재 등록된 10개 도구의 정확한 scope를
  저장하므로, 나중에 새 도구가 추가되어도 기존 토큰에 자동으로 권한이 생기지 않는다.
- 적용된 `007_mcp_tokens.sql`의 컬럼 기본값은 기존 호환을 위해 아직 `tools:*`다. 제품 API와
  발급 CLI는 항상 명시적 scope를 저장해 이 기본값을 사용하지 않는다. 기본값 자체를
  fail-closed로 바꾸는 작업은 별도 승인 migration 전까지 수행하지 않으며, 수동 SQL insert는
  scope를 반드시 명시해야 한다.
- 현재 no-migration 인증 계약에서는 모든 DB 토큰에 유효한 `site_id`와 그 site의
  `organization_id`가 필요하다. `site_id`가 null인 persisted token은 org-only 의도로 발급됐더라도
  인증되지 않는다. Org-only persisted token은 승인된 `scope_type` 또는 `ON DELETE` schema
  migration으로 삭제된 site 토큰과 구분할 수 있을 때까지 사용할 수 없다.
- `generate_safety_docpack`은
  `siteId`가 있으면 결과 workpack을 해당 사이트로 귀속 저장하고, 성패와 무관하게
  `attribution`(`{siteId, orgId, workpackId, saved}`) 메타를 응답에 기록한다. 나머지 도구는
  사이트/조직 컨텍스트 안에서 조회·검수 작업을 수행한다.
- `last_used_at`은 fire-and-forget으로 갱신한다(응답 경로를 막지 않는다).

#### 토큰 발급

웹에서는 관리자 로그인 후 **설정 → 내 AI 연결**(`/settings/ai-connect`)에서 발급한다.
화면에서 발급된 평문 토큰은 한 번만 표시되며, 이후에는 기존 토큰을 다시 볼 수 없고
새로 발급하거나 비활성화만 할 수 있다. OpenClaw/Codex, Claude Desktop, 직접 MCP 호출용
설치 명령도 같은 화면에서 복사한다.

웹 발급 토큰은 로그인 사용자의 `organizations`/`sites` 소유 범위에 귀속된다. 목록 API는
사용자 소유 범위 안에서 최근 토큰만 기본 25개(최대 50개) 반환하고, `nextCursor`가 있으면
`GET /api/mcp-tokens?cursor=<nextCursor>`로 이전 토큰을 이어서 조회한다. 한 사용자가 많은
연결을 만들어도 화면 응답 경로가 무제한 행 조회나 offset pagination에 묶이지 않는다. 1만
사용자 이상 운영 전에는 `mcp_tokens(org_id, created_at desc)`와
`mcp_tokens(site_id, created_at desc)` 계열 조회 인덱스를 별도 마이그레이션으로 추가하는 것을
권장한다(DB 스키마 변경이므로 적용 전 승인 필요).
토큰 발급은 현장별 활성 토큰 50개를 넘으면 409로 막고, 사용하지 않는 토큰을 끈 뒤 다시
발급하도록 안내한다. 90일이 지난 토큰은 활성 개수에서 제외되고 인증에는 사용되지 않는다.
비활성·만료 토큰은 감사 이력으로 남는다.

서비스 롤 키가 필요하다(`mcp_tokens`는 RLS로 `service_role` 전용). 평문 토큰은 발급 시
stdout에 **한 번만** 출력되며 복구 불가다. CLI의 site name은 필수이며, 생략하거나 공백으로
전달하면 Supabase client 생성이나 DB insert 전에 종료한다.

```bash
# .env.local의 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY를 사용한다.
node scripts/issue-mcp-token.mjs "부평 파일럿 - 안전관리자" "부평공장"
# npm 스크립트로도 동일하며 site name은 필수다.
npm.cmd run token:mcp -- "<label>" "<site name>"
```

출력된 평문 토큰을 그대로 `Authorization: Bearer <token>`으로 쓰면 된다(접속 방법 동일).

### 프로덕션 활성화 (필수)

프로덕션 MCP 계층은 다음 중 하나가 설정되면 활성화된다.

- 권장: Supabase `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`로 DB 기반 `mcp_tokens` 인증 사용
- 레거시/운영자 폴백: Vercel 환경변수 `SAFECLAW_MCP_TOKENS`와 90일 이내 ISO 8601 시각인
  `SAFECLAW_MCP_LEGACY_EXPIRES_AT`

둘 다 없으면 prod는 `501 Not Implemented`를 반환한다. 고객용 AI 연결은 DB 기반 토큰을
사용해야 조직/현장 스코프, 해시 저장, 비활성화, 목록 페이지네이션, 활성 토큰 제한을 모두
적용할 수 있다.

### 사용자 로그인과 OAuth Provider

`/settings/ai-connect`의 토큰 발급은 관리자 로그인이 필요하다. `/login?next=/settings/ai-connect`
화면은 기존 이메일 매직링크 가입/로그인을 유지하면서 Kakao 같은 소셜 OAuth 버튼을 추가로
제공한다. 두 경로 모두 `/auth/callback?next=...`로 돌아오고, 콜백은 Supabase hash 세션과
OAuth `code` 교환을 모두 처리한다.

운영 전 Supabase Auth 대시보드에서 다음을 확인한다.

- Site URL: `https://www.safeclaw.kr`
- Redirect URL: `https://www.safeclaw.kr/auth/callback` 또는 `https://www.safeclaw.kr/**`
- Kakao Provider: enabled, client id/secret configured

`npm.cmd run audit:release-scale`은 자동 코드/프로덕션 스모크와 함께 이 외부 Provider 상태를
보고서에 기록한다. `npm.cmd run audit:release-scale:strict`는 Kakao Provider 미활성화나 1만
사용자 전 DB 인덱스 미적용 같은 출시 차단 게이트까지 실패 코드로 처리한다.

최종 운영 체크리스트는 [`docs/final-release-operator-runbook.md`](./final-release-operator-runbook.md)에
둔다. 1만 사용자 전 인덱스 SQL은 승인 전 적용하지 않고
`evaluation/final-release-scale-audit/mcp-token-query-indexes-approval.sql`에 후보로만 보관한다.

## 도구 10종

| 도구 | 입력 | 반환 요약 |
|------|------|-----------|
| `run_safeclaw_harness_agent` | `question` | OpenClaw/Codex 시연용 DB harness engineering 전용 도구. `safety_reference_items`, SIF 사례, 최근 `workpacks`, 개선 이력을 먼저 조회해 `db_harness_first` 패킷과 `naturalize_only` 생성 계약을 반환한다. 일반 문서 생성보다 먼저 호출해 근거를 고정한다 |
| `generate_reviewed_safety_docpack` | `question`, `task`, `mode?`(template\|enhanced\|full, 기본 full), `includeFull?` | `runAsk`로 SafeClaw 문서팩을 생성하고, 생성 본문을 `qa_review_docpack` 계층으로 즉시 검수한 복합 결과. OpenClaw/Codex가 SafeClaw 작업공간 품질 산출물을 한 번에 받아야 할 때 우선 사용 |
| `generate_safety_docpack` | `question`, `mode?`(template\|enhanced\|full, 기본 full), `includeFull?` | `lib/search.ts` runAsk 호출. `summary`·`scenario`·`evidenceLabels`(있으면)·문서별 프리뷰(앞 500자+총길이). `includeFull=true` 시 전체 본문 |
| `get_weather_signals` | `region` | `lib/weather.ts` 기상청 실황·특보 요약 + 작업 대응 조치 |
| `validate_safety_citations` | `text` | `lib/law-citation-gate.ts` 게이트. `{ gatedText, removedCitations[] }` — 미검증(환각) 조문 인용 제거·치환 |
| `sanitize_emergency_contacts` | `text` | `lib/safety-contacts.ts` 정화. 허위 기관+번호를 플레이스홀더로 치환 + 공식 연락처 목록 반환 |
| `search_accident_cases` | `keyword` | `lib/accident-cases.ts` KOSHA 유사 재해사례 요약 |
| `get_evidence_mapping` | `docType?` | `lib/smsa-mapping.ts` 중대재해처벌법 시행령 제4조 증빙 매핑(지정 시 단건, 생략 시 전체) |
| `query_safety_knowledge` | `query`(작업유형 또는 위험요인) | `lib/ontology/knowledge-tool.ts` 안전 온톨로지(published) 조회 — 위험요인→안전조치→법조문→중처법 의무 연결. 조문 인용 전 근거 확보용 |
| `qa_review_docpack` | `task`, `document_text`(≤20000자) | `lib/ontology/qa-review.ts` 2층 검수 — 문서 본문을 작업유형의 법정 필수 조치와 대조해 누락 검출. `{covered, missing(근거 조문 병기), coverageRate, verdict}` |

각 도구 description은 **"현장 안전관리자 에이전트가 언제 호출해야 하는지"**를 서술형으로
기술한다(MCP 클라이언트의 도구 선택률 최적화).

## SafeClaw 2 아키텍처에서의 위치

이 MCP 계층의 1차 소비자는 SafeClaw에 내장될 **OpenClaw 에이전트(Phase 2)**다. 즉
"고객의 에이전트가 SafeClaw 도구 계층 위에서 안전관리자로 일한다"는 SafeClaw 2의 핵심
차별화를 실물로 만든 것이 v0다. 시연 기간에는 `run_safeclaw_harness_agent`가
SafeClaw DB 근거와 현장 이력 패킷을 먼저 고정하고, OpenClaw는 사용자 OAuth 모델로 그
패킷을 문장화·검토하는 역할만 맡는다. `validate_safety_citations`·`sanitize_emergency_contacts`는
에이전트가 스스로 쓴 초안을 제출 전에 **법령·연락처 신뢰 계층으로 자체 검증**하게 하는
v2 서사의 중심 도구이며, `generate_reviewed_safety_docpack`·`generate_safety_docpack`·`get_evidence_mapping`은 생성된 문서를
중처법 시행령 제4조 증빙 파일철로 연결한다. 동일 인터페이스가 외부 에이전트(Claude Code
등)에도 그대로 열려 있다.

## 로컬 검증 (JSON-RPC over curl)

한글 페이로드는 UTF-8 파일로 보내야 인코딩 깨짐이 없다(`--data-binary @file.json`).

```bash
# initialize
curl -s -X POST http://localhost:3000/api/mcp/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer <token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'

# tools/list
curl -s -X POST http://localhost:3000/api/mcp/mcp -H ... \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# tools/call
curl -s -X POST http://localhost:3000/api/mcp/mcp -H ... \
  --data-binary @payload.json
```

## A2A Agent Card

`app/.well-known/agent.json/route.ts`가 `GET /.well-known/agent.json`에서 [A2A(Agent2Agent)
Agent Card](https://a2a-protocol.org)를 정적 JSON으로 서빙한다. 국내 최초로 A2A-ready 안전
에이전트를 선언하는 디스커버리 문서이지만, 내용은 이 문서에 있는 MCP 도구 계층(위 5개
`skills`)만 서술한다 — capabilities는 보수적으로(`streaming: false` 등) 선언하고,
description에 "MCP 도구 계층은 공개되어 있으나 A2A task 엔드포인트는 아직 없고 로드맵
단계"라는 점을 명시해, 실제로 없는 기능을 있는 것처럼 보이지 않게 한다.

Windows 로컬 dev에서는 `$env:SAFECLAW_MCP_TOKENS="<token>"; npm.cmd run dev`로 기동한다.
