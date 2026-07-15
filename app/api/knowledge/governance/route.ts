import { NextResponse } from "next/server";
import {
  KNOWLEDGE_AUTHORITY_LANES,
  KNOWLEDGE_MUTATION_POLICY,
  KNOWLEDGE_PROMOTION_STAGES
} from "@/lib/knowledge-governance";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    ok: true,
    stages: KNOWLEDGE_PROMOTION_STAGES,
    authorityLanes: KNOWLEDGE_AUTHORITY_LANES,
    mutationPolicy: KNOWLEDGE_MUTATION_POLICY
  });
}
