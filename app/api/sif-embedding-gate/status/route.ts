import { NextRequest, NextResponse } from "next/server";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";
import { createSupabaseAdminClient, getWorkspaceUser } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "운영 진단 인증을 사용할 수 없습니다." }, { status: 503 });
  }
  const user = await getWorkspaceUser(client, request.headers);
  if (!user) {
    return NextResponse.json({ ok: false, message: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const status = getSifEmbeddingGateStatus();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
