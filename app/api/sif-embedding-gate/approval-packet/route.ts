import { NextRequest, NextResponse } from "next/server";
import { buildSifEmbeddingApprovalPacket } from "@/lib/sif-embedding-approval-packet";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
