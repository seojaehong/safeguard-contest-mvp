import {
  parseSupportedLanguageCode,
  type SupportedLanguageCode
} from "@/lib/foreign-worker";

export type WorkspacePage = "input" | "document" | "share";
export type WorkspaceTheme = "day" | "night";

export const WORKSPACE_DOCUMENT_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPermitDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
] as const;

export type WorkspaceDocumentKey = typeof WORKSPACE_DOCUMENT_KEYS[number];

export type WorkspaceRouteState = {
  step: WorkspacePage;
  document: WorkspaceDocumentKey | null;
  language: SupportedLanguageCode | null;
  returnStep: "share" | null;
  theme: WorkspaceTheme;
};

type WorkspaceRouteParams = {
  step?: unknown;
  document?: unknown;
  language?: unknown;
  returnStep?: unknown;
  theme?: unknown;
};

export type ShareOwner =
  | "workers"
  | "worker-language"
  | "settings"
  | "login"
  | "document"
  | "translation";

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
  if (input.targetPage === "share" && input.hasWorkpack) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: input.targetPage === "document" ? "문서 생성 후 열 수 있습니다." : "공유는 문서 생성 후 열 수 있습니다."
  };
}

function parseWorkspacePage(value: unknown): WorkspacePage {
  return value === "input" || value === "document" || value === "share" ? value : "input";
}

function parseWorkspaceDocument(value: unknown): WorkspaceDocumentKey | null {
  return typeof value === "string" && WORKSPACE_DOCUMENT_KEYS.some((key) => key === value)
    ? value as WorkspaceDocumentKey
    : null;
}

function parseWorkspaceTheme(value: unknown): WorkspaceTheme {
  return value === "night" || value === "dark" ? "night" : "day";
}

export function resolveWorkspaceRouteState(params: WorkspaceRouteParams): WorkspaceRouteState {
  const parsedLanguage = parseSupportedLanguageCode(params.language);
  return {
    step: parseWorkspacePage(params.step),
    document: parseWorkspaceDocument(params.document),
    language: parsedLanguage.status === "supported" ? parsedLanguage.locale : null,
    returnStep: params.returnStep === "share" ? "share" : null,
    theme: parseWorkspaceTheme(params.theme)
  };
}

export function buildCanonicalShareReturnPath(theme: WorkspaceTheme): string {
  return `/workspace?step=share&theme=${theme}`;
}

function canonicalShareFallback(theme: WorkspaceTheme): string {
  return buildCanonicalShareReturnPath(theme);
}

export function resolveSafeShareReturnPath(value: unknown, fallbackTheme: WorkspaceTheme): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return canonicalShareFallback(fallbackTheme);
  }
  try {
    const url = new URL(value, "https://safeclaw.invalid");
    const keys = [...url.searchParams.keys()];
    const allowedKeys = new Set(["step", "theme"]);
    if (
      url.origin !== "https://safeclaw.invalid"
      || url.pathname !== "/workspace"
      || url.hash
      || keys.some((key) => !allowedKeys.has(key))
      || url.searchParams.getAll("step").length !== 1
      || url.searchParams.getAll("theme").length > 1
      || url.searchParams.get("step") !== "share"
    ) {
      return canonicalShareFallback(fallbackTheme);
    }
    const theme = url.searchParams.get("theme") === "night" ? "night" : fallbackTheme;
    return buildCanonicalShareReturnPath(theme);
  } catch (error) {
    console.warn("share return path parse failed", error);
    return canonicalShareFallback(fallbackTheme);
  }
}

export function buildShareOwnerHref(input: {
  owner: ShareOwner;
  theme: WorkspaceTheme;
  language?: unknown;
}): string {
  const shareReturn = buildCanonicalShareReturnPath(input.theme);
  if (input.owner === "workers" || input.owner === "worker-language") {
    const focus = input.owner === "worker-language" ? "focus=language&" : "";
    return `/workers?${focus}next=${encodeURIComponent(shareReturn)}`;
  }
  if (input.owner === "settings") {
    return `/settings?next=${encodeURIComponent(shareReturn)}`;
  }
  if (input.owner === "login") {
    return `/login?next=${encodeURIComponent(shareReturn)}`;
  }
  const language = parseSupportedLanguageCode(input.language);
  if (input.owner === "translation" && language.status === "supported") {
    return `/workspace?step=document&document=foreignWorkerTransmission&language=${language.locale}&returnStep=share&theme=${input.theme}`;
  }
  return `/workspace?step=document&returnStep=share&theme=${input.theme}`;
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
