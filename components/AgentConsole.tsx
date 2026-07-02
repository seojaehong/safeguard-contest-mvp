"use client";

import { useEffect, useRef } from "react";
import type { AgentConsoleLine, AgentConsoleLineStatus } from "@/lib/agent-console-copy";

export type { AgentConsoleLine, AgentConsoleLineStatus };

type AgentConsoleProps = {
  lines: AgentConsoleLine[];
  active: boolean;
};

function statusIcon(status: AgentConsoleLineStatus): string {
  if (status === "ok") return "✓";
  if (status === "fail") return "✗";
  if (status === "active") return "▸";
  return "·";
}

/**
 * Read-only, auto-scrolling console showing the SSE progress stream from
 * /api/ask/stream. Pure display: the caller owns state (lines are appended
 * upstream via lib/agent-console-copy.ts's nextConsoleLines reducer).
 */
export function AgentConsole({ lines, active }: AgentConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div
      className={`agent-console ${active ? "agent-console-active" : ""}`}
      role="log"
      aria-live="polite"
      aria-label="AI 작업 콘솔"
    >
      <div className="agent-console-head">
        <span>AI 작업 콘솔</span>
        {active ? <span className="agent-console-live" aria-hidden="true" /> : null}
      </div>
      <div className="agent-console-body" ref={scrollRef}>
        {lines.map((line) => (
          <p key={line.id} className={`agent-console-line agent-console-line-${line.status}`}>
            <span className="agent-console-icon" aria-hidden="true">
              {statusIcon(line.status)}
            </span>
            <span className="agent-console-label">{line.label}</span>
            {line.detail ? <span className="agent-console-detail">{line.detail}</span> : null}
          </p>
        ))}
      </div>
    </div>
  );
}
