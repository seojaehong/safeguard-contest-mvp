// 아침 자동 브리핑 — "시키지 않아도 출근하는 안전관리자" (SafeClaw 2 기둥 4).
//
// Vercel cron이 매일 06:00 KST(21:00 UTC, vercel.json)에 이 라우트를 호출한다.
// env BRIEFING_SITES에 등록된 사업장마다: 1) runAsk로 문서팩 생성 2) Supabase workpacks에
// 저장(저장되면 /evidence-file 방어 파일에 자동 축적됨) 3) n8n email 채널로 요약 발송.
// 각 단계는 독립적으로 실패해도 다음 사이트 처리를 막지 않는다 — 무인 실행이 전제이므로.

import { NextRequest, NextResponse } from "next/server";
import { runAsk } from "@/lib/search";
import { buildBriefingEmail, parseBriefingSites } from "@/lib/briefing";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { saveAskResponseAsWorkpack } from "@/lib/workpack-store";
import { isLiveDispatchEnabled, postWebhookWithTimeout, resolveWebhookConfig } from "@/lib/n8n-webhook";
import { createLogger } from "@/lib/logger";

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

async function sendBriefingEmail(subject: string, body: string, recipient: string): Promise<{ sent: boolean; message: string }> {
  const webhookConfig = resolveWebhookConfig();
  if (!webhookConfig.url || !webhookConfig.token) {
    return { sent: false, message: "email: skipped (n8n webhook not configured)" };
  }

  if (!isLiveDispatchEnabled()) {
    return { sent: false, message: "email: skipped (SAFEGUARD_RUN_LIVE_DISPATCH not enabled)" };
  }

  const payload = {
    event: "safeguard.briefing.dispatch",
    sentAt: new Date().toISOString(),
    channels: ["email"] as const,
    recipients: [recipient],
    operatorNote: "SafeClaw 아침 자동 브리핑",
    workpack: { subject, body }
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

  const { sites, error } = parseBriefingSites(process.env.BRIEFING_SITES);
  if (sites.length === 0) {
    log.info("briefing run: no sites configured", { error });
    return NextResponse.json({ ok: true, message: "no sites", results: [] });
  }

  const supabaseClient = createSupabaseAdminClient();
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
      if (supabaseClient) {
        const saveResult = await saveAskResponseAsWorkpack(supabaseClient, site.email, site.name, response);
        saved = saveResult.ok;
        workpackId = saveResult.workpackId;
        if (!saveResult.ok) message += `save: ${saveResult.message} `;
      } else {
        message += "save: skipped (Supabase not configured) ";
      }

      const email = buildBriefingEmail(response, site.name, workpackId);
      const emailResult = await sendBriefingEmail(email.subject, email.body, site.email);
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

  log.info("briefing run complete", { siteCount: results.length });

  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), results });
}
