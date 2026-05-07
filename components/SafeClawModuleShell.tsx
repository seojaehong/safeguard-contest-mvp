import Link from "next/link";
import type { ReactNode } from "react";

type ModuleStatus = "live" | "partial" | "planned";

const statusLabel: Record<ModuleStatus, string> = {
  live: "바로 사용",
  partial: "연결 확인",
  planned: "설정 필요"
};

type SafeClawModuleShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: ModuleStatus;
  mappedTo: string;
  children: ReactNode;
  actions?: ReactNode;
  activeHref?: string;
};

// Sidebar nav per design handoff v1.0 §10.3 — 11 items in 3 groups
// (운영 3 / 실행 4 / 시스템 4). "작업자 안내"는 외부 모바일 뷰(/worker)이라
// 사이드바 메뉴에서 분리 (가이드 §10.2 누락 항목 명시).
const moduleNav = [
  // 운영 (3) — 로그인 직후 첫 화면 + 한 줄 입력 + 문서 편집
  { href: "/home", code: "01", label: "대시보드", group: "운영" },
  { href: "/workspace", code: "02", label: "작업공간", group: "운영" },
  { href: "/documents", code: "03", label: "문서팩", group: "운영" },
  // 실행 (4) — 근거 / 작업자 / 전파 / TBM
  { href: "/evidence", code: "04", label: "근거 라이브러리", group: "실행" },
  { href: "/workers", code: "05", label: "작업자 · 교육", group: "실행" },
  { href: "/dispatch", code: "06", label: "현장 전파", group: "실행" },
  { href: "/tbm", code: "07", label: "TBM 모드", group: "실행" },
  // 시스템 (4) — 이력 / 지식 / API / 설정
  { href: "/archive", code: "08", label: "이력 · 아카이브", group: "시스템" },
  { href: "/knowledge", code: "09", label: "지식 DB", group: "시스템" },
  { href: "/ops/api", code: "10", label: "API 연결", group: "시스템" },
  { href: "/settings", code: "11", label: "설정", group: "시스템" }
] as const;

export function SafeClawModuleShell({
  eyebrow,
  title,
  description,
  status,
  mappedTo,
  children,
  actions,
  activeHref
}: SafeClawModuleShellProps) {
  const groupedNav = moduleNav.reduce<Record<string, typeof moduleNav[number][]>>((acc, item) => {
    acc[item.group] = acc[item.group] || [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <main className="safeclaw-module-shell">
      <aside className="safeclaw-module-rail" aria-label="SafeClaw 제품 메뉴">
        <Link href="/" className="safeclaw-module-brand" aria-label="SafeClaw 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark-Inverse.svg" alt="" width={28} height={28} />
          <strong>safeclaw/<em>os</em></strong>
        </Link>
        <p>FIELD OS</p>
        <nav aria-label="SafeClaw 운영 메뉴">
          {Object.entries(groupedNav).map(([group, items]) => (
            <section key={group}>
              <h2>{group}</h2>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={activeHref === item.href ? "active" : ""}
                >
                  <span>{item.code}</span>
                  <strong>{item.label}</strong>
                </Link>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <section className="safeclaw-module-main">
        <header className="safeclaw-module-nav">
          <span><i /> SITE 기본 현장</span>
          <span>API <b>Law.go</b> · <b>KOSHA</b> · 기상청</span>
          <span className={`safeclaw-module-status ${status}`}>
            {status === "live" ? <i className="sc-blink sc-blink--good" aria-hidden="true" /> : null}
            {statusLabel[status]}
          </span>
          <Link href="/workspace" className="safeclaw-module-primary">작업 시작</Link>
        </header>

        <section className="safeclaw-module-hero">
          <div>
            <span className="safeclaw-module-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <aside>
            <span>업무 범위</span>
            <strong>{mappedTo}</strong>
            {actions ? <div className="safeclaw-module-actions">{actions}</div> : null}
          </aside>
        </section>

        {children}
      </section>
    </main>
  );
}
