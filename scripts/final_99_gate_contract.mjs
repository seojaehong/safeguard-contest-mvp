import path from "node:path";
import process from "node:process";

export const requiredDeliverables = [
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
];

export const coreDocumentChecks = [
  {
    id: "risk-assessment",
    title: "위험성평가표",
    key: "riskAssessmentDraft",
    routeTitle: "위험성평가표",
    requiredTerms: ["사전준비", "유해", "위험성", "감소대책", "확인"]
  },
  {
    id: "work-plan",
    title: "작업계획서",
    key: "workPlanDraft",
    routeTitle: "작업계획서",
    requiredTerms: ["작업개요", "작업순서", "장비", "작업중지", "확인"]
  },
  {
    id: "permit-inspection",
    title: "허가/점검표",
    key: "workPermitDraft",
    routeTitle: "작업허가 및 안전점검표",
    requiredTerms: ["허가", "격리", "차단", "종료", "보호구"]
  },
  {
    id: "tbm-log",
    title: "TBM일지",
    key: "tbmLogDraft",
    routeTitle: "TBM일지",
    requiredTerms: ["TBM", "위험성평가", "기상", "참석", "확인"]
  }
];

export function resolveExecutionMode(argv = process.argv.slice(2), env = process.env) {
  const noMutation = argv.includes("--no-mutation") || env.SAFEGUARD_NO_MUTATION === "1";
  return noMutation ? "no-mutation" : "standard";
}

export function resolveDocsDir(env = process.env, cwd = process.cwd()) {
  return path.resolve(env.SAFEGUARD_DOCS_DIR || path.join(cwd, "docs"));
}

export function shouldSkipAuthHistoryWrites(authToken, mode = resolveExecutionMode()) {
  return mode === "no-mutation" || !authToken;
}

export function resolveAskAiMode(mode = resolveExecutionMode(), env = process.env) {
  if (mode === "no-mutation") return "template";
  const configured = env.SAFEGUARD_FINAL99_AI_MODE;
  if (configured === "template" || configured === "enhanced" || configured === "full") return configured;
  return undefined;
}
