// 클로(Claw) AI 안전관리자 채팅 v0 — 대화형 상주 에이전트 (SafeClaw 2).
//
// SSE 스트림으로 OpenClaw safeclaw profile을 호출한다. 시연/운영 기본값은
// OpenClaw의 OpenAI OAuth 세션이며, SafeClaw MCP 도구 호출은 OpenClaw agent가 담당한다.
// 히스토리는 클라이언트가 보내는 stateless 방식(서버 저장 없음, v0).

import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  type ClawChatEvent,
  type ClawSiteProfile,
} from "@/lib/agent-loop";
import {
  buildOpenClawChatPrompt,
  resolveOpenClawChatConfig,
  runOpenClawChat
} from "@/lib/openclaw-chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
  const openClawConfig = resolveOpenClawChatConfig(process.env);
  const openClawPrompt = buildOpenClawChatPrompt({ systemPrompt, history, message });

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
        emit({
          kind: "tool",
          name: "openclaw_oauth_agent",
          status: "start",
          label: "OpenClaw OpenAI OAuth 연결 중"
        });
        await runOpenClawChat({
          config: openClawConfig,
          prompt: openClawPrompt,
          emit,
        });
        emit({
          kind: "tool",
          name: "openclaw_oauth_agent",
          status: "ok",
          label: "OpenClaw OpenAI OAuth 연결 완료"
        });
        emit({ kind: "final" });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        log.error("openclaw claw chat failed", error);
        emit({
          kind: "tool",
          name: "openclaw_oauth_agent",
          status: "fail",
          label: "OpenClaw OpenAI OAuth 연결 실패"
        });
        emit({
          kind: "error",
          message: `${detail}\nOpenClaw safeclaw profile OAuth와 MCP 연결 상태를 확인해 주세요.`
        });
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
