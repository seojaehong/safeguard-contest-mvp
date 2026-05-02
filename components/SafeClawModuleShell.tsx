import Link from "next/link";
import type { ReactNode } from "react";

type ModuleStatus = "live" | "partial" | "planned";

const statusLabel: Record<ModuleStatus, string> = {
  live: "실사용 연결",
  partial: "부분 연결",
  planned: "신규 필요"
};

type SafeClawModuleShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: ModuleStatus;
  mappedTo: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function SafeClawModuleShell({
  eyebrow,
  title,
  description,
  status,
  mappedTo,
  children,
  actions
}: SafeClawModuleShellProps) {
  return (
    <main className="safeclaw-module-shell">
      <header className="safeclaw-module-nav">
        <Link href="/" className="safeclaw-module-brand" aria-label="SafeClaw 홈">
          <span>SC</span>
          <strong>safeclaw</strong>
        </Link>
        <nav aria-label="SafeClaw 제품 화면">
          <Link href="/home">홈</Link>
          <Link href="/documents">문서</Link>
          <Link href="/evidence">근거</Link>
          <Link href="/workers">작업자</Link>
          <Link href="/dispatch">전파</Link>
          <Link href="/archive">이력</Link>
          <Link href="/knowledge">지식 DB</Link>
          <Link href="/ops/api">API</Link>
        </nav>
        <Link href="/workspace" className="safeclaw-module-primary">작업공간</Link>
      </header>

      <section className="safeclaw-module-hero">
        <div>
          <span className="safeclaw-module-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <aside>
          <span className={`safeclaw-module-status ${status}`}>{statusLabel[status]}</span>
          <strong>{mappedTo}</strong>
          {actions ? <div className="safeclaw-module-actions">{actions}</div> : null}
        </aside>
      </section>

      {children}
    </main>
  );
}
