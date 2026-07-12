"use client";

import { useEffect, useState } from "react";

import WorkspaceLoading from "../../app/workspace/loading";

export function GlobalBoundaryProbe() {
  const [auditSurface, setAuditSurface] = useState<"none" | "global-error" | "loading">("none");

  useEffect(() => {
    const boundary = new URLSearchParams(window.location.search).get("__auditBoundary");
    if (boundary === "global-error") {
      setAuditSurface("global-error");
    } else if (boundary === "loading") {
      setAuditSurface("loading");
    }
  }, []);

  if (auditSurface === "global-error") {
    throw new globalThis.Error("SafeClaw deterministic frontend audit global boundary probe");
  }

  if (auditSurface === "loading") {
    return (
      <div
        data-audit-boundary="loading"
        style={{ position: "fixed", inset: 0, zIndex: 2147483647, overflow: "auto", background: "var(--bg)" }}
      >
        <WorkspaceLoading />
      </div>
    );
  }

  return null;
}
