"use client";

import { useEffect, useState } from "react";

export function AuditGlobalBoundaryTrigger({ enabled }: { enabled: boolean }) {
  const [shouldThrow, setShouldThrow] = useState(false);

  useEffect(() => {
    if (enabled && new URLSearchParams(window.location.search).get("__auditBoundary") === "global-error") {
      setShouldThrow(true);
    }
  }, [enabled]);

  if (shouldThrow) {
    throw new Error("SafeClaw deterministic frontend audit global boundary probe");
  }

  return null;
}
