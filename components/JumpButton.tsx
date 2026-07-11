"use client";

import { useEffect, useState } from "react";

interface JumpButtonProps {
  id: string;
  children: React.ReactNode;
}

export function JumpButton({ id, children }: JumpButtonProps) {
  function handleClick() {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

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
