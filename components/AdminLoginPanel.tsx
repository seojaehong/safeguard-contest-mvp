"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey);
  }
  return browserClient;
}

export function AdminLoginPanel() {
  const client = getBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState("관리자 로그인 후 문서팩, 작업자, 교육, 전파 이력을 저장합니다.");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!client) return;

    client.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error: unknown) => {
        console.warn("admin session load failed", error);
        setMessage("현재 세션을 확인하지 못했습니다. 다시 로그인해 주세요.");
      });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [client]);

  async function sendLoginLink() {
    if (!client || !email.trim()) return;
    setIsSending(true);
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/workspace`
        }
      });
      if (error) throw error;
      setMessage("관리자 로그인 링크를 보냈습니다. 메일함에서 확인해 주세요.");
    } catch (error) {
      console.error("admin otp send failed", error);
      setMessage("로그인 링크 발송에 실패했습니다. Supabase Auth 설정과 Redirect URL을 확인해 주세요.");
    } finally {
      setIsSending(false);
    }
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setMessage("로그아웃했습니다. 비회원 임시 저장 모드로 전환됩니다.");
  }

  if (!client) {
    return (
      <section className="safeclaw-login-panel" aria-label="관리자 로그인 설정 상태">
        <span className="safeclaw-os-tag">관리자 계정</span>
        <h1>로그인 설정이 필요합니다.</h1>
        <p>NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 없으면 브라우저 로그인 UI를 열 수 없습니다.</p>
        <div className="safeclaw-login-actions">
          <Link href="/workspace" className="primary">비회원으로 작업공간 열기</Link>
          <Link href="/ops/api">API 상태 확인</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="safeclaw-login-panel" aria-label="관리자 로그인">
      <span className="safeclaw-os-tag">관리자 계정</span>
      <h1>이력을 남기는 작업공간으로 들어갑니다.</h1>
      <p>
        비회원은 브라우저 임시 저장으로 작업하고, 관리자 로그인 후에는 문서팩, 작업자,
        교육 확인, 전파 로그를 Supabase 이력으로 저장합니다.
      </p>

      {session ? (
        <div className="safeclaw-login-session">
          <dl>
            <div>
              <dt>현재 계정</dt>
              <dd>{session.user.email || "이메일 확인 필요"}</dd>
            </div>
            <div>
              <dt>저장 모드</dt>
              <dd>관리자 이력 저장</dd>
            </div>
          </dl>
          <p>{message}</p>
          <div className="safeclaw-login-actions">
            <Link href="/workspace" className="primary">작업공간 열기</Link>
            <Link href="/archive">이력 보기</Link>
            <button type="button" onClick={signOut}>로그아웃</button>
          </div>
        </div>
      ) : (
        <div className="safeclaw-login-form">
          <label htmlFor="admin-email">관리자 이메일</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
            autoComplete="email"
          />
          <button type="button" onClick={sendLoginLink} disabled={isSending || !email.trim()}>
            {isSending ? "로그인 링크 발송 중" : "로그인 링크 받기"}
          </button>
          <p>{message}</p>
          <div className="safeclaw-login-actions">
            <Link href="/workspace">비회원으로 먼저 사용</Link>
            <Link href="/archive">저장 이력 확인</Link>
          </div>
        </div>
      )}
    </section>
  );
}
