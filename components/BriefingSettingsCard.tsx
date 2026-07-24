"use client";

// 아침 브리핑 설정 카드 — /settings에 놓이는 미니 셀프서브 UI.
// 관리자 로그인 세션(Bearer)으로 /api/briefing/settings를 조회·저장한다.
// 비로그인/미설정 상태에서는 저장 대신 안내문만 보여준다.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

type SettingsResponse = {
  ok: boolean;
  siteName?: string | null;
  settings?: { enabled: boolean; question: string; email: string };
  dispatch?: {
    emailReady: boolean;
    mode: "live" | "preview_only";
    reason: string | null;
  };
  message?: string;
};

export function BriefingSettingsCard() {
  const client = getBrowserSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");
  const [siteName, setSiteName] = useState<string | null>(null);
  const [emailDispatchReady, setEmailDispatchReady] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!client) {
      setSessionChecked(true);
      return;
    }

    client.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error: unknown) => console.warn("briefing settings session load failed", error))
      .finally(() => setSessionChecked(true));

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [client]);

  const loadSettings = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch("/api/briefing/settings", {
        headers: { authorization: `Bearer ${accessToken}` }
      });
      const payload = await response.json() as SettingsResponse;
      if (payload.settings) {
        setEnabled(payload.settings.enabled);
        setQuestion(payload.settings.question);
        setEmail(payload.settings.email);
      }
      setSiteName(payload.siteName || null);
      setEmailDispatchReady(payload.dispatch?.emailReady === true);
      if (!payload.ok && payload.message) setMessage(payload.message);
    } catch (error) {
      console.warn("briefing settings load failed", error);
      setMessage("브리핑 설정을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      void loadSettings(session.access_token);
    }
  }, [session?.access_token, loadSettings]);

  async function saveSettings() {
    if (!session?.access_token) return;
    setIsSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/briefing/settings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ enabled, question, email })
      });
      const payload = await response.json() as SettingsResponse;
      setEmailDispatchReady(payload.dispatch?.emailReady === true);
      setMessage(payload.message || (payload.ok ? "저장했습니다." : "저장에 실패했습니다."));
    } catch (error) {
      console.error("briefing settings save failed", error);
      setMessage("저장 요청 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="briefing-settings-card" aria-label="아침 브리핑 설정">
      <h2 className="safeclaw-section-title">아침 브리핑</h2>
      <p className="safeclaw-setting-description">
        매일 06:00(KST) 문서팩 자동 생성
        {emailDispatchReady ? " + 이메일 발송" : " · 이메일 실제 발송은 승인 전 잠금"}
      </p>
      {!client || (sessionChecked && !session) ? (
        <div>
          <p className="muted">
            아침 브리핑 설정은 관리자 로그인 후 저장할 수 있습니다. 활성화하면 등록한 작업
            설명으로 매일 아침 문서팩을 생성합니다. 이메일 실제 발송은 중복 방지 저장 계약이
            승인된 뒤 활성화됩니다.
          </p>
          <Link href="/login">관리자 로그인</Link>
        </div>
      ) : (
        <div className="briefing-settings-form">
          {siteName ? <p className="muted">대상 현장: {siteName}</p> : null}
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            아침 문서팩 자동 생성 활성화
          </label>
          <label htmlFor="briefing-question">작업 설명 (문서팩 생성 질문)</label>
          <textarea
            id="briefing-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="예: 안산 제조공장 용접 및 지게차 상하차 작업, 외국인 근로자 3명 포함 작업자 6명"
          />
          <label htmlFor="briefing-email">
            수신 이메일{emailDispatchReady ? "" : " (실제 발송 준비 후 사용)"}
          </label>
          <input
            id="briefing-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="safety@example.com"
            autoComplete="email"
          />
          <button type="button" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? "저장 중" : "브리핑 설정 저장"}
          </button>
          {message ? <p className="muted">{message}</p> : null}
        </div>
      )}
    </article>
  );
}
