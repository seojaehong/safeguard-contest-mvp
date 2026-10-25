// 공유 세션 연락처 보유기간 정리 — Vercel cron 이 매일 호출한다(vercel.json).
// 만료·중지 뒤 30일이 지난 공유 세션 스냅숏에서 작업자 연락처(phone·email)를 지운다(2026-10-25 결정 19).

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { purgeExpiredShareSessionContacts } from "@/lib/share-contact-retention";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = Buffer.from(request.headers.get("authorization") || "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return header.length === expected.length && timingSafeEqual(header, expected);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    if (!process.env.CRON_SECRET?.trim()) {
      return NextResponse.json({ ok: false, message: "CRON_SECRET이 설정되지 않았습니다." }, { status: 501 });
    }
    return NextResponse.json({ ok: false, message: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const client = createSupabaseAdminClient();
  if (!client) {
    return NextResponse.json({ ok: false, configured: false, message: "Supabase 저장소가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  const result = await purgeExpiredShareSessionContacts(client);
  return NextResponse.json({ ...result, configured: true }, { status: result.ok ? 200 : 500 });
}
