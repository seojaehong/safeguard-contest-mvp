import { NextResponse } from "next/server";
import { getSifEmbeddingGateStatus } from "@/lib/sif-embedding-gate-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getSifEmbeddingGateStatus();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
