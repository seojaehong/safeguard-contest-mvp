"use client";

import { useEffect, useRef, useState } from "react";

import WorkspaceLoading from "../../app/workspace/loading";

export function GlobalBoundaryProbe() {
  const [auditSurface, setAuditSurface] = useState<"none" | "global-error" | "loading">("none");
  const loadingProbeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundary = new URLSearchParams(window.location.search).get("__auditBoundary");
    if (boundary === "global-error") {
      setAuditSurface("global-error");
    } else if (boundary === "loading") {
      setAuditSurface("loading");
    }
  }, []);

  useEffect(() => {
    const probeElement = loadingProbeRef.current;
    if (auditSurface !== "loading" || !probeElement) return undefined;

    const siblings = [...document.body.children].filter(
      (element): element is HTMLElement => element instanceof HTMLElement
        && element !== probeElement
        && element.tagName !== "SCRIPT",
    );
    const priorHidden = siblings.map((element) => element.hidden);
    const priorHtmlOverflow = document.documentElement.style.overflow;
    const priorBodyOverflow = document.body.style.overflow;
    siblings.forEach((element) => { element.hidden = true; });
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      siblings.forEach((element, index) => { element.hidden = priorHidden[index]; });
      document.documentElement.style.overflow = priorHtmlOverflow;
      document.body.style.overflow = priorBodyOverflow;
    };
  }, [auditSurface]);

  if (auditSurface === "global-error") {
    throw new globalThis.Error("SafeClaw deterministic frontend audit global boundary probe");
  }

  if (auditSurface === "loading") {
    return (
      <div
        ref={loadingProbeRef}
        data-audit-boundary="loading"
        style={{ position: "relative", minHeight: "100vh", zIndex: 2147483647, overflow: "auto", background: "var(--bg)" }}
      >
        <WorkspaceLoading />
      </div>
    );
  }

  return null;
}
