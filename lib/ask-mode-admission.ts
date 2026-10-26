import type { AiMode } from "@/lib/ai-deliverables";
import { checkAiDailyCostCap } from "@/lib/ai-daily-cost-cap";
import { ANONYMOUS_MESSAGE, DAILY_CAP_MESSAGE } from "@/lib/ask-mode-messages";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";
import type { AskModeNotice } from "@/lib/types";

// 익명 체험은 template 만, 로그인 사용자는 하루 비용 상한 안에서 enhanced/full
// (2026-10-25 결정 21). 강등은 거절이 아니라 template 으로 만들어 주고 응답에 표시한다.

export type AskModeAdmission = {
  aiMode: AiMode;
  notice: AskModeNotice | null;
};

export const ASK_MODE_DOWNGRADE_HEADER = "X-SafeClaw-AI-Mode-Downgraded";

type Dependencies = {
  isAuthenticated?: (request: Request) => Promise<boolean>;
  checkDailyCap?: (request: Request, aiMode: AiMode) => Promise<boolean>;
};

async function defaultIsAuthenticated(request: Request): Promise<boolean> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;
  const client = createSupabaseAdminClient();
  if (!client) return false;
  try {
    return Boolean(await getWorkspaceUser(client, request.headers));
  } catch {
    return false;
  }
}

async function defaultCheckDailyCap(request: Request, aiMode: AiMode): Promise<boolean> {
  return (await checkAiDailyCostCap({ request, aiMode })).allowed;
}

export async function resolveAskModeAdmission(
  request: Request,
  resolvedMode: AiMode,
  dependencies: Dependencies = {},
): Promise<AskModeAdmission> {
  if (resolvedMode === "template") return { aiMode: "template", notice: null };

  const isAuthenticated = dependencies.isAuthenticated ?? defaultIsAuthenticated;
  if (!(await isAuthenticated(request))) {
    return {
      aiMode: "template",
      notice: { requestedMode: resolvedMode, appliedMode: "template", reason: "anonymous", message: ANONYMOUS_MESSAGE },
    };
  }

  const checkDailyCap = dependencies.checkDailyCap ?? defaultCheckDailyCap;
  if (!(await checkDailyCap(request, resolvedMode))) {
    return {
      aiMode: "template",
      notice: { requestedMode: resolvedMode, appliedMode: "template", reason: "daily_cost_cap", message: DAILY_CAP_MESSAGE },
    };
  }

  return { aiMode: resolvedMode, notice: null };
}

export function applyAskModeNoticeHeader<T extends Response>(response: T, notice: AskModeNotice | null): T {
  if (notice) response.headers.set(ASK_MODE_DOWNGRADE_HEADER, notice.reason);
  return response;
}
