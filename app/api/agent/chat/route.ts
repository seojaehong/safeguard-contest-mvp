// 클로(Claw) AI 안전관리자 채팅 v0 — 대화형 상주 에이전트 (SafeClaw 2).
//
// SSE 스트림으로 Anthropic 도구 반복 루프를 돌린다. 순수 로직(시스템 프롬프트·히스토리
// 캡·도구 결과 포맷·종료 판정)은 lib/agent-loop.ts, 도구 실행은 lib/claw-tools.ts에 있다.
// 히스토리는 클라이언트가 보내는 stateless 방식(서버 저장 없음, v0).

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAnthropicConfigured } from "@/lib/anthropic-client";
import { createRateLimiter } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";
import {
  buildSystemPrompt,
  capHistory,
  parseHistory,
  sanitizeUserInput,
  runAgentLoop,
  CLAW_MODEL,
  type ClawChatEvent,
  type ClawSiteProfile,
} from "@/lib/agent-loop";
import { executeClawTool } from "@/lib/claw-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger("api/agent/chat");

// IP당 5/min. 서버리스 웜 인스턴스 단위 소프트 가드.
const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

/** 로그인 사용자의 첫 조직 → 첫 사이트 프로필을 읽기 전용으로 조회한다(없으면 null). */
async function findSiteProfile(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser
): Promise<ClawSiteProfile | null> {
  const { data: organization, error: orgError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (orgError || !organization) return null;

  const { data: site, error: siteError } = await client
    .from("sites")
    .select("name,region,briefing_question")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (siteError || !site) return null;

  return {
    siteName: site.name,
    region: (site as { region?: string | null }).region ?? null,
    briefingQuestion: site.briefing_question ?? null,
  };
}

async function resolveSiteProfile(request: NextRequest): Promise<ClawSiteProfile | null> {
  const client = createSupabaseAdminClient();
  if (!client) return null;
  try {
    const user = await getWorkspaceUser(client, request.headers);
    if (!user) return null;
    return await findSiteProfile(client, user);
  } catch (error) {
    log.warn("site profile lookup failed (continuing without profile)", error);
    return null;
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  if (!isAnthropicConfigured()) {
    return jsonError("클로 채팅이 아직 설정되지 않았습니다(ANTHROPIC_API_KEY 미설정).", 501);
  }

  const limited = enforceRateLimit(request, limiter);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("요청 본문이 올바르지 않습니다.", 400);
  }

  const message = sanitizeUserInput((body as { message?: unknown }).message);
  if (!message) {
    return jsonError("메시지를 입력해 주세요.", 400);
  }

  const history = capHistory(parseHistory((body as { history?: unknown }).history));
  const profile = await resolveSiteProfile(request);
  const systemPrompt = buildSystemPrompt(profile);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: "user" as const, content: message },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: ClawChatEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (error) {
          log.warn("SSE enqueue failed (client likely disconnected)", error);
        }
      };
      try {
        await runAgentLoop({
          client,
          model: CLAW_MODEL,
          systemPrompt,
          messages,
          executeTool: executeClawTool,
          emit,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        log.error("claw agent loop failed", error);
        emit({ kind: "error", message: detail });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
