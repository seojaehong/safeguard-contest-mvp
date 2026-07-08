import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceDatabase, WorkspaceUser } from "@/lib/supabase-admin";

export type WorkpackOperationContext = {
  organizationId: string;
  siteId: string | null;
  workpackId: string;
  question: string;
};

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
    .select("id,organization_id,site_id,question")
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
      question: workpack.question
    }
  };
}
