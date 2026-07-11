"use client";

import { useEffect, useState } from "react";

export function GlobalBoundaryProbe() {
  const [shouldThrow, setShouldThrow] = useState(false);

  useEffect(() => {
    const boundary = new URLSearchParams(window.location.search).get("__auditBoundary");
    if (boundary === "global-error") {
      setShouldThrow(true);
    }
  }, []);

  if (shouldThrow) {
    throw new globalThis.Error("SafeClaw deterministic frontend audit global boundary probe");
  }

  return null;
}
