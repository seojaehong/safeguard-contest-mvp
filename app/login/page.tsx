import { AdminLoginPanel } from "@/components/AdminLoginPanel";

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
