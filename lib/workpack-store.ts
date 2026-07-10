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

type WorkpackInsert = WorkspaceDatabase["public"]["Tables"]["workpacks"]["Insert"];

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

export type WorkpackEvidenceSummary = {
  answer: string;
  practicalPoints: string[];
  citations: AskResponse["citations"];
  sourceMix: AskResponse["sourceMix"] | null;
  mode: AskResponse["mode"];
  externalData: AskResponse["externalData"];
  riskSummary: AskResponse["riskSummary"];
  qualityContract?: AskResponse["qualityContract"];
  ontologyQa?: AskResponse["ontologyQa"];
  evidenceLabels?: AskResponse["evidenceLabels"];
  structured?: AskResponse["structured"];
  dbHarness?: AskResponse["dbHarness"];
};

export type ReopenWorkpackInput = {
  question: string;
  scenario: unknown;
  deliverables: unknown;
  evidenceSummary: unknown;
  status: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readJsonObject(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function buildWorkpackEvidenceSummary(response: AskResponse): WorkpackEvidenceSummary {
  return {
    answer: response.answer,
    practicalPoints: response.practicalPoints,
    citations: response.citations,
    sourceMix: response.sourceMix || null,
    mode: response.mode,
    externalData: response.externalData,
    riskSummary: response.riskSummary,
    qualityContract: response.qualityContract,
    ontologyQa: response.ontologyQa,
    evidenceLabels: response.evidenceLabels,
    structured: response.structured,
    dbHarness: response.dbHarness
  };
}

export function buildSelectedWorkpackEvidenceSummary(input: {
  askResponse?: AskResponse | null;
  providedEvidenceSummary?: unknown;
}): WorkpackEvidenceSummary | Record<string, unknown> {
  if (input.askResponse) {
    return buildWorkpackEvidenceSummary(input.askResponse);
  }
  return isRecord(input.providedEvidenceSummary) ? input.providedEvidenceSummary : {};
}

export function buildWorkpackInsertPayload(input: {
  organizationId: string;
  siteId: string | null;
  question: string;
  scenario: unknown;
  deliverables: unknown;
  evidenceSummary: unknown;
  workerSummary?: unknown;
  status: unknown;
  createdBy: string | null;
}): WorkpackInsert {
  return {
    organization_id: input.organizationId,
    site_id: input.siteId,
    question: input.question,
    scenario: toJson(input.scenario),
    deliverables: toJson(input.deliverables),
    evidence_summary: toJson(input.evidenceSummary),
    worker_summary: toJson(input.workerSummary || {}),
    status: toJson(input.status),
    created_by: input.createdBy
  };
}

export function buildReopenData(input: ReopenWorkpackInput): { data: AskResponse | null; blockers: string[] } {
  const blockers: string[] = [];
  const scenario = readJsonObject(input.scenario);
  const deliverables = readJsonObject(input.deliverables);
  const evidenceSummary = readJsonObject(input.evidenceSummary);
  const evidence = evidenceSummary || {};
  const status = readJsonObject(input.status);
  const externalData = readJsonObject(evidence.externalData);
  const riskSummary = readJsonObject(evidence.riskSummary);

  if (!scenario) blockers.push("workpacks.scenario JSON이 AskResponse.scenario 형태가 아닙니다.");
  if (!deliverables) blockers.push("workpacks.deliverables JSON이 문서팩 산출물 형태가 아닙니다.");
  if (!externalData) blockers.push("workpacks.evidence_summary.externalData가 없어 근거 패널을 복원할 수 없습니다.");
  if (!riskSummary) blockers.push("workpacks.evidence_summary.riskSummary이 없어 위험 요약을 복원할 수 없습니다.");
  if (!status) blockers.push("workpacks.status JSON이 저장되지 않았습니다.");

  if (blockers.length || !scenario || !deliverables || !externalData || !riskSummary || !status) {
    return { data: null, blockers };
  }

  const mode = evidence.mode === "live" || evidence.mode === "fallback" || evidence.mode === "mock"
    ? evidence.mode
    : "fallback";
  const qualityContract = readJsonObject(evidence.qualityContract);
  const ontologyQa = readJsonObject(evidence.ontologyQa);
  const evidenceLabels = readJsonObject(evidence.evidenceLabels);
  const structured = readJsonObject(evidence.structured);
  const dbHarness = readJsonObject(evidence.dbHarness);

  return {
    data: {
      question: input.question,
      answer: readString(evidence.answer, "저장된 문서팩 상세입니다. 원문 답변은 이전 저장 형식에 없을 수 있습니다."),
      practicalPoints: readStringArray(evidence.practicalPoints),
      citations: Array.isArray(evidence.citations) ? evidence.citations as AskResponse["citations"] : [],
      sourceMix: isRecord(evidence.sourceMix) ? evidence.sourceMix as AskResponse["sourceMix"] : undefined,
      mode,
      scenario: scenario as AskResponse["scenario"],
      externalData: externalData as AskResponse["externalData"],
      riskSummary: riskSummary as AskResponse["riskSummary"],
      deliverables: deliverables as AskResponse["deliverables"],
      structured: structured ? structured as AskResponse["structured"] : undefined,
      evidenceLabels: evidenceLabels ? evidenceLabels as AskResponse["evidenceLabels"] : undefined,
      ontologyQa: ontologyQa ? ontologyQa as AskResponse["ontologyQa"] : undefined,
      qualityContract: qualityContract ? qualityContract as AskResponse["qualityContract"] : undefined,
      dbHarness: dbHarness ? dbHarness as AskResponse["dbHarness"] : undefined,
      status: status as AskResponse["status"]
    },
    blockers: []
  };
}

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
    const { data: site, error: siteError } = await client
      .from("sites")
      .select("organization_id")
      .eq("id", context.siteId)
      .maybeSingle();
    if (siteError || !site) return base;

    if (organizationId && organizationId !== site.organization_id) {
      console.warn("mcp docpack workpack save skipped: site/org mismatch", {
        siteId: context.siteId,
        tokenOrgId: organizationId,
        siteOrgId: site.organization_id
      });
      return { ...base, orgId: organizationId };
    }

    organizationId = site.organization_id;
    const evidenceSummary = buildWorkpackEvidenceSummary(response);

    const { data, error } = await client
      .from("workpacks")
      .insert(buildWorkpackInsertPayload({
        organizationId,
        siteId: context.siteId,
        question: response.question,
        scenario: response.scenario,
        deliverables: response.deliverables,
        evidenceSummary,
        status: response.status,
        createdBy: null
      }))
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

  const evidenceSummary = buildWorkpackEvidenceSummary(response);

  const { data, error } = await client
    .from("workpacks")
    .insert(buildWorkpackInsertPayload({
      organizationId: context.organizationId,
      siteId: context.siteId,
      question: response.question,
      scenario: response.scenario,
      deliverables: response.deliverables,
      evidenceSummary,
      status: response.status,
      createdBy: userId
    }))
    .select("id")
    .single();

  if (error) {
    console.error("briefing workpack save failed", error);
    return { ok: false, workpackId: null, message: "문서팩 저장에 실패했습니다." };
  }

  return { ok: true, workpackId: data.id, message: "문서팩을 저장했습니다." };
}
