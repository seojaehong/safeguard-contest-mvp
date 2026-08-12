"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  consumeAuthTransaction,
  parseAuthHashSession,
  resolveSafeNextPath
} from "@/lib/auth-callback";

let browserClient: SupabaseClient | null = null;

function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: { detectSessionInUrl: false }
    });
  }
  return browserClient;
}

export function AuthCallbackClient() {
  const [message, setMessage] = useState("로그인 세션을 확인하는 중입니다.");
  const [nextPath, setNextPath] = useState("/workspace");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const safeNextPath = resolveSafeNextPath(params.get("next"));
    setNextPath(safeNextPath);

    const client = getBrowserSupabaseClient();
    if (!client) {
      console.warn("auth callback received but Supabase browser client is not configured");
      setMessage("로그인 설정이 필요합니다. Supabase 브라우저 설정을 확인해 주세요.");
      return;
    }
    const supabase = client;

    if (!consumeAuthTransaction(window.localStorage, params.get("auth_tx"))) {
      window.history.replaceState(null, "", `/auth/callback?next=${encodeURIComponent(safeNextPath)}`);
      setMessage("이 브라우저에서 시작하지 않은 로그인 링크입니다. 로그인 화면에서 새 링크를 받아 주세요.");
      return;
    }

    async function finishAndRedirect() {
      window.history.replaceState(null, "", `/auth/callback?next=${encodeURIComponent(safeNextPath)}`);
      window.location.replace(safeNextPath);
    }

    async function persistHashSession(sessionTokens: NonNullable<ReturnType<typeof parseAuthHashSession>>) {
      try {
        const { error } = await supabase.auth.setSession({
          access_token: sessionTokens.accessToken,
          refresh_token: sessionTokens.refreshToken
        });
        if (error) throw error;
        await finishAndRedirect();
      } catch (error) {
        console.error("auth callback session persistence failed", error);
        setMessage("로그인 세션 저장에 실패했습니다. 새 로그인 링크를 다시 받아 주세요.");
      }
    }

    async function persistOAuthSession(code: string) {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        await finishAndRedirect();
      } catch (error) {
        console.error("auth callback oauth exchange failed", error);
        setMessage("소셜 로그인 처리에 실패했습니다. 새 로그인 링크를 다시 받아 주세요.");
      }
    }

    const parsed = parseAuthHashSession(window.location.hash);
    if (parsed) {
      void persistHashSession(parsed);
      return;
    }

    const code = params.get("code");
    if (code) {
      void persistOAuthSession(code);
      return;
    }

    setMessage("로그인 링크가 만료되었거나 세션 정보가 없습니다. 다시 로그인 링크를 받아 주세요.");
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
