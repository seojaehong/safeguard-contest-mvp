import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDatabase, WorkspaceUser } from "@/lib/supabase-admin";
import type { AskResponse } from "@/lib/types";
import { assessWorkpackReadiness, type WorkpackReadiness } from "@/lib/workpack-readiness";
import { buildReopenData, type ReopenWorkpackInput } from "@/lib/workpack-store";
import { verifyAskResponseGenerationEvidence } from "@/lib/generation-evidence";
import {
  buildServerShareRecipients,
  parseShareSessionRecipients,
  type ServerShareRecipientsResult,
  type ShareRecipientInput
} from "@/lib/workpack-commercial";

export type StoredWorkpackShareAuthority = {
  workpack: AskResponse | null;
  readiness: WorkpackReadiness;
};

export function assessStoredWorkpackShareAuthority(input: ReopenWorkpackInput): StoredWorkpackShareAuthority {
  const reopened = buildReopenData(input);
  if (!reopened.data) {
    return {
      workpack: null,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "저장된 작업팩 검증 필요",
        reasons: reopened.blockers
      }
    };
  }

  const readiness = assessWorkpackReadiness(reopened.data);
  if (!reopened.data.generationEvidence) {
    return {
      workpack: reopened.data,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "공유 전 보완 필요",
        reasons: [...readiness.reasons, "생성 근거 봉인 확인 필요"]
      }
    };
  }

  const verification = verifyAskResponseGenerationEvidence(
    reopened.data,
    process.env.SAFECLAW_GENERATION_EVIDENCE_SECRET
  );
  if (!verification.ok) {
    return {
      workpack: reopened.data,
      readiness: {
        canShare: false,
        status: "blocked",
        summary: "공유 전 보완 필요",
        reasons: [...readiness.reasons, "생성 근거 서명 검증 필요"]
      }
    };
  }

  return { workpack: reopened.data, readiness };
}

export type WorkpackOperationContext = {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  question: string;
  generatedAt: string;
  shareAuthority: StoredWorkpackShareAuthority;
};

export type ActiveOwnedShareSession = {
  id: string;
  workpackId: string;
  recipients: ShareRecipientInput[];
  expiresAt: string | null;
};

export type ActiveOwnedShareSessionResult = {
  ok: true;
  session: ActiveOwnedShareSession;
} | {
  ok: false;
  status: number;
  message: string;
};

export async function loadServerShareRecipients(
  client: SupabaseClient<WorkspaceDatabase>,
  input: { organizationId: string; siteId: string | null; requestedWorkerIds: string[] }
): Promise<ServerShareRecipientsResult> {
  let workerQuery = client
    .from("workers")
    .select("id,organization_id,site_id,external_key,display_name,role,joined_at,experience_summary,nationality,language_code,language_label,is_new_worker,is_foreign_worker,training_status,training_summary,phone,email")
    .in("id", input.requestedWorkerIds)
    .eq("organization_id", input.organizationId);
  workerQuery = input.siteId === null
    ? workerQuery.is("site_id", null)
    : workerQuery.eq("site_id", input.siteId);
  const { data, error } = await workerQuery;

  if (error) {
    console.error("share recipient worker fetch failed", error);
    return { ok: false, message: "공유 대상 작업자 명부를 조회하지 못했습니다." };
  }

  return buildServerShareRecipients({ ...input, workers: data || [] });
}

export async function loadActiveOwnedShareSession(
  client: SupabaseClient<WorkspaceDatabase>,
  input: {
    organizationId: string;
    siteId: string | null;
    workpackId: string;
    shareSessionId: string;
    userId: string;
    now?: Date;
  }
): Promise<ActiveOwnedShareSessionResult> {
  let shareSessionQuery = client
    .from("workpack_share_sessions")
    .select("id,organization_id,site_id,workpack_id,recipients_snapshot,status,expires_at,created_by")
    .eq("id", input.shareSessionId)
    .eq("workpack_id", input.workpackId)
    .eq("organization_id", input.organizationId)
    .eq("created_by", input.userId);
  shareSessionQuery = input.siteId === null
    ? shareSessionQuery.is("site_id", null)
    : shareSessionQuery.eq("site_id", input.siteId);
  const { data, error } = await shareSessionQuery.maybeSingle();

  if (error) {
    console.error("owned share session fetch failed", error);
    return { ok: false, status: 500, message: "공유 세션 권한을 확인하지 못했습니다." };
  }
  if (!data ||
    data.organization_id !== input.organizationId ||
    data.workpack_id !== input.workpackId ||
    data.created_by !== input.userId ||
    data.site_id !== input.siteId) {
    return { ok: false, status: 404, message: "현재 작업팩에 속한 공유 세션을 찾지 못했습니다." };
  }
  if (data.status !== "active") {
    return { ok: false, status: 409, message: "활성 상태의 공유 세션만 사용할 수 있습니다." };
  }

  const now = input.now || new Date();
  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      return { ok: false, status: 409, message: "공유 세션이 만료되었거나 만료 시각이 올바르지 않습니다." };
    }
  }

  const recipients = parseShareSessionRecipients(data.recipients_snapshot);
  if (!recipients.length) {
    return { ok: false, status: 409, message: "공유 세션의 서버 작업자 snapshot을 확인할 수 없습니다." };
  }

  return {
    ok: true,
    session: {
      id: data.id,
      workpackId: data.workpack_id,
      recipients,
      expiresAt: data.expires_at
    }
  };
}

export type WorkpackOperationContextResult = {
  ok: true;
  context: WorkpackOperationContext;
} | {
  ok: false;
  status: number;
  message: string;
};

export async function loadOwnedWorkpackOperationContext(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  workpackId: string
): Promise<WorkpackOperationContextResult> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id);

  if (organizationError) {
    console.error("commercial workpack organization fetch failed", organizationError);
    return {
      ok: false,
      status: 500,
      message: "작업공간 권한 확인 중 오류가 발생했습니다."
    };
  }

  const organizationIds = (organizations || []).map((organization) => organization.id);
  if (!organizationIds.length) {
    return {
      ok: false,
      status: 404,
      message: "현재 관리자 계정에 연결된 조직이 없습니다."
    };
  }

  const { data: workpack, error: workpackError } = await client
    .from("workpacks")
    .select("id,organization_id,site_id,question,scenario,deliverables,evidence_summary,status,created_at")
    .eq("id", workpackId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (workpackError) {
    console.error("commercial workpack fetch failed", workpackError);
    return {
      ok: false,
      status: 500,
      message: "작업팩을 조회하지 못했습니다."
    };
  }

  if (!workpack) {
    return {
      ok: false,
      status: 404,
      message: "작업팩을 찾을 수 없거나 현재 계정 권한 밖입니다."
    };
  }

  return {
    ok: true,
    context: {
      organizationId: workpack.organization_id,
      siteId: workpack.site_id,
      workpackId: workpack.id,
      question: workpack.question,
      generatedAt: workpack.created_at,
      shareAuthority: assessStoredWorkpackShareAuthority({
        question: workpack.question,
        scenario: workpack.scenario,
        deliverables: workpack.deliverables,
        evidenceSummary: workpack.evidence_summary,
        status: workpack.status
      })
    }
  };
}
