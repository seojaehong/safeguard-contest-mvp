import type { Metadata } from "next";
import { AuthCallbackClient } from "@/components/AuthCallbackClient";

export const metadata: Metadata = {
  title: "로그인 처리 | SafeClaw",
  robots: { index: false, follow: false }
};

export default function AuthCallbackPage() {
  return (
    <main className="safeclaw-login-page" aria-label="SafeClaw 로그인 처리">
      <header className="safeclaw-login-topbar">
        <a href="/" className="safeclaw-os-brand" aria-label="SafeClaw 홈">
          <span className="safeclaw-os-mark">SC</span>
          <strong>safeclaw/<em>os</em></strong>
        </a>
        <nav aria-label="로그인 보조 메뉴">
          <a href="/workspace">작업공간</a>
          <a href="/settings/ai-connect">내 AI 연결</a>
          <a href="/ops/api">API 상태</a>
        </nav>
      </header>
      <AuthCallbackClient />
    </main>
  );
}
