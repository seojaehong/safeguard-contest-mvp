// 서버 내부(사용자 세션 없는) 컨텍스트에서 AskResponse를 workpack으로 저장한다.
// app/api/workpacks POST(사람 세션 기반)와 app/api/briefing/run(cron, 이메일 소유자 기반)이
// 저장 방식을 공유하도록 ensureWorkspaceContext + insert 패턴을 재사용한다.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureWorkspaceContext,
  toJson,
  type WorkspaceDatabase
} from "@/lib/supabase-admin";
import type { AskResponse } from "@/lib/types";

export type SaveWorkpackResult = {
  ok: boolean;
  workpackId: string | null;
  message: string;
};

export type McpDocpackAttribution = {
  siteId: string | null;
  orgId: string | null;
  workpackId: string | null;
  saved: boolean;
};

/**
 * MCP 토큰 컨텍스트(siteId/orgId)로 docpack 결과를 해당 사이트에 귀속시킨다.
 * 세션 사용자가 없는 토큰 컨텍스트이므로 created_by는 null이고, 서비스 롤로 직접 insert한다
 * (mcp_tokens와 마찬가지로 RLS를 우회). organization_id는 NOT NULL이라 siteId로 조회해 채운다.
 * 어떤 이유로든 저장이 무리면(사이트 미지정/조직 조회 실패/insert 실패) saved=false로 degrade —
 * 호출부는 meta의 site_id 기록으로 폴백한다. saveAskResponseAsWorkpack(이메일 경로)은 건드리지 않는다.
 */
export async function saveMcpDocpackWorkpack(
  client: SupabaseClient<WorkspaceDatabase>,
  context: { siteId: string | null; orgId: string | null },
  response: AskResponse
): Promise<McpDocpackAttribution> {
  const base: McpDocpackAttribution = {
    siteId: context.siteId,
    orgId: context.orgId,
    workpackId: null,
    saved: false,
  };

  if (!context.siteId) return base;

  let organizationId = context.orgId;
  try {
    if (!organizationId) {
      const { data: site, error: siteError } = await client
        .from("sites")
        .select("organization_id")
        .eq("id", context.siteId)
        .maybeSingle();
      if (siteError || !site) return base;
      organizationId = site.organization_id;
    }

    const evidenceSummary = {
      answer: response.answer,
      practicalPoints: response.practicalPoints,
      citations: response.citations,
      sourceMix: response.sourceMix || null,
      mode: response.mode,
      externalData: response.externalData,
      riskSummary: response.riskSummary,
    };

    const { data, error } = await client
      .from("workpacks")
      .insert({
        organization_id: organizationId,
        site_id: context.siteId,
        question: response.question,
        scenario: toJson(response.scenario),
        deliverables: toJson(response.deliverables),
        evidence_summary: toJson(evidenceSummary),
        worker_summary: toJson({}),
        status: toJson(response.status),
        created_by: null,
      })
      .select("id")
      .single();

    if (error || !data) return { ...base, orgId: organizationId };
    return { siteId: context.siteId, orgId: organizationId, workpackId: data.id, saved: true };
  } catch (error) {
    console.error("mcp docpack workpack save failed", error);
    return { ...base, orgId: organizationId };
  }
}

const MAX_USER_LOOKUP_PAGES = 10;
const USERS_PER_PAGE = 200;

/**
 * 서비스 롤 키로 이메일 주소에 해당하는 Supabase auth 사용자 id를 찾는다.
 * cron 등 로그인 세션이 없는 컨텍스트에서 "이 이메일 소유자의 작업공간에 저장"할 때 쓴다.
 */
export async function findUserIdByEmail(
  client: SupabaseClient<WorkspaceDatabase>,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  for (let page = 1; page <= MAX_USER_LOOKUP_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) throw error;

    const match = data.users.find((user) => (user.email || "").toLowerCase() === normalized);
    if (match) return match.id;

    if (data.users.length < USERS_PER_PAGE) break;
  }

  return null;
}

/**
 * cron/자동화 컨텍스트에서 AskResponse를 저장한다. ownerEmail로 Supabase auth 사용자를
 * 찾아 그 사용자의 조직/사이트(app/api/workpacks POST와 동일한 ensureWorkspaceContext
 * 규칙)에 workpack row를 남긴다 — 그래야 /evidence-file(방어 파일)에서 소유자 세션으로
 * 조회했을 때 그대로 보인다.
 */
export async function saveAskResponseAsWorkpack(
  client: SupabaseClient<WorkspaceDatabase>,
  ownerEmail: string,
  siteName: string,
  response: AskResponse
): Promise<SaveWorkpackResult> {
  let userId: string | null;
  try {
    userId = await findUserIdByEmail(client, ownerEmail);
  } catch (error) {
    console.error("briefing workpack save: user lookup failed", error);
    return { ok: false, workpackId: null, message: "이메일 소유자 조회에 실패했습니다." };
  }

  if (!userId) {
    return { ok: false, workpackId: null, message: `${ownerEmail} 계정을 찾지 못해 저장을 건너뛰었습니다.` };
  }

  const context = await ensureWorkspaceContext(client, { id: userId, email: ownerEmail }, {
    siteName,
    companyName: siteName
  });

  const evidenceSummary = {
    answer: response.answer,
    practicalPoints: response.practicalPoints,
    citations: response.citations,
    sourceMix: response.sourceMix || null,
    mode: response.mode,
    externalData: response.externalData,
    riskSummary: response.riskSummary
  };

  const { data, error } = await client
    .from("workpacks")
    .insert({
      organization_id: context.organizationId,
      site_id: context.siteId,
      question: response.question,
      scenario: toJson(response.scenario),
      deliverables: toJson(response.deliverables),
      evidence_summary: toJson(evidenceSummary),
      worker_summary: toJson({}),
      status: toJson(response.status),
      created_by: userId
    })
    .select("id")
    .single();

  if (error) {
    console.error("briefing workpack save failed", error);
    return { ok: false, workpackId: null, message: "문서팩 저장에 실패했습니다." };
  }

  return { ok: true, workpackId: data.id, message: "문서팩을 저장했습니다." };
}
