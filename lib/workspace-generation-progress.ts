import type { AgentConsoleLine } from "@/lib/agent-console-copy";

export type GenerationProgressState = {
  count: number;
  primary: string;
  secondary: string;
  detail: string;
  indeterminate: boolean;
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
  mode?: "template" | "enhanced" | "full";
  shareReady?: boolean | null;
  reviewSummary?: string;
}): GenerationProgressState {
  const total = Math.max(1, input.totalDocumentCount);
  if (input.state === "generating") {
    if (input.mode === "template" && input.consoleLines.length === 0) {
      return {
        count: 0,
        primary: "생성 중",
        secondary: "근거·문서 일괄 확인",
        detail: "검증된 템플릿과 현장 근거를 한 번에 적용하고 있습니다.",
        indeterminate: true
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
      detail,
      indeterminate: false
    };
  }

  if (input.hasData) {
    const reviewLabel = input.shareReady === true
      ? "공유 준비"
      : input.shareReady === false
        ? "검수 필요"
        : "검수 상태 확인";
    const evidenceLabel = input.citationCount ? `${input.citationCount}건 근거` : "근거 연결";
    return {
      count: total,
      primary: `${total}/${total} 생성`,
      secondary: `${reviewLabel} · ${evidenceLabel}`,
      detail: input.reviewSummary || (input.shareReady === true
        ? "문서 생성과 공유 전 검수가 끝났습니다."
        : "문서 생성은 끝났으며 공유 전 검수가 필요합니다."),
      indeterminate: false
    };
  }

  return {
    count: 0,
    primary: `0/${total}`,
    secondary: "근거 준비",
    detail: "현장 상황을 입력하면 기상, 법령, SIF/KOSHA DB를 순서대로 확인합니다.",
    indeterminate: false
  };
}
