import type { AgentConsoleLine } from "@/lib/agent-console-copy";

export type GenerationProgressState = {
  count: number;
  primary: string;
  secondary: string;
  detail: string;
};

type GenerationState = "idle" | "generating" | "ready" | "error";

const TERMINAL_STATUSES = new Set<AgentConsoleLine["status"]>(["ok", "warn", "fail"]);

function isTerminal(line: AgentConsoleLine): boolean {
  return TERMINAL_STATUSES.has(line.status);
}

function isStageLine(line: AgentConsoleLine): boolean {
  return line.id.startsWith("stage:");
}

function isDocLine(line: AgentConsoleLine): boolean {
  return line.id.startsWith("doc:");
}

function latestUsefulLine(lines: AgentConsoleLine[]): AgentConsoleLine | undefined {
  return [...lines].reverse().find((line) => line.id !== "final");
}

export function buildGenerationProgressState(input: {
  hasData: boolean;
  state: GenerationState;
  consoleLines: AgentConsoleLine[];
  totalDocumentCount: number;
  citationCount: number;
}): GenerationProgressState {
  const total = Math.max(1, input.totalDocumentCount);
  if (input.hasData) {
    return {
      count: total,
      primary: `${total}/${total}`,
      secondary: input.citationCount ? `${input.citationCount}건 근거` : "근거 연결",
      detail: "문서팩 준비가 끝났습니다."
    };
  }

  if (input.state !== "generating") {
    return {
      count: 0,
      primary: `0/${total}`,
      secondary: "근거 준비",
      detail: "현장 상황을 입력하면 기상, 법령, SIF/KOSHA DB를 순서대로 확인합니다."
    };
  }

  const terminalStages = input.consoleLines.filter((line) => isStageLine(line) && isTerminal(line)).length;
  const terminalDocs = input.consoleLines.filter((line) => isDocLine(line) && isTerminal(line)).length;
  const activeCount = input.consoleLines.filter((line) => line.status === "active").length;
  const activeBump = activeCount ? Math.max(1, Math.ceil(activeCount / 4)) : 0;
  const count = Math.min(total - 1, Math.max(3, 3 + activeBump + Math.floor(terminalStages / 2) + terminalDocs));
  const latest = latestUsefulLine(input.consoleLines);
  const detail = latest
    ? `${latest.label}${latest.status === "active" ? " 진행 중" : " 확인됨"}`
    : "기상, 법령, SIF/KOSHA DB를 순서대로 확인하고 있습니다.";

  return {
    count,
    primary: `${count}/${total}`,
    secondary: input.consoleLines.length
      ? `실시간 검토 ${input.consoleLines.length}건${activeCount ? ` · 진행 ${activeCount}건` : ""}`
      : "근거 확인 중",
    detail
  };
}
