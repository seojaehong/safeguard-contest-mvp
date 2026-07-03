import { NextResponse } from "next/server";

// A2A(Agent2Agent) Agent Card — SafeClaw를 "A2A-ready 안전 에이전트"로 선언하는
// 정적 디스커버리 문서다. 국내 최초 A2A-ready 안전 에이전트 선언 목적의 마케팅
// 산출물이지만, 내용은 실제로 존재하는 MCP 도구 계층(app/api/mcp/[transport]/route.ts,
// docs/mcp-server.md)만 서술한다 — capabilities에 없는 기능은 선언하지 않는다.
//
// A2A task 엔드포인트(/a2a 등)는 아직 없다. 지금 열려 있는 건 MCP 도구 계층뿐이며,
// description에 이 사실을 정직하게 명시한다. 스펙 참고: https://a2a-protocol.org ,
// https://github.com/a2aproject/A2A
//
// route.ts(동적 GET)로 서빙하는 이유: public/.well-known/ 대신 이쪽을 택한 것은
// Vercel 배포에서 정적 dotfolder 서빙보다 빌드 검증(타입체크·라우트 존재)이 더
// 확실하기 때문이다.
export const dynamic = "force-static";

const AGENT_CARD = {
  name: "SafeClaw — AI 안전관리자",
  description:
    "산업안전보건법·중대재해처벌법 문서·증빙·기상·법령 검증을 수행하는 AI 안전관리자 에이전트. " +
    "현재는 MCP 도구 계층(Streamable HTTP, /api/mcp/mcp)을 공개하고 있으며, A2A task 엔드포인트는 " +
    "로드맵 단계로 아직 제공하지 않는다.",
  url: "https://www.safeclaw.kr",
  provider: {
    organization: "SafeClaw",
    url: "https://www.safeclaw.kr",
  },
  version: "0.1.0",
  documentationUrl: "https://www.safeclaw.kr/api/mcp/mcp",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  authentication: {
    schemes: ["bearer"],
  },
  skills: [
    {
      id: "generate_safety_docpack",
      name: "위험성평가·TBM 문서팩 생성",
      description:
        "현장 정보를 바탕으로 위험성평가·작업계획·TBM 브리핑 등 안전 문서팩 초안을 생성한다.",
    },
    {
      id: "validate_safety_citations",
      name: "법령 인용 검증",
      description:
        "안전 문서 초안의 법령 조문 인용을 검증된 화이트리스트로 게이트하고, 미검증 인용을 안전하게 치환한다.",
    },
    {
      id: "get_weather_signals",
      name: "기상 신호 조회",
      description:
        "현장 지역명으로 기상청 실황·특보를 조회해 폭염·강풍·강수 등 작업 안전 신호와 대응 조치를 요약한다.",
    },
    {
      id: "search_accident_cases",
      name: "재해사례 검색",
      description: "키워드로 유사 산업재해 사례를 검색해 예방 포인트를 요약한다.",
    },
    {
      id: "get_evidence_mapping",
      name: "중처법 증빙 매핑",
      description: "생성된 문서를 중대재해처벌법 시행령 제4조 증빙 항목에 매핑한다.",
    },
  ],
} as const;

export async function GET() {
  return NextResponse.json(AGENT_CARD, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
