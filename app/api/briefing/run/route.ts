// 아침 자동 브리핑 — "시키지 않아도 출근하는 안전관리자" (SafeClaw 2 기둥 4).
//
// Vercel cron이 매일 06:00 KST(21:00 UTC, vercel.json)에 이 라우트를 호출한다.
// 대상 사이트는 DB 우선(sites.briefing_enabled=true, 고객 셀프서브) → env BRIEFING_SITES
// 폴백(하위호환) 순서로 결정한다. 사이트마다: 1) runAsk로 문서팩 생성 2) Supabase
// workpacks에 저장(저장되면 /evidence-file 방어 파일에 자동 축적됨) 3) n8n이 이미
// 처리하는 "safeguard.workpack.dispatch" 계약(email 채널)으로 요약 발송.
// 각 단계는 독립적으로 실패해도 다음 사이트 처리를 막지 않는다 — 무인 실행이 전제이므로.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAsk } from "@/lib/search";
import {
  buildBriefingDispatchWorkpack,
  buildBriefingOperatorNote,
  resolveBriefingSites,
  type BriefingSiteRow
} from "@/lib/briefing";
import { createSupabaseAdminClient, type WorkspaceDatabase } from "@/lib/supabase-admin";
import { saveAskResponseAsScheduledWorkpack } from "@/lib/workpack-store";
import { isLiveDispatchEnabled, postWebhookWithTimeout, resolveWebhookConfig } from "@/lib/n8n-webhook";
import { createLogger } from "@/lib/logger";
import { resolveBriefingEmailDispatchStatus } from "@/lib/server/briefing-dispatch-status";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // enhanced 모드 N개 사이트 순차 생성 여유

const log = createLogger("briefing-run");

type SiteResult = {
  name: string;
  generated: boolean;
  saved: boolean;
  emailed: boolean;
  weatherSummary: string;
  message?: string;
};

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/**
 * briefing_enabled=true 사이트를 서비스롤로 조회한다. 조회 실패(예: 마이그레이션
 * 미적용, 네트워크 오류) 시 null을 반환해 env 폴백을 살린다.
 */
async function fetchBriefingSiteRows(
  client: SupabaseClient<WorkspaceDatabase> | null
): Promise<BriefingSiteRow[] | null> {
  if (!client) return null;

  const { data, error } = await client
    .from("sites")
    .select("id,organization_id,name,briefing_question,briefing_email,organizations(owner_id)")
    .eq("briefing_enabled", true)
    .order("created_at", { ascending: true });

  if (error) {
    log.warn("briefing site query failed — falling back to env BRIEFING_SITES", { message: error.message });
    return null;
  }

  return (data || []) as BriefingSiteRow[];
}

async function sendBriefingEmail(
  operatorNote: string,
  workpack: Record<string, unknown>,
  recipient: string
): Promise<{ sent: boolean; message: string }> {
  const dispatchStatus = resolveBriefingEmailDispatchStatus();
  if (!dispatchStatus.emailReady) {
    return {
      sent: false,
      message: `email: skipped (${dispatchStatus.reason || "provider dispatch unavailable"})`
    };
  }

  const webhookConfig = resolveWebhookConfig();
  if (!webhookConfig.url || !webhookConfig.token) {
    return { sent: false, message: "email: skipped (n8n webhook not configured)" };
  }

  if (!isLiveDispatchEnabled()) {
    return { sent: false, message: "email: skipped (SAFEGUARD_RUN_LIVE_DISPATCH not enabled)" };
  }

  // n8n이 이미 처리하는 수동 전파와 동일한 계약(event/channels/recipients/operatorNote/
  // workpack — app/api/workflow/dispatch/route.ts payload 참조). n8n 워크플로우 무수정.
  const payload = {
    event: "safeguard.workpack.dispatch",
    sentAt: new Date().toISOString(),
    channels: ["email"] as const,
    recipients: [recipient],
    operatorNote,
    workpack
  };

  try {
    await postWebhookWithTimeout(webhookConfig.url, webhookConfig.token, payload);
    return { sent: true, message: "email: sent" };
  } catch (error) {
    log.warn("briefing email dispatch failed", error);
    return { sent: false, message: `email: failed (${error instanceof Error ? error.message : "unknown error"})` };
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    if (!process.env.CRON_SECRET?.trim()) {
      return NextResponse.json({ ok: false, message: "CRON_SECRET이 설정되지 않았습니다." }, { status: 501 });
    }
    return NextResponse.json({ ok: false, message: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const supabaseClient = createSupabaseAdminClient();
  const dbRows = await fetchBriefingSiteRows(supabaseClient);
  const { sites, source, truncated, error } = resolveBriefingSites(dbRows, process.env.BRIEFING_SITES);

  if (truncated) {
    log.warn("briefing sites exceeded cap — extra sites skipped this run", { source, cap: sites.length });
  }

  if (sites.length === 0) {
    log.info("briefing run: no sites configured", { source, error });
    return NextResponse.json({ ok: true, message: "no sites", source, results: [] });
  }

  const results: SiteResult[] = [];

  for (const site of sites) {
    let weatherSummary = "";
    let generated = false;
    let saved = false;
    let emailed = false;
    let message = "";

    try {
      const response = await runAsk(site.question, { aiMode: "enhanced" });
      generated = true;
      weatherSummary = response.externalData?.weather?.summary || response.scenario?.weatherNote || "";

      let workpackId: string | null = null;
      if (supabaseClient && site.tenantContext) {
        const saveResult = await saveAskResponseAsScheduledWorkpack(supabaseClient, site.tenantContext, response);
        saved = saveResult.ok;
        workpackId = saveResult.workpackId;
        if (!saveResult.ok) message += `save: ${saveResult.message} `;
      } else if (supabaseClient) {
        message += "save: skipped (immutable tenant context unavailable) ";
      } else {
        message += "save: skipped (Supabase not configured) ";
      }

      const operatorNote = buildBriefingOperatorNote(site.name, weatherSummary);
      const workpack = buildBriefingDispatchWorkpack(response, site.name, workpackId);
      const emailResult = await sendBriefingEmail(operatorNote, workpack, site.email);
      emailed = emailResult.sent;
      message += emailResult.message;
    } catch (siteError) {
      message += `generate: failed (${siteError instanceof Error ? siteError.message : "unknown error"})`;
      log.error("briefing run: site failed", { site: site.name, error: siteError });
    }

    results.push({
      name: site.name,
      generated,
      saved,
      emailed,
      weatherSummary,
      message: message.trim() || undefined
    });
  }

  log.info("briefing run complete", { siteCount: results.length, source });

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), source, results });
}
