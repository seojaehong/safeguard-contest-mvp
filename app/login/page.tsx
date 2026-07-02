import type { Metadata } from "next";
import { AdminLoginPanel } from "@/components/AdminLoginPanel";

export const metadata: Metadata = {
  title: "관리자 로그인 | SafeClaw",
  description: "SafeClaw 관리자 콘솔 로그인 페이지입니다."
};

export default function LoginPage() {
  return (
    <main className="safeclaw-login-page" aria-label="SafeClaw 관리자 로그인">
      <header className="safeclaw-login-topbar">
        <a href="/" className="safeclaw-os-brand" aria-label="SafeClaw 홈">
          <span className="safeclaw-os-mark">SC</span>
          <strong>safeclaw/<em>os</em></strong>
        </a>
        <nav aria-label="로그인 보조 메뉴">
          <a href="/workspace">작업공간</a>
          <a href="/archive">이력</a>
          <a href="/ops/api">API 상태</a>
        </nav>
      </header>
      <AdminLoginPanel />
    </main>
  );
}
