import type { SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "./logger";
import type { McpAuthContext } from "./mcp-auth";
import type { WorkspaceDatabase } from "./supabase-admin";

export const TENANT_WORKPACK_LIMIT = 8;
export const TENANT_IMPROVEMENT_LIMIT = 12;
export const PUBLIC_MCP_TENANT_MEMORY_HOOK_STATUS = "SPEC_PENDING" as const;
export const TENANT_REFLECTED_DOCUMENTS = [
  "위험성평가표",
  "TBM 브리핑",
  "TBM 기록",
  "작업계획서",
  "안전교육일지",
  "비상대응계획",
  "사진대지",
  "외국인근로자 안내",
] as const;
export const TENANT_STRUCTURED_LIMITS = {
  identifierLength: 128,
  timestampLength: 64,
  reflectedDocumentLength: 80,
  reflectedDocumentCount: 8,
} as const;

export type TenantHarnessWorkpackDigest = {
  id: string;
  generatedAt: string;
  provenanceImprovementIds: string[];
  reflectedDocuments: string[];
};

export type TenantHarnessImprovementDigest = {
  id: string;
  workpackId: string;
  reviewStatus: "approved" | "reflected";
  reflectedDocuments: string[];
  sourceType: "manual" | "photo_analysis" | "operator_note";
  reviewedAt: string;
};

export type TenantHarnessSiteScope = "site" | "organization" | "none";
export type TenantHarnessMemoryStageName = "load_workpack_memory" | "load_improvement_memory";
export type TenantHarnessScopeDetail =
  | "site_token_single_site"
  | "organization_token_cross_site_bounded";

export type TenantHarnessMemoryStage = {
  name: TenantHarnessMemoryStageName;
  status: "completed" | "skipped" | "failed";
  attempted: boolean;
  siteScope: TenantHarnessSiteScope;
  scopeDetail?: TenantHarnessScopeDetail;
  count?: number;
  reason?:
    | "organization_required"
    | "global_auth_forbidden"
    | "site_required_for_non_db_auth"
    | "client_unconfigured"
    | "approval_evidence_required";
  error?: string;
};

export type TenantHarnessMemoryResult = {
  workpackMemory: TenantHarnessWorkpackDigest[];
  improvements: TenantHarnessImprovementDigest[];
  siteScope: TenantHarnessSiteScope;
  stages: TenantHarnessMemoryStage[];
};

type ActiveTenantScope = {
  siteScope: Exclude<TenantHarnessSiteScope, "none">;
  scopeDetail: TenantHarnessScopeDetail;
  orgId: string;
  siteId?: string;
};

type TenantMemoryLoader = (
  authContext: McpAuthContext | null | undefined,
  client: SupabaseClient<WorkspaceDatabase> | null,
) => Promise<TenantHarnessMemoryResult>;

const log = createLogger("tenant-harness-memory");
const WORKPACK_ERROR = "현장 작업 이력을 불러오지 못했습니다. 참고자료 결과만 제공합니다.";
const IMPROVEMENT_ERROR = "현장 개선 이력을 불러오지 못했습니다. 참고자료 결과만 제공합니다.";
const MEMORY_ERROR = "현장 메모리를 불러오지 못했습니다. 참고자료 결과만 제공합니다.";
const WORKPACK_SELECT = "id, created_at";
const IMPROVEMENT_SELECT = [
  "id",
  "workpack_id",
  "reflected_documents",
  "review_status",
  "source_type",
  "approved_at",
  "created_at",
].join(", ");
const REFLECTED_DOCUMENT_SET: ReadonlySet<string> = new Set(TENANT_REFLECTED_DOCUMENTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeBoundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(normalized).slice(0, maxLength).join("");
}

function readReflectedDocuments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const document = sanitizeBoundedText(item, TENANT_STRUCTURED_LIMITS.reflectedDocumentLength);
    if (!REFLECTED_DOCUMENT_SET.has(document) || result.includes(document)) continue;
    result.push(document);
    if (result.length >= TENANT_STRUCTURED_LIMITS.reflectedDocumentCount) break;
  }
  return result;
}

function parseWorkpacks(
  value: unknown,
  improvements: TenantHarnessImprovementDigest[],
): TenantHarnessWorkpackDigest[] {
  if (!Array.isArray(value)) return [];
  const improvementsByWorkpack = new Map<string, TenantHarnessImprovementDigest[]>();
  for (const improvement of improvements) {
    const current = improvementsByWorkpack.get(improvement.workpackId) ?? [];
    current.push(improvement);
    improvementsByWorkpack.set(improvement.workpackId, current);
  }
  return value.flatMap((row): TenantHarnessWorkpackDigest[] => {
    if (!isRecord(row)) return [];
    const id = sanitizeBoundedText(row.id, TENANT_STRUCTURED_LIMITS.identifierLength);
    const generatedAt = sanitizeBoundedText(row.created_at, TENANT_STRUCTURED_LIMITS.timestampLength);
    const provenance = improvementsByWorkpack.get(id) ?? [];
    if (!id || !generatedAt || provenance.length === 0) return [];
    return [{
      id,
      generatedAt,
      provenanceImprovementIds: provenance.map((item) => item.id),
      reflectedDocuments: [...new Set(provenance.flatMap((item) => item.reflectedDocuments))],
    }];
  });
}

function parseImprovements(value: unknown): TenantHarnessImprovementDigest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): TenantHarnessImprovementDigest[] => {
    if (!isRecord(row)) return [];
    const id = sanitizeBoundedText(row.id, TENANT_STRUCTURED_LIMITS.identifierLength);
    const workpackId = sanitizeBoundedText(row.workpack_id, TENANT_STRUCTURED_LIMITS.identifierLength);
    const reviewStatus = row.review_status === "approved" || row.review_status === "reflected"
      ? row.review_status
      : null;
    const reviewedAt = sanitizeBoundedText(
      row.approved_at ?? row.created_at,
      TENANT_STRUCTURED_LIMITS.timestampLength,
    );
    if (!id || !workpackId || !reviewStatus || !reviewedAt) return [];
    const sourceType = row.source_type === "photo_analysis" || row.source_type === "operator_note"
      ? row.source_type
      : "manual";
    return [{
      id,
      workpackId,
      reviewStatus,
      reflectedDocuments: readReflectedDocuments(row.reflected_documents),
      sourceType,
      reviewedAt,
    }];
  });
}

function resolveTenantScope(
  authContext: McpAuthContext | null | undefined,
): ActiveTenantScope | { reason: TenantHarnessMemoryStage["reason"] } {
  const orgId = authContext?.orgId?.trim();
  if (!orgId) return { reason: "organization_required" };
  if (authContext?.source === "env") return { reason: "global_auth_forbidden" };
  const siteId = authContext?.siteId?.trim();
  if (siteId) return { siteScope: "site", scopeDetail: "site_token_single_site", orgId, siteId };
  if (authContext?.source === "db") {
    return { siteScope: "organization", scopeDetail: "organization_token_cross_site_bounded", orgId };
  }
  return { reason: "site_required_for_non_db_auth" };
}

function stagesWithStatus(input: {
  status: "skipped" | "failed";
  attempted: boolean;
  siteScope: TenantHarnessSiteScope;
  scopeDetail?: TenantHarnessScopeDetail;
  reason?: TenantHarnessMemoryStage["reason"];
  error?: string;
}): TenantHarnessMemoryStage[] {
  const names: TenantHarnessMemoryStageName[] = ["load_workpack_memory", "load_improvement_memory"];
  return names.map((name) => ({ name, ...input }));
}

function emptyResult(
  siteScope: TenantHarnessSiteScope,
  stages: TenantHarnessMemoryStage[],
): TenantHarnessMemoryResult {
  return { workpackMemory: [], improvements: [], siteScope, stages };
}

function skippedResult(
  scope: ReturnType<typeof resolveTenantScope>,
  reasonOverride?: TenantHarnessMemoryStage["reason"],
): TenantHarnessMemoryResult {
  if (!("siteScope" in scope)) {
    return emptyResult("none", stagesWithStatus({
      status: "skipped",
      attempted: false,
      siteScope: "none",
      reason: reasonOverride ?? scope.reason,
    }));
  }
  return emptyResult(scope.siteScope, stagesWithStatus({
    status: "skipped",
    attempted: false,
    siteScope: scope.siteScope,
    scopeDetail: scope.scopeDetail,
    reason: reasonOverride,
  }));
}

function failedResult(scope: ActiveTenantScope): TenantHarnessMemoryResult {
  return emptyResult(scope.siteScope, stagesWithStatus({
    status: "failed",
    attempted: true,
    siteScope: scope.siteScope,
    scopeDetail: scope.scopeDetail,
    error: MEMORY_ERROR,
  }));
}

function applyTenantFilters<T extends { eq(column: string, value: string): T }>(
  query: T,
  scope: ActiveTenantScope,
): T {
  const organizationQuery = query.eq("organization_id", scope.orgId);
  return scope.siteId ? organizationQuery.eq("site_id", scope.siteId) : organizationQuery;
}

async function loadWorkpacks(
  client: SupabaseClient<WorkspaceDatabase>,
  scope: ActiveTenantScope,
  improvements: TenantHarnessImprovementDigest[],
): Promise<{ rows: TenantHarnessWorkpackDigest[]; stage: TenantHarnessMemoryStage }> {
  const approvedWorkpackIds = [...new Set(improvements.map((item) => item.workpackId))]
    .slice(0, TENANT_WORKPACK_LIMIT);
  if (approvedWorkpackIds.length === 0) {
    return { rows: [], stage: {
      name: "load_workpack_memory",
      status: "skipped",
      attempted: false,
      siteScope: scope.siteScope,
      scopeDetail: scope.scopeDetail,
      count: 0,
      reason: "approval_evidence_required",
    } };
  }
  try {
    const query = client.from("workpacks").select(WORKPACK_SELECT);
    const { data, error } = await applyTenantFilters(query, scope)
      .in("id", approvedWorkpackIds)
      .order("created_at", { ascending: false })
      .limit(TENANT_WORKPACK_LIMIT);
    if (error) throw error;
    const rows = parseWorkpacks(data, improvements);
    return { rows, stage: {
      name: "load_workpack_memory",
      status: "completed",
      attempted: true,
      siteScope: scope.siteScope,
      scopeDetail: scope.scopeDetail,
      count: rows.length,
    } };
  } catch (error) {
    log.error("tenant workpack memory read failed", { orgId: scope.orgId, siteScope: scope.siteScope, error });
    return { rows: [], stage: {
      name: "load_workpack_memory",
      status: "failed",
      attempted: true,
      siteScope: scope.siteScope,
      scopeDetail: scope.scopeDetail,
      error: WORKPACK_ERROR,
    } };
  }
}

async function loadImprovements(
  client: SupabaseClient<WorkspaceDatabase>,
  scope: ActiveTenantScope,
): Promise<{ rows: TenantHarnessImprovementDigest[]; stage: TenantHarnessMemoryStage }> {
  try {
    const query = client.from("workpack_improvements").select(IMPROVEMENT_SELECT);
    const { data, error } = await applyTenantFilters(query, scope)
      .in("review_status", ["approved", "reflected"])
      .order("created_at", { ascending: false })
      .limit(TENANT_IMPROVEMENT_LIMIT);
    if (error) throw error;
    const rows = parseImprovements(data);
    return { rows, stage: {
      name: "load_improvement_memory",
      status: "completed",
      attempted: true,
      siteScope: scope.siteScope,
      scopeDetail: scope.scopeDetail,
      count: rows.length,
    } };
  } catch (error) {
    log.error("tenant improvement memory read failed", { orgId: scope.orgId, siteScope: scope.siteScope, error });
    return { rows: [], stage: {
      name: "load_improvement_memory",
      status: "failed",
      attempted: true,
      siteScope: scope.siteScope,
      scopeDetail: scope.scopeDetail,
      error: IMPROVEMENT_ERROR,
    } };
  }
}

export async function loadTenantHarnessMemory(
  authContext: McpAuthContext | null | undefined,
  client: SupabaseClient<WorkspaceDatabase> | null,
): Promise<TenantHarnessMemoryResult> {
  const scope = resolveTenantScope(authContext);
  if (!("siteScope" in scope)) return skippedResult(scope);
  if (!client) return skippedResult(scope, "client_unconfigured");

  const improvements = await loadImprovements(client, scope);
  const workpacks = await loadWorkpacks(client, scope, improvements.rows);
  return {
    workpackMemory: workpacks.rows,
    improvements: improvements.rows,
    siteScope: scope.siteScope,
    stages: [workpacks.stage, improvements.stage],
  };
}

/** Claw adapter only. Public MCP integration remains SPEC_PENDING under Phase A ownership. */
export async function loadTenantHarnessMemoryForMcp(
  authContext: McpAuthContext | null | undefined,
  createClient: () => SupabaseClient<WorkspaceDatabase> | null,
  loader: TenantMemoryLoader = loadTenantHarnessMemory,
): Promise<TenantHarnessMemoryResult> {
  const scope = resolveTenantScope(authContext);
  if (!("siteScope" in scope)) return skippedResult(scope);
  try {
    const client = createClient();
    if (!client) return skippedResult(scope, "client_unconfigured");
    return await loader(authContext, client);
  } catch (error) {
    log.error("tenant MCP memory adapter failed", { orgId: scope.orgId, siteScope: scope.siteScope, error });
    return failedResult(scope);
  }
}
