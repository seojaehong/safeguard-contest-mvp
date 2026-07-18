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

type ModuleChromeLabels = {
  skipLink: string;
  railAria: string;
  homeAria: string;
  menu: string;
  productSubtitle: string;
  mappedTo: string;
  decisionAria: string;
  siteContext: string;
  evidenceContext: string;
  weatherContext: string;
  themeAria: string;
  dayLabel: string;
  nightLabel: string;
  status: Record<ModuleStatus, string>;
};

const defaultChromeLabels: ModuleChromeLabels = {
  skipLink: "본문으로 건너뛰기",
  railAria: "SafeClaw 제품 메뉴",
  homeAria: "SafeClaw 홈",
  menu: "메뉴",
  productSubtitle: "현장 안전 문서팩",
  mappedTo: "업무 범위",
  decisionAria: "현재 모듈 결정",
  siteContext: "SITE 기본 현장",
  evidenceContext: "공공 근거",
  weatherContext: "기상청",
  themeAria: "화면 테마",
  dayLabel: "Day",
  nightLabel: "Night",
  status: statusLabel
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
  chromeLabels?: Partial<Omit<ModuleChromeLabels, "status">> & {
    status?: Partial<Record<ModuleStatus, string>>;
  };
};

type PageDecisionHeaderProps = Pick<
  SafeClawModuleShellProps,
  "eyebrow" | "title" | "description" | "mappedTo" | "actions"
> & {
  command: { href: string; label: string };
  chromeLabels: ModuleChromeLabels;
};

function PageDecisionHeader({
  eyebrow,
  title,
  description,
  mappedTo,
  actions,
  command,
  chromeLabels
}: PageDecisionHeaderProps) {
  return (
    <header className="safeclaw-page-decision-header safeclaw-module-header" data-testid="page-decision-header">
      <div className="safeclaw-page-decision-copy">
        <span className="safeclaw-module-eyebrow">{eyebrow}</span>
        <h1 className="safeclaw-module-title">{title}</h1>
        <p className="safeclaw-module-description">{description}</p>
      </div>
      <aside className="safeclaw-page-decision-action" aria-label={chromeLabels.decisionAria}>
        <div>
          <span>{chromeLabels.mappedTo}</span>
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
  variant = "document",
  chromeLabels: chromeLabelOverrides
}: SafeClawModuleShellProps) {
  const navModel = getModuleNavModel(activeHref);
  const [theme, setTheme] = useState<ModuleTheme>("day");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const chromeLabels: ModuleChromeLabels = {
    ...defaultChromeLabels,
    ...chromeLabelOverrides,
    status: {
      ...defaultChromeLabels.status,
      ...chromeLabelOverrides?.status
    }
  };

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
    <div
      className={`safeclaw-module-shell module-variant-${variant}`}
      data-theme={theme}
      data-ready={isReady}
      data-module-route={activeHref}
    >
      <a className="safeclaw-skip-link" href="#safeclaw-module-main">
        {chromeLabels.skipLink}
      </a>
      <aside key={`module-rail-${theme}`} className="safeclaw-module-rail" aria-label={chromeLabels.railAria}>
        <div className="safeclaw-module-rail-head">
          <Link href="/" className="safeclaw-module-brand" aria-label={chromeLabels.homeAria}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ClawMark.svg" alt="" width={28} height={28} />
            <strong>SafeClaw</strong>
          </Link>
          <button
            type="button"
            className="safeclaw-module-menu-button safeclaw-module-chrome-button"
            aria-controls="safeclaw-module-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
          >
            {chromeLabels.menu}
          </button>
        </div>
        <p>{chromeLabels.productSubtitle}</p>
        <nav
          id="safeclaw-module-navigation"
          className={`safeclaw-module-navigation${mobileNavOpen ? " open" : ""}`}
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

      <main id="safeclaw-module-main" className="safeclaw-module-main" tabIndex={-1}>
        <header key={`module-nav-${theme}`} className="safeclaw-module-nav">
          <span><i /> {chromeLabels.siteContext}</span>
          <span>{chromeLabels.evidenceContext} <b>Law.go</b> · <b>KOSHA</b> · {chromeLabels.weatherContext}</span>
          <span className={`safeclaw-module-status ${status}`}>
            {status === "live" ? <i className="sc-blink sc-blink--good" aria-hidden="true" /> : null}
            {chromeLabels.status[status]}
          </span>
          <div className="safeclaw-module-theme-toggle" role="group" aria-label={chromeLabels.themeAria}>
            <button
              type="button"
              className={`safeclaw-module-chrome-button${theme === "day" ? " active" : ""}`}
              aria-pressed={theme === "day"}
              onClick={() => updateTheme("day")}
            >
              {chromeLabels.dayLabel}
            </button>
            <button
              type="button"
              className={`safeclaw-module-chrome-button${theme === "night" ? " active" : ""}`}
              aria-pressed={theme === "night"}
              onClick={() => updateTheme("night")}
            >
              {chromeLabels.nightLabel}
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
          chromeLabels={chromeLabels}
        />

        <div className="safeclaw-module-content">{children}</div>
      </main>
    </div>
  );
}
