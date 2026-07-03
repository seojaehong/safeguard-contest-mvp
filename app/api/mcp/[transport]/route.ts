// SafeClaw MCP Server v0 — 에이전트 네이티브 도구 계층 (SafeClaw 2).
//
// 외부/내장 AI 에이전트(Claude Code, OpenClaw, Hermes 등)가 SafeClaw의 안전관리
// 도구를 Streamable HTTP MCP로 호출한다. v1 웹 서비스는 건드리지 않는 순수 추가 라우트다.
//
// 인증: Authorization Bearer + env SAFECLAW_MCP_TOKENS(콤마 구분 다중 토큰).
//   - env 미설정: 501 "MCP not enabled" (도구 계층 자체가 꺼진 상태)
//   - 토큰 없음/불일치: 401 (withMcpAuth)
// rate limiting: 토큰당 20/min.
//
// 라이브러리: mcp-handler(구 @vercel/mcp-adapter) + @modelcontextprotocol/sdk.
// 실제 호출 URL은 /api/mcp/mcp (mcp-handler가 basePath+"/mcp"로 streamable 엔드포인트를
// 유도하며, Next의 [transport] 세그먼트가 필요하기 때문). docs/mcp-server.md 참고.

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

import { runAsk } from "@/lib/search";
import { fetchWeatherSignal } from "@/lib/weather";
import { fetchAccidentCases } from "@/lib/accident-cases";
import { createRateLimiter } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { saveMcpDocpackWorkpack } from "@/lib/workpack-store";
import {
  asAuthContext,
  isMcpEnabled,
  resolveMcpAuth,
  type McpAuthContext,
} from "@/lib/mcp-auth";
import {
  buildAccidentCasesResult,
  buildDocpackResult,
  buildEvidenceMappingResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  toToolError,
  toToolResult,
  validateCitations,
} from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // docpack full 생성 ~150초

const log = createLogger("mcp-route");

// MCP 도구 핸들러의 두 번째 인자(extra: RequestHandlerExtra)에서 인증 컨텍스트를 꺼낸다.
// mcp-handler의 withMcpAuth가 verifyToken 반환 AuthInfo를 req.auth로 보관하고, 이를
// transport가 extra.authInfo로 전달한다. 우리는 AuthInfo.extra에 McpAuthContext를 실어 보냈다.
function readAuthContext(extra: unknown): McpAuthContext | null {
  const authInfo = (extra as { authInfo?: { extra?: unknown } } | undefined)?.authInfo;
  return asAuthContext(authInfo?.extra);
}

// 평문 토큰(AuthInfo.token)은 절대 로그하지 않는다 — 컨텍스트 요약만 남긴다.
function logToolContext(tool: string, ctx: McpAuthContext | null): void {
  if (!ctx) {
    log.debug("tool call (no auth context)", { tool });
    return;
  }
  log.debug("tool call", {
    tool,
    source: ctx.source,
    siteId: ctx.siteId,
    orgId: ctx.orgId,
    scopes: ctx.scopes,
    tokenId: ctx.tokenId,
  });
}

function registerTools(server: McpServer): void {
  server.registerTool(
    "generate_safety_docpack",
    {
      title: "안전 문서팩 생성",
      description:
        "사업장의 오늘 작업을 한 줄로 설명하면 위험성평가·작업계획서·TBM·비상대응 등 법정 안전 문서팩 초안 세트를 생성한다. 현장 안전관리자 에이전트가 '오늘 이런 작업을 한다'는 상황 설명만으로 제출용 문서 초안이 필요할 때 호출한다. 기본은 문서별 프리뷰(앞 500자)+메타이며, 전체 본문은 includeFull=true로 받는다.",
      inputSchema: {
        question: z.string().describe("현장 작업 상황 한 줄 설명 (예: 3층 외벽 비계 해체 작업)"),
        mode: z
          .enum(["template", "enhanced", "full"])
          .optional()
          .describe("생성 깊이 (기본 full — 외부 데이터·AI 반영)"),
        includeFull: z
          .boolean()
          .optional()
          .describe("각 문서 전체 본문 포함 여부 (기본 false — 프리뷰만)"),
      },
    },
    async ({ question, mode, includeFull }, extra) => {
      try {
        const authContext = readAuthContext(extra);
        logToolContext("generate_safety_docpack", authContext);

        const response = await runAsk(question, { aiMode: mode ?? "full" });
        const result = buildDocpackResult(response, includeFull ?? false) as Record<string, unknown>;

        // 테넌트 귀속: 토큰에 siteId가 있으면 결과 workpack을 해당 사이트로 저장 시도하고,
        // 저장 성패와 무관하게 site_id/org_id를 결과 meta에 기록한다(스펙 ① 폴백).
        if (authContext?.siteId) {
          const client = createSupabaseAdminClient();
          if (client) {
            const attribution = await saveMcpDocpackWorkpack(
              client,
              { siteId: authContext.siteId, orgId: authContext.orgId },
              response
            );
            result.attribution = attribution;
          } else {
            result.attribution = {
              siteId: authContext.siteId,
              orgId: authContext.orgId,
              workpackId: null,
              saved: false,
            };
          }
        }

        return toToolResult(result);
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "get_weather_signals",
    {
      title: "현장 기상 신호 조회",
      description:
        "현장 지역명으로 기상청 실황·특보를 조회해 폭염·강풍·강수 등 작업 안전에 영향을 주는 기상 신호와 대응 조치를 요약한다. 안전관리자 에이전트가 옥외·고소 작업의 작업중지 기준이나 TBM 기상 공유 문구를 판단할 때 호출한다. 지원 지역: 서울/인천/안산/부산/광주/대구/창원 — 미지원 지역명은 서울 기준으로 응답하며 응답에 fallbackRegion으로 표시된다(requestedRegion·resolvedRegion 필드도 함께 반환).",
      inputSchema: {
        region: z.string().describe("현장 지역명 (예: 서울, 인천, 안산, 부산, 광주, 대구, 창원)"),
      },
    },
    async ({ region }, extra) => {
      try {
        // 향후 확장점: authContext.siteId로 사이트 기본 지역 프리필/조회 로깅 등에 활용.
        logToolContext("get_weather_signals", readAuthContext(extra));
        const signal = await fetchWeatherSignal(region);
        return toToolResult(buildWeatherResult(region, signal));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "validate_safety_citations",
    {
      title: "안전 법령 인용 검증",
      description:
        "에이전트가 작성한 안전 문서 초안의 법령 조문 인용을 검증된 화이트리스트로 게이트한다. 확인되지 않은(환각 가능성 있는) 조문 인용은 '산업안전보건법령'으로 치환하고, 제거된 인용 목록을 함께 반환한다. 안전관리자 에이전트가 스스로 쓴 초안을 제출 전에 법령 신뢰 계층으로 자체 검증할 때 호출한다.",
      inputSchema: {
        text: z.string().describe("검증할 안전 문서 초안 텍스트"),
      },
    },
    async ({ text }, extra) => {
      try {
        // 향후 확장점: authContext로 사이트별 인용 화이트리스트 확장 가능.
        logToolContext("validate_safety_citations", readAuthContext(extra));
        return toToolResult(validateCitations(text));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "sanitize_emergency_contacts",
    {
      title: "비상 연락처 정화",
      description:
        "초안 텍스트에서 지어낸 기관명+전화번호 조합을 중립 플레이스홀더로 치환하고, 검증된 공식 연락처(119 / 근로복지공단 1588-0075 / 안전보건공단 1644-4544 / 고용노동부 1350)를 반환한다. 안전관리자 에이전트가 비상대응·사고보고 문구에 허위 기관·번호가 섞이지 않도록 정화할 때 호출한다.",
      inputSchema: {
        text: z.string().describe("정화할 초안 텍스트 (비상대응/사고보고 절차 등)"),
      },
    },
    async ({ text }, extra) => {
      try {
        // 향후 확장점: authContext로 사이트별 비상 연락처 세트 주입 가능.
        logToolContext("sanitize_emergency_contacts", readAuthContext(extra));
        return toToolResult(buildSanitizeContactsResult(text));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "search_accident_cases",
    {
      title: "유사 재해사례 검색",
      description:
        "작업/위험요인 키워드로 KOSHA 재해사례를 검색해 유사 사고와 예방 포인트를 요약한다. 안전관리자 에이전트가 위험성평가·TBM에 넣을 실제 재해 근거를 찾을 때 호출한다.",
      inputSchema: {
        keyword: z.string().describe("검색 키워드 (예: 비계 추락, 밀폐공간 질식, 지게차 충돌)"),
      },
    },
    async ({ keyword }, extra) => {
      try {
        // 향후 확장점: authContext.siteId로 사이트 업종별 재해사례 가중치 부여 가능.
        logToolContext("search_accident_cases", readAuthContext(extra));
        const result = await fetchAccidentCases(keyword);
        return toToolResult(buildAccidentCasesResult(keyword, result));
      } catch (error) {
        return toToolError(error);
      }
    }
  );

  server.registerTool(
    "get_evidence_mapping",
    {
      title: "중처법 증빙 매핑 조회",
      description:
        "문서 타입을 중대재해처벌법 시행령 제4조(안전보건관리체계 구축·이행) 증빙 조항으로 매핑한다. docType을 지정하면 해당 문서의 증빙 라벨을, 생략하면 전체 매핑 테이블을 반환한다. 안전관리자 에이전트가 생성한 문서가 어떤 법정 증빙에 해당하는지 파일철을 구성할 때 호출한다.",
      inputSchema: {
        docType: z
          .string()
          .optional()
          .describe("문서 타입 키 (예: riskAssessment, tbmBriefing, workPlan). 생략 시 전체 매핑."),
      },
    },
    async ({ docType }, extra) => {
      try {
        // 향후 확장점: authContext로 조직별 증빙 파일철 구성 로깅 가능.
        logToolContext("get_evidence_mapping", readAuthContext(extra));
        return toToolResult(buildEvidenceMappingResult(docType));
      } catch (error) {
        return toToolError(error);
      }
    }
  );
}

const baseHandler = createMcpHandler(
  registerTools,
  { serverInfo: { name: "safeclaw", version: "0.1.0" } },
  { basePath: "/api/mcp", maxDuration: 300, verboseLogs: false }
);

// Bearer → {siteId, orgId, scopes} 컨텍스트. DB(mcp_tokens) 우선, env 레거시 폴백.
// 컨텍스트를 AuthInfo.extra에 실어 보내면 transport가 도구 핸들러의 extra.authInfo로 전달한다.
const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const context = await resolveMcpAuth(bearerToken);
  if (!context) return undefined;
  return {
    token: bearerToken,
    clientId: context.source === "db" ? `safeclaw-mcp:${context.tokenId}` : "safeclaw-mcp",
    scopes: context.scopes,
    // McpAuthContext — 평문 토큰은 포함하지 않는다. AuthInfo.extra는 Record<string, unknown>.
    extra: context as unknown as Record<string, unknown>,
  };
};

const authHandler = withMcpAuth(baseHandler, verifyToken, { required: true });

// 토큰당 20/min. 서버리스 웜 인스턴스 단위의 소프트 가드(분산 쿼터 아님).
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

async function handler(request: Request): Promise<Response> {
  // 활성화 조건: env 레거시 토큰이 있거나 Supabase 서비스 롤(DB 토큰)이 설정된 경우.
  if (!isMcpEnabled()) {
    return new Response(JSON.stringify({ error: "MCP not enabled" }), {
      status: 501,
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST(JSON-RPC 메시지)만 rate limit. GET(SSE)/DELETE(세션 종료)는 제외.
  // 키는 raw bearer(휘발성 인메모리, DB/로그 미저장). DB·env 토큰 모두 커버한다.
  if (request.method === "POST") {
    const bearer = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
    if (bearer) {
      const result = limiter.check(bearer);
      if (!result.allowed) {
        const retryAfter = String(result.retryAfterSeconds ?? 60);
        return new Response(
          JSON.stringify({
            error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
            retryAfterSeconds: Number(retryAfter),
          }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": retryAfter } }
        );
      }
    }
  }

  return authHandler(request);
}

export { handler as GET, handler as POST, handler as DELETE };
