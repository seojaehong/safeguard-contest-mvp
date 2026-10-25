export const SMOKE_USER_AGENT: string;
export const DEFAULT_BASE_URL: string;
export const DEFAULT_QUESTION: string;
export const DEFAULT_PAGES: string[];
export const USER_VISIBLE_ROOTS: string[];

export type SmokeCheck = {
  name: string;
  gate: "hard" | "report";
  ok: boolean;
  detail: string;
};

export type InternalCodeLeak = {
  path: string;
  rule: string;
  sample: string;
};

export type AiSurvivalSummary = {
  traceId: string | null;
  askMode: string | null;
  answerUsedInFinal: boolean;
  documentCount: number;
  survivedDocuments: string[];
  fallbackDocuments: string[];
};

export type AskEvaluation = {
  mode: "template" | "full";
  leakGate: "report" | "enforce";
  checks: SmokeCheck[];
  leaks: InternalCodeLeak[];
  aiSurvival: AiSurvivalSummary;
  statusLabels: { summary: unknown; ai: unknown; lawgo: unknown };
  ok: boolean;
};

export const TEMPLATE_EXPECTED_BLOCKED_ITEMS: string[];
export function evaluateQualityContract(body: unknown, mode: "template" | "full"): SmokeCheck;
export function findInternalCodeLeaks(body: unknown): InternalCodeLeak[];
export function summarizeAiSurvival(body: unknown): AiSurvivalSummary;
export function evaluateAskResponse(input: {
  httpStatus: number;
  body: unknown;
  mode: "template" | "full";
  leakGate?: "report" | "enforce";
}): AskEvaluation;
export function runSmoke(): Promise<unknown>;
