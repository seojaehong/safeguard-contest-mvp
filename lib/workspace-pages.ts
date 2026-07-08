export type WorkspacePage = "input" | "document" | "share";

export type WorkspaceStepStatus = "done" | "active" | "pending" | "locked";

type PageGateInput = {
  targetPage: WorkspacePage;
  hasWorkpack: boolean;
  isGenerating: boolean;
};

type StepStatusInput = {
  currentPage: WorkspacePage;
  hasWorkpack: boolean;
  isGenerating: boolean;
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
  if (input.targetPage === "share" && input.hasWorkpack) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: input.targetPage === "document" ? "문서 생성 후 열 수 있습니다." : "공유는 문서 생성 후 열 수 있습니다."
  };
}

export function buildWorkspaceStepStatuses(input: StepStatusInput): Record<WorkspacePage, WorkspaceStepStatus> {
  const hasDocumentStage = input.hasWorkpack || input.isGenerating;

  if (input.currentPage === "share" && input.hasWorkpack) {
    return {
      input: "done",
      document: "done",
      share: "active"
    };
  }

  if (input.currentPage === "document" && hasDocumentStage) {
    return {
      input: "done",
      document: "active",
      share: input.hasWorkpack ? "pending" : "locked"
    };
  }

  return {
    input: "active",
    document: hasDocumentStage ? "pending" : "locked",
    share: input.hasWorkpack ? "pending" : "locked"
  };
}
