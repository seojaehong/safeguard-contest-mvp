"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, type ReactNode } from "react";
import { getModuleNavModel } from "@/lib/module-navigation";

type ModuleStatus = "live" | "partial" | "planned";
type ModuleTheme = "day" | "night";

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

type PageDecisionHeaderProps = Pick<
  SafeClawModuleShellProps,
  "eyebrow" | "title" | "description" | "mappedTo" | "actions"
> & {
  command: { href: string; label: string };
};

function PageDecisionHeader({
  eyebrow,
  title,
  description,
  mappedTo,
  actions,
  command
}: PageDecisionHeaderProps) {
  return (
    <header className="safeclaw-page-decision-header" data-testid="page-decision-header">
      <div className="safeclaw-page-decision-copy">
        <span className="safeclaw-module-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <aside className="safeclaw-page-decision-action" aria-label="현재 모듈 결정">
        <div>
          <span>업무 범위</span>
          <strong>{mappedTo}</strong>
        </div>
        <div className="safeclaw-module-principal-command" data-principal-command>
          {actions ?? <Link href={command.href as Route}>{command.label}</Link>}
        </div>
      </aside>
    </header>
  );
}

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
  const [theme, setTheme] = useState<ModuleTheme>("day");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const queryTheme = new URLSearchParams(window.location.search).get("theme");
    const savedTheme = window.localStorage.getItem("safeclaw.moduleTheme");
    const nextTheme = queryTheme === "night" || queryTheme === "day"
      ? queryTheme
      : savedTheme === "night"
        ? "night"
        : "day";
    setTheme(nextTheme);
    setIsReady(true);
  }, []);

  function updateTheme(nextTheme: ModuleTheme) {
    setTheme(nextTheme);
    window.localStorage.setItem("safeclaw.moduleTheme", nextTheme);
    const url = new URL(window.location.href);
    url.searchParams.set("theme", nextTheme);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <main
      className={`safeclaw-module-shell module-variant-${variant}`}
      data-theme={theme}
      data-ready={isReady}
    >
      <aside className="safeclaw-module-rail" aria-label="SafeClaw 제품 메뉴">
        <div className="safeclaw-module-rail-head">
          <Link href="/" className="safeclaw-module-brand" aria-label="SafeClaw 홈">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ClawMark.svg" alt="" width={28} height={28} />
            <strong>SafeClaw</strong>
          </Link>
          <button
            type="button"
            className="safeclaw-module-menu-button"
            aria-controls="safeclaw-module-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
          >
            메뉴
          </button>
        </div>
        <p>현장 안전 문서팩</p>
        <nav
          id="safeclaw-module-navigation"
          className={mobileNavOpen ? "open" : ""}
          aria-label="SafeClaw 운영 메뉴"
        >
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
          <div className="safeclaw-module-theme-toggle" aria-label="화면 테마">
            <button
              type="button"
              className={theme === "day" ? "active" : ""}
              aria-pressed={theme === "day"}
              onClick={() => updateTheme("day")}
            >
              Day
            </button>
            <button
              type="button"
              className={theme === "night" ? "active" : ""}
              aria-pressed={theme === "night"}
              onClick={() => updateTheme("night")}
            >
              Night
            </button>
          </div>
        </header>

        <PageDecisionHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          mappedTo={mappedTo}
          actions={actions}
          command={navModel.principalCommand}
        />

        <div className="safeclaw-module-content">{children}</div>
      </section>
    </main>
  );
}
