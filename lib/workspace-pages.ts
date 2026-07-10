export type WorkspacePage = "input" | "document" | "share";

export type WorkspaceStepStatus = "done" | "active" | "pending" | "locked" | "blocked";

type PageGateInput = {
  targetPage: WorkspacePage;
  hasWorkpack: boolean;
  isGenerating: boolean;
  canShare?: boolean;
};

type StepStatusInput = {
  currentPage: WorkspacePage;
  hasWorkpack: boolean;
  isGenerating: boolean;
  canShare?: boolean;
};

export function nextWorkspacePageAfterGenerate(): WorkspacePage {
  return "document";
}

export function nextWorkspacePageAfterGenerationError(): WorkspacePage {
  return "input";
}

export function canOpenWorkspacePage(input: PageGateInput): { allowed: boolean; reason?: string } {
  if (input.targetPage === "input") {
    return { allowed: true };
  }
  if (input.targetPage === "document" && (input.hasWorkpack || input.isGenerating)) {
    return { allowed: true };
  }
  if (input.targetPage === "share" && input.hasWorkpack && input.canShare !== false) {
    return { allowed: true };
  }
  if (input.targetPage === "share" && input.hasWorkpack && input.canShare === false) {
    return { allowed: false, reason: "공유 전 검수와 보완을 완료해 주세요." };
  }
  return {
    allowed: false,
    reason: input.targetPage === "document" ? "문서 생성 후 열 수 있습니다." : "공유는 문서 생성 후 열 수 있습니다."
  };
}

export function buildWorkspaceStepStatuses(input: StepStatusInput): Record<WorkspacePage, WorkspaceStepStatus> {
  const hasDocumentStage = input.hasWorkpack || input.isGenerating;
  const canShare = input.canShare ?? input.hasWorkpack;
  const shareStatus: WorkspaceStepStatus = input.hasWorkpack
    ? canShare ? "pending" : "blocked"
    : "locked";

  if (input.currentPage === "share" && input.hasWorkpack) {
    return {
      input: "done",
      document: canShare ? "done" : "blocked",
      share: "active"
    };
  }

  if (input.currentPage === "document" && hasDocumentStage) {
    return {
      input: "done",
      document: "active",
      share: shareStatus
    };
  }

  return {
    input: "active",
    document: hasDocumentStage ? "pending" : "locked",
    share: shareStatus
  };
}
