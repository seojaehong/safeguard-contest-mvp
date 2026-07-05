"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { parseAuthHashSession, resolveSafeNextPath } from "@/lib/auth-callback";

let browserClient: SupabaseClient | null = null;

function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClient) browserClient = createClient(url, anonKey);
  return browserClient;
}

export function AuthCallbackClient() {
  const [message, setMessage] = useState("로그인 세션을 확인하는 중입니다.");
  const [nextPath, setNextPath] = useState("/workspace");

  useEffect(() => {
    const safeNextPath = resolveSafeNextPath(new URLSearchParams(window.location.search).get("next"));
    setNextPath(safeNextPath);

    const parsed = parseAuthHashSession(window.location.hash);
    if (!parsed) {
      setMessage("로그인 링크가 만료되었거나 세션 정보가 없습니다. 다시 로그인 링크를 받아 주세요.");
      return;
    }
    const sessionTokens = parsed;

    const client = getBrowserSupabaseClient();
    if (!client) {
      console.warn("auth callback received but Supabase browser client is not configured");
      setMessage("로그인 설정이 필요합니다. Supabase 브라우저 설정을 확인해 주세요.");
      return;
    }

    async function persistSession(supabase: SupabaseClient) {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: sessionTokens.accessToken,
          refresh_token: sessionTokens.refreshToken
        });
        if (error) throw error;

        window.history.replaceState(null, "", `/auth/callback?next=${encodeURIComponent(safeNextPath)}`);
        window.location.replace(safeNextPath);
      } catch (error) {
        console.error("auth callback session persistence failed", error);
        setMessage("로그인 세션 저장에 실패했습니다. 새 로그인 링크를 다시 받아 주세요.");
      }
    }

    void persistSession(client);
  }, []);

  return (
    <section className="safeclaw-login-panel" aria-label="로그인 처리">
      <span className="safeclaw-os-tag">관리자 계정</span>
      <h1>로그인 처리 중입니다.</h1>
      <p>{message}</p>
      <div className="safeclaw-login-actions">
        <Link href="/login" className="primary">로그인 다시 받기</Link>
        <a href={nextPath}>이동할 화면 열기</a>
      </div>
    </section>
  );
}
