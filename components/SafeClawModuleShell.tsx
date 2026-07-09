import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { getModuleNavModel } from "@/lib/module-navigation";

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
  variant?: "default" | "document";
};

export function SafeClawModuleShell({
  eyebrow,
  title,
  description,
  status,
  mappedTo,
  children,
  actions,
  activeHref,
  variant = "document"
}: SafeClawModuleShellProps) {
  const navModel = getModuleNavModel(activeHref);

  return (
    <main className={`safeclaw-module-shell module-variant-${variant}`}>
      <aside className="safeclaw-module-rail" aria-label="SafeClaw 제품 메뉴">
        <Link href="/" className="safeclaw-module-brand" aria-label="SafeClaw 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ClawMark.svg" alt="" width={28} height={28} />
          <strong>SafeClaw</strong>
        </Link>
        <p>현장 안전 문서팩</p>
        <nav aria-label="SafeClaw 운영 메뉴">
          <section className="safeclaw-module-primary-nav">
            <h2>주요 메뉴</h2>
            {navModel.primaryItems.map((item) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className={item.isActive ? "active" : ""}
                aria-current={item.isActive ? "page" : undefined}
              >
                <span>{item.code}</span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </Link>
            ))}
          </section>
          {navModel.secondaryItems.length ? (
            <section className="safeclaw-module-secondary-nav">
              <h2>{navModel.activeSection.label} 관련</h2>
              {navModel.secondaryItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className={item.isActive ? "active" : ""}
                  aria-current={item.isActive ? "page" : undefined}
                >
                  <span>{item.code}</span>
                  <strong>{item.label}</strong>
                </Link>
              ))}
            </section>
          ) : null}
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

        {/* 시그니처 패턴 3/4: HudCorners — 모듈 페이지마다 1개 hero 프레임에만 적용. */}
        <section className={`safeclaw-module-hero ${variant === "document" ? "document" : ""} hud-corners`}>
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
