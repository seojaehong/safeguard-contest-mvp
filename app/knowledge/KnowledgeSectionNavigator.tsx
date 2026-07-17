"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./KnowledgePage.module.css";

type KnowledgeSectionId = "today" | "technical" | "references" | "wiki" | "governance" | "diagnostics";

type KnowledgeSectionNavigatorProps = {
  children: ReactNode;
};

const DEFAULT_SECTION: KnowledgeSectionId = "today";

const SECTIONS: ReadonlyArray<{ id: KnowledgeSectionId; label: string; hash: string }> = [
  { id: "today", label: "오늘", hash: "#knowledge-today" },
  { id: "technical", label: "기술 지원", hash: "#technical-support-heading" },
  { id: "references", label: "참고자료", hash: "#reference-library-heading" },
  { id: "wiki", label: "위키", hash: "#wiki-index-heading" },
  { id: "governance", label: "검토 흐름", hash: "#knowledge-governance-heading" },
  { id: "diagnostics", label: "진단", hash: "#schema-heading" }
];

const DEFAULT_SECTION_DEFINITION = SECTIONS.find((section) => section.id === DEFAULT_SECTION) ?? SECTIONS[0];

function sectionFromHash(hash: string) {
  return SECTIONS.find((section) => section.hash === hash) ?? DEFAULT_SECTION_DEFINITION;
}

function revealTargetWhenNeeded(hash: string): void {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const rectangle = target.getBoundingClientRect();
    if (rectangle.top < 0 || rectangle.bottom > window.innerHeight) {
      target.scrollIntoView({ block: "start" });
    }
  });
}

export function KnowledgeSectionNavigator({ children }: KnowledgeSectionNavigatorProps) {
  const [activeSection, setActiveSection] = useState<KnowledgeSectionId>(DEFAULT_SECTION);
  const [enhanced, setEnhanced] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const syncSectionFromLocation = (): void => {
      const section = sectionFromHash(window.location.hash);
      setActiveSection(section.id);
      setEnhanced(true);
      if (SECTIONS.some((candidate) => candidate.hash === window.location.hash)) {
        revealTargetWhenNeeded(section.hash);
      }
    };

    syncSectionFromLocation();
    window.addEventListener("hashchange", syncSectionFromLocation);
    window.addEventListener("popstate", syncSectionFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncSectionFromLocation);
      window.removeEventListener("popstate", syncSectionFromLocation);
    };
  }, []);

  const selectTab = (index: number, moveFocus: boolean): void => {
    const section = SECTIONS[index];
    if (!section) return;
    setActiveSection(section.id);
    if (window.location.hash !== section.hash) {
      window.history.pushState(null, "", section.hash);
    }
    if (moveFocus) tabRefs.current[index]?.focus();
    revealTargetWhenNeeded(section.hash);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % SECTIONS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + SECTIONS.length) % SECTIONS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SECTIONS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex, true);
  };

  return (
    <div
      className={styles.sectionNavigator}
      data-active-section={activeSection}
      data-enhanced={enhanced ? "true" : undefined}
    >
      <nav className={styles.taskIndex} aria-label="지식 DB 작업 보기">
        <span className={styles.taskIndexLabel}>작업 보기</span>
        <div
          className={styles.tabList}
          role="tablist"
          aria-label="지식 DB 작업 보기"
          aria-orientation="horizontal"
        >
          {SECTIONS.map((section, index) => {
            const selected = activeSection === section.id;
            return (
              <button
                key={section.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                className={styles.sectionTab}
                id={`knowledge-tab-${section.id}`}
                type="button"
                role="tab"
                aria-controls={`knowledge-panel-${section.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(index, false)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className={styles.panelGroup}>{children}</div>
    </div>
  );
}
