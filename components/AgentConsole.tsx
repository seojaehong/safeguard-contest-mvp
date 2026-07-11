"use client";

import { useEffect, useRef } from "react";
import type { AgentConsoleLine, AgentConsoleLineStatus } from "@/lib/agent-console-copy";

export type { AgentConsoleLine, AgentConsoleLineStatus };

type AgentConsoleProps = {
  lines: AgentConsoleLine[];
  active: boolean;
};

const MAX_VISIBLE_LINES = 18;

function statusIcon(status: AgentConsoleLineStatus): string {
  if (status === "ok") return "✓";
  if (status === "warn") return "!";
  if (status === "fail") return "✗";
  if (status === "active") return "▸";
  return "·";
}

function hasReviewItems(lines: AgentConsoleLine[]): boolean {
  return lines.some((line) => line.status === "warn" || line.status === "fail");
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
  const visibleLines = lines.slice(-MAX_VISIBLE_LINES);
  const reviewItemCount = lines.filter((line) => line.status === "warn" || line.status === "fail").length;
  const open = active || hasReviewItems(lines);

  return (
    <details
      className={`agent-console ${active ? "agent-console-active workbench-loading-state" : ""}`}
      open={open}
      aria-label="작업 이력"
    >
      <summary className="agent-console-head">
        <span>작업 이력</span>
        <small>{active ? "실시간 검토 중" : reviewItemCount ? `검토 필요 ${reviewItemCount}건` : "완료됨"}</small>
        {active ? <span className="agent-console-live" aria-hidden="true" /> : null}
      </summary>
      <div className="agent-console-body" ref={scrollRef} role="log" aria-live={active ? "polite" : "off"}>
        {lines.length > visibleLines.length ? (
          <p className="agent-console-line agent-console-line-pending">
            <span className="agent-console-icon" aria-hidden="true">·</span>
            <span className="agent-console-label">이전 작업 로그 {lines.length - visibleLines.length}건 접힘</span>
          </p>
        ) : null}
        {visibleLines.map((line) => (
          <p key={line.id} className={`agent-console-line agent-console-line-${line.status}`}>
            <span className="agent-console-icon" aria-hidden="true">
              {statusIcon(line.status)}
            </span>
            <span className="agent-console-label">{line.label}</span>
            {line.detail ? <span className="agent-console-detail">{line.detail}</span> : null}
          </p>
        ))}
      </div>
    </details>
  );
}
