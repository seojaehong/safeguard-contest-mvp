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
- OAuth는 다음 단계이며 v0 스코프는 정적 Bearer 토큰이다.
- rate limit은 서버리스 웜 인스턴스 단위 소프트 가드(분산 쿼터 아님).

### 테넌트 스코프 토큰 (DB, `mcp_tokens`)

env `SAFECLAW_MCP_TOKENS`는 **전체 신뢰**(모든 사이트 접근) 레거시 토큰이다. Tier 1
파일럿에서는 고객사별 토큰이 자기 사이트에만 귀속되어야 하므로, 사이트/조직에 바인딩된
토큰을 Supabase `mcp_tokens`(마이그레이션 `007_mcp_tokens.sql`)에 둔다.

- 인증 해석은 [`lib/mcp-auth.ts`](../lib/mcp-auth.ts) `resolveMcpAuth`가 담당한다:
  Bearer → `sha256` hex → `mcp_tokens` 조회(`disabled=false`) → `{siteId, orgId, scopes}`
  컨텍스트. **평문 토큰은 저장·로그하지 않는다**(DB엔 해시만, 컨텍스트/로그엔 토큰 없음).
- **DB 우선, env 폴백**: DB에서 매칭되지 않으면 env 레거시 토큰으로 폴백한다(기존 운영자
  토큰 무중단). Supabase 서비스 롤 미설정 시엔 env만으로 동작한다(회귀 없음).
- 활성화 조건도 확장됐다: env 토큰이 있거나 **Supabase 서비스 롤이 설정**되면 MCP 계층이
  켜진다(DB 전용 운영 시에도 `501`이 아니라 정상 동작).
- 컨텍스트는 도구 핸들러의 `extra.authInfo.extra`로 전달된다. `generate_safety_docpack`은
  `siteId`가 있으면 결과 workpack을 해당 사이트로 귀속 저장하고, 성패와 무관하게
  `attribution`(`{siteId, orgId, workpackId, saved}`) 메타를 응답에 기록한다. 나머지 도구는
  현재 컨텍스트 로깅만 하며 향후 확장점 주석을 달아 두었다.
- `last_used_at`은 fire-and-forget으로 갱신한다(응답 경로를 막지 않는다).

#### 토큰 발급

서비스 롤 키가 필요하다(`mcp_tokens`는 RLS로 `service_role` 전용). 평문 토큰은 발급 시
stdout에 **한 번만** 출력되며 복구 불가다.

```bash
# .env.local의 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY를 사용한다.
node scripts/issue-mcp-token.mjs "부평 파일럿 - 안전관리자" "부평공장"   # 사이트 귀속
node scripts/issue-mcp-token.mjs "운영자 전체신뢰"                        # 사이트 미귀속
# npm 스크립트로도 동일: npm run token:mcp -- "<label>" ["<site name>"]
```

출력된 평문 토큰을 그대로 `Authorization: Bearer <token>`으로 쓰면 된다(접속 방법 동일).

### 프로덕션 활성화 (필수)

**Vercel 환경변수 `SAFECLAW_MCP_TOKENS`가 설정되기 전까지 prod는 501을 반환한다.**
Vercel 프로젝트 설정 → Environment Variables에 `SAFECLAW_MCP_TOKENS`를 추가한 뒤
재배포해야 MCP 계층이 활성화된다.

## 도구 6종

| 도구 | 입력 | 반환 요약 |
|------|------|-----------|
| `generate_safety_docpack` | `question`, `mode?`(template\|enhanced\|full, 기본 full), `includeFull?` | `lib/search.ts` runAsk 호출. `summary`·`scenario`·`evidenceLabels`(있으면)·문서별 프리뷰(앞 500자+총길이). `includeFull=true` 시 전체 본문 |
| `get_weather_signals` | `region` | `lib/weather.ts` 기상청 실황·특보 요약 + 작업 대응 조치 |
| `validate_safety_citations` | `text` | `lib/law-citation-gate.ts` 게이트. `{ gatedText, removedCitations[] }` — 미검증(환각) 조문 인용 제거·치환 |
| `sanitize_emergency_contacts` | `text` | `lib/safety-contacts.ts` 정화. 허위 기관+번호를 플레이스홀더로 치환 + 공식 연락처 목록 반환 |
| `search_accident_cases` | `keyword` | `lib/accident-cases.ts` KOSHA 유사 재해사례 요약 |
| `get_evidence_mapping` | `docType?` | `lib/smsa-mapping.ts` 중대재해처벌법 시행령 제4조 증빙 매핑(지정 시 단건, 생략 시 전체) |

각 도구 description은 **"현장 안전관리자 에이전트가 언제 호출해야 하는지"**를 서술형으로
기술한다(MCP 클라이언트의 도구 선택률 최적화).

## SafeClaw 2 아키텍처에서의 위치

이 MCP 계층의 1차 소비자는 SafeClaw에 내장될 **OpenClaw 에이전트(Phase 2)**다. 즉
"고객의 에이전트가 SafeClaw 도구 계층 위에서 안전관리자로 일한다"는 SafeClaw 2의 핵심
차별화를 실물로 만든 것이 v0다. `validate_safety_citations`·`sanitize_emergency_contacts`는
에이전트가 스스로 쓴 초안을 제출 전에 **법령·연락처 신뢰 계층으로 자체 검증**하게 하는
v2 서사의 중심 도구이며, `generate_safety_docpack`·`get_evidence_mapping`은 생성된 문서를
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

로컬 dev에서 활성화하려면 `SAFECLAW_MCP_TOKENS=<token> npm run dev`로 기동한다.
