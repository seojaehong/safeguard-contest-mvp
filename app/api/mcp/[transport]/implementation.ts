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
import { createHash } from "node:crypto";
import { z } from "zod";

import { runAsk } from "@/lib/search";
import { fetchWeatherSignal } from "@/lib/weather";
import { fetchAccidentCases } from "@/lib/accident-cases";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  MCP_DOC_TYPE_MAX_CHARS,
  MCP_DOCUMENT_TEXT_MAX_CHARS,
  MCP_GENERATION_QUESTION_MAX_CHARS,
  MCP_REQUEST_BODY_MAX_BYTES,
  MCP_REGION_MAX_CHARS,
  MCP_SEARCH_QUERY_MAX_CHARS,
  MCP_TASK_MAX_CHARS,
  enforceMcpRequestBodyBudget,
} from "@/lib/mcp-work-budget";
import {
  applyPublicRateLimitHeader,
  checkPublicRateLimit,
  publicRateLimitResponse,
} from "@/lib/public-distributed-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  createSupabaseMcpWorkpackRepository,
  saveMcpDocpackWorkpack,
} from "@/lib/workpack-store";
import {
  createGenerateReviewedSafetyDocpackHandler,
  createGenerateSafetyDocpackHandler,
} from "@/lib/mcp-docpack-handler";
import type { SafetyReferenceItem } from "@/lib/safety-reference-catalog";
import { searchSafetyReferences } from "@/lib/safety-reference-catalog-server";
import { isEmbeddableSifReferenceItem } from "@/lib/sif-embedding-corpus";
import { loadTenantHarnessMemoryForMcp } from "@/lib/tenant-harness-memory";
import { querySafetyKnowledge } from "@/lib/ontology/knowledge-tool";
import { reviewDocpack } from "@/lib/ontology/qa-review-tool";
import {
  isMcpEnabled,
  resolveMcpAuth,
} from "@/lib/mcp-auth";
import { registerScopedTool } from "@/lib/mcp-scoped-tool";
import {
  buildAccidentCasesResult,
  buildEvidenceMappingResult,
  buildHarnessAgentResult,
  buildSanitizeContactsResult,
  buildWeatherResult,
  summarizeHarnessSearch,
  toToolResult,
  validateCitations,
} from "@/lib/mcp-tools";

const generateSafetyDocpackHandler = createGenerateSafetyDocpackHandler({
  defaultMode: "full",
  generateResponse: (question, mode, phaseAGrounding) => runAsk(question, {
    aiMode: mode,
    phaseAGrounding,
  }),
  queryKnowledge: querySafetyKnowledge,
  getWorkpackRepository: () => {
    const client = createSupabaseAdminClient();
    return client ? createSupabaseMcpWorkpackRepository(client) : null;
  },
  getGenerationEvidenceSecret: () => process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET,
});

const generateReviewedSafetyDocpackHandler = createGenerateReviewedSafetyDocpackHandler({
  defaultMode: "full",
  generateResponse: (question, mode, phaseAGrounding) => runAsk(question, {
    aiMode: mode,
    phaseAGrounding,
  }),
  queryKnowledge: querySafetyKnowledge,
  reviewResponse: reviewDocpack,
  persistResponse: async (authContext, response) => {
    const client = createSupabaseAdminClient();
    if (client) {
      return saveMcpDocpackWorkpack(
        client,
        { siteId: authContext.siteId, orgId: authContext.orgId },
        response,
      );
    }
    return {
      siteId: authContext.siteId,
      orgId: authContext.orgId,
      workpackId: null,
      saved: false,
    };
  },
  getGenerationEvidenceSecret: () => process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET,
});

function uniqueReferences(items: SafetyReferenceItem[]): SafetyReferenceItem[] {
  const byId = new Map<string, SafetyReferenceItem>();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values());
}

export function registerTools(server: McpServer): void {
  registerScopedTool(server,
    "run_safeclaw_harness_agent",
    {
      title: "SafeClaw Harness Agent",
      description:
        "OpenClaw/Codex 시연용 SafeClaw DB harness engineering 전용 도구. 오늘 작업을 입력하면 safety_reference_items, SIF 사례, 최근 workpack, 개선 이력을 먼저 고정한 패킷을 반환한다. 이 도구는 문서를 마음대로 생성하지 않고, LLM이 문장화만 하도록 naturalize_only 계약과 누락 근거를 함께 제공한다.",
      inputSchema: {
        question: z.string().max(MCP_GENERATION_QUESTION_MAX_CHARS).describe("현장 작업 상황 설명"),
      },
    },
    async ({ question }, authContext) => {
        const [direct, sif, supporting] = await Promise.all([
          searchSafetyReferences({ query: question, limit: 6, evidenceRole: "direct" }),
          searchSafetyReferences({ query: question, limit: 6, itemType: "sif-case" }),
          searchSafetyReferences({ query: question, limit: 6, evidenceRole: "supporting" }),
        ]);

        const tenantMemory = await loadTenantHarnessMemoryForMcp(
          authContext,
          createSupabaseAdminClient,
        );

        const result = buildHarnessAgentResult({
          question,
          references: uniqueReferences([
            ...direct.items,
            ...sif.items.filter(isEmbeddableSifReferenceItem),
            ...supporting.items,
          ]),
          tenantMemory,
          memoryStages: tenantMemory.stages,
          referenceSearch: [
            summarizeHarnessSearch("direct_evidence", direct),
            summarizeHarnessSearch("sif_cases", sif),
            summarizeHarnessSearch("supporting_evidence", supporting),
          ],
          auth: {
            source: authContext?.source || "none",
            siteId: authContext?.siteId || null,
            orgId: authContext?.orgId || null,
            tokenBound: Boolean(authContext?.tokenId),
          },
        });

        return toToolResult(result);
    }
  );

  registerScopedTool(server,
    "generate_reviewed_safety_docpack",
    {
      title: "검수 포함 안전 문서팩 생성",
      description:
        "사업장의 오늘 작업을 설명하면 SafeClaw 문서 엔진(/api/ask runAsk)으로 위험성평가·작업계획서·TBM·교육기록 등 문서팩을 생성하고, 같은 호출에서 온톨로지 QA 검수까지 수행한다. OpenClaw/Codex 같은 외부 AI가 SafeClaw 작업공간 품질의 산출물을 한 번에 받아야 할 때 generate_safety_docpack과 qa_review_docpack을 따로 엮지 말고 이 도구를 우선 호출한다.",
      inputSchema: {
        question: z.string().max(MCP_GENERATION_QUESTION_MAX_CHARS).describe("현장 작업 상황 설명"),
        task: z
          .string()
          .max(MCP_TASK_MAX_CHARS)
          .describe("QA 검수용 작업유형 라벨 (예: 용접, 화기 작업, 밀폐공간 작업, 비계 조립·해체)"),
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
    async ({ question, task, mode, includeFull }, authContext) => {
      return generateReviewedSafetyDocpackHandler(
        { question, task, mode, includeFull },
        authContext,
      );
    }
  );

  registerScopedTool(server,
    "generate_safety_docpack",
    {
      title: "안전 문서팩 생성",
      description:
        "사업장의 오늘 작업을 한 줄로 설명하면 위험성평가·작업계획서·TBM·비상대응 등 법정 안전 문서팩 초안 세트를 생성한다. 현장 안전관리자 에이전트가 '오늘 이런 작업을 한다'는 상황 설명만으로 제출용 문서 초안이 필요할 때 호출한다. 기본은 문서별 프리뷰(앞 500자)+메타이며, 전체 본문은 includeFull=true로 받는다.",
      inputSchema: {
        question: z.string().max(MCP_GENERATION_QUESTION_MAX_CHARS).describe("현장 작업 상황 한 줄 설명 (예: 3층 외벽 비계 해체 작업)"),
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
    generateSafetyDocpackHandler
  );

  registerScopedTool(server,
    "get_weather_signals",
    {
      title: "현장 기상 신호 조회",
      description:
        "현장 지역명으로 기상청 실황·특보를 조회해 폭염·강풍·강수 등 작업 안전에 영향을 주는 기상 신호와 대응 조치를 요약한다. 안전관리자 에이전트가 옥외·고소 작업의 작업중지 기준이나 TBM 기상 공유 문구를 판단할 때 호출한다. 지원 지역: 서울/인천/안산/부산/광주/대구/창원 — 미지원 지역명은 서울 기준으로 응답하며 응답에 fallbackRegion으로 표시된다(requestedRegion·resolvedRegion 필드도 함께 반환).",
      inputSchema: {
        region: z.string().max(MCP_REGION_MAX_CHARS).describe("현장 지역명 (예: 서울, 인천, 안산, 부산, 광주, 대구, 창원)"),
      },
    },
    async ({ region }) => {
      const signal = await fetchWeatherSignal(region);
      return toToolResult(buildWeatherResult(region, signal));
    }
  );

  registerScopedTool(server,
    "validate_safety_citations",
    {
      title: "안전 법령 인용 검증",
      description:
        "에이전트가 작성한 안전 문서 초안의 법령 조문 인용을 검증된 화이트리스트로 게이트한다. 확인되지 않은(환각 가능성 있는) 조문 인용은 '산업안전보건법령'으로 치환하고, 제거된 인용 목록을 함께 반환한다. 안전관리자 에이전트가 스스로 쓴 초안을 제출 전에 법령 신뢰 계층으로 자체 검증할 때 호출한다.",
      inputSchema: {
        text: z.string().max(MCP_DOCUMENT_TEXT_MAX_CHARS).describe("검증할 안전 문서 초안 텍스트"),
      },
    },
    async ({ text }) => {
      return toToolResult(validateCitations(text));
    }
  );

  registerScopedTool(server,
    "sanitize_emergency_contacts",
    {
      title: "비상 연락처 정화",
      description:
        "초안 텍스트에서 지어낸 기관명+전화번호 조합을 중립 플레이스홀더로 치환하고, 검증된 공식 연락처(119 / 근로복지공단 1588-0075 / 안전보건공단 1644-4544 / 고용노동부 1350)를 반환한다. 안전관리자 에이전트가 비상대응·사고보고 문구에 허위 기관·번호가 섞이지 않도록 정화할 때 호출한다.",
      inputSchema: {
        text: z.string().max(MCP_DOCUMENT_TEXT_MAX_CHARS).describe("정화할 초안 텍스트 (비상대응/사고보고 절차 등)"),
      },
    },
    async ({ text }) => {
      return toToolResult(buildSanitizeContactsResult(text));
    }
  );

  registerScopedTool(server,
    "search_accident_cases",
    {
      title: "유사 재해사례 검색",
      description:
        "작업/위험요인 키워드로 KOSHA 재해사례를 검색해 유사 사고와 예방 포인트를 요약한다. 안전관리자 에이전트가 위험성평가·TBM에 넣을 실제 재해 근거를 찾을 때 호출한다.",
      inputSchema: {
        keyword: z.string().max(MCP_SEARCH_QUERY_MAX_CHARS).describe("검색 키워드 (예: 비계 추락, 밀폐공간 질식, 지게차 충돌)"),
      },
    },
    async ({ keyword }) => {
      const result = await fetchAccidentCases(keyword);
      return toToolResult(buildAccidentCasesResult(keyword, result));
    }
  );

  registerScopedTool(server,
    "get_evidence_mapping",
    {
      title: "중처법 증빙 매핑 조회",
      description:
        "문서 타입을 중대재해처벌법 시행령 제4조(안전보건관리체계 구축·이행) 증빙 조항으로 매핑한다. docType을 지정하면 해당 문서의 증빙 라벨을, 생략하면 전체 매핑 테이블을 반환한다. 안전관리자 에이전트가 생성한 문서가 어떤 법정 증빙에 해당하는지 파일철을 구성할 때 호출한다.",
      inputSchema: {
        docType: z
          .string()
          .max(MCP_DOC_TYPE_MAX_CHARS)
          .optional()
          .describe("문서 타입 키 (예: riskAssessment, tbmBriefing, workPlan). 생략 시 전체 매핑."),
      },
    },
    async ({ docType }) => {
      return toToolResult(buildEvidenceMappingResult(docType));
    }
  );

  registerScopedTool(server,
    "query_safety_knowledge",
    {
      title: "검증된 안전 지식 그래프 조회",
      description:
        "작업유형(용접·밀폐공간 등)이나 위험요인으로, 법제처 검증된 위험요인→안전조치→법조문→중처법 의무 연결을 조회할 때 호출. 조문 인용 전 이 도구로 근거를 확보하라.",
      inputSchema: {
        query: z.string().max(MCP_SEARCH_QUERY_MAX_CHARS).describe("작업유형 또는 위험요인 라벨 (예: 밀폐공간, 용접, 산소결핍 질식)"),
      },
    },
    async ({ query }) => {
      return toToolResult(await querySafetyKnowledge(query));
    }
  );

  registerScopedTool(server,
    "qa_review_docpack",
    {
      title: "안전 문서 QA 검수",
      description:
        "생성된 안전 문서(위험성평가·TBM 등) 본문을 작업유형의 법정 필수 조치 목록과 대조해 누락을 검출할 때 호출. 문서 전파·증빙 저장 전 자기 검수용.",
      inputSchema: {
        task: z.string().max(MCP_TASK_MAX_CHARS).describe("작업유형 라벨 (예: 용접, 밀폐공간 작업)"),
        document_text: z
          .string()
          .max(MCP_DOCUMENT_TEXT_MAX_CHARS)
          .describe("검수할 안전 문서 본문 (최대 20000자 — 초과분은 잘라내고 검수)"),
      },
    },
    async ({ task, document_text }) => {
      return toToolResult(await reviewDocpack(task, document_text));
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

const instanceLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
const coarseInstanceLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

async function protectedBaseHandler(request: Request): Promise<Response> {
  if (request.method !== "POST") return baseHandler(request);

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const identifier = createHash("sha256").update(bearer || "missing-bearer").digest("hex");
  const rateDecision = await checkPublicRateLimit({
    request,
    identifier,
    namespace: "mcp-authenticated",
    limit: 20,
    windowMs: 60_000,
    instanceLimiter,
  });
  const rateLimitRejection = publicRateLimitResponse(rateDecision);
  if (rateLimitRejection) return rateLimitRejection;

  const bodyBudget = await enforceMcpRequestBodyBudget(request, MCP_REQUEST_BODY_MAX_BYTES);
  if (!bodyBudget.ok) return bodyBudget.response;

  const response = await baseHandler(bodyBudget.request);
  return applyPublicRateLimitHeader(response, rateDecision);
}

const authHandler = withMcpAuth(protectedBaseHandler, verifyToken, { required: true });

export async function handler(request: Request): Promise<Response> {
  // 활성화 조건: env 레거시 토큰이 있거나 Supabase 서비스 롤(DB 토큰)이 설정된 경우.
  if (!isMcpEnabled()) {
    return new Response(JSON.stringify({ error: "MCP not enabled" }), {
      status: 501,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method !== "POST") return authHandler(request);

  const coarseDecision = await checkPublicRateLimit({
    request,
    namespace: "mcp-pre-auth",
    limit: 20,
    windowMs: 60_000,
    instanceLimiter: coarseInstanceLimiter,
  });
  const coarseRejection = publicRateLimitResponse(coarseDecision);
  if (coarseRejection) return coarseRejection;

  const response = await authHandler(request);
  if (!response.headers.has("X-SafeClaw-Rate-Limit")) {
    applyPublicRateLimitHeader(response, coarseDecision);
  }
  return response;
}

