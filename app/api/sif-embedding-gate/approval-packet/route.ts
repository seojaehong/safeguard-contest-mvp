import { NextRequest, NextResponse } from "next/server";
import { buildSifEmbeddingApprovalPacket } from "@/lib/sif-embedding-approval-packet";
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
  const packet = buildSifEmbeddingApprovalPacket(status);
  const format = request.nextUrl.searchParams.get("format");

  if (format === "json") {
    return NextResponse.json(packet, { status: status.ok ? 200 : 503 });
  }

  return new NextResponse(packet.markdown, {
    status: status.ok ? 200 : 503,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="${packet.fileName}"`
    }
  });
}
