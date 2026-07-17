import { randomUUID } from "node:crypto";
import { AskResponse, type GenerationDeliverableModelTrace, type GenerationTrace, type PermitInspectionStructured, type TbmBriefingStructured, type TbmLogStructured, type TbmRiskLink, type WorkPlanStructured } from "./types";
import {
  applyPhaseAAnswerBoundary,
  enhanceLegalEvidenceMappings,
  generateAnswer,
  type AnswerGenerationResult,
} from "./ai";
import { buildMockAskResponse, inferScenario, mockSearchResults } from "./mock-data";
import { attachQualityContract } from "./quality-contract";
import { attachWebOntologyQa } from "./workpack-ontology-qa";
import { buildFailedDeliverablesDiagnostics, generateAllDeliverables, generateAllDeliverablesWithDiagnostics, type AiDeliverablesDiagnostics, type AiMode } from "./ai-deliverables";
import { buildGroundedGenerationPacket, type GroundedGenerationPacket } from "./grounded-generation-contract";
import {
  buildPhaseACanonicalAnswer,
  type PhaseAGenerationGrounding,
} from "./ontology/evidence-chain";
import {
  deriveSafetyReferenceOperationalView,
  deriveSafetyReferenceRetrievalModeFromItems,
  filterAndRankSafetyReferencesByQuery,
  getKoshaGroundingDecision,
  getSafetyReferenceDisplayTitle,
  isKoshaSupportingCitationEligible,
  isKoshaTechnicalReference,
  isSafetyReferenceDirectEligible,
  isSafetyReferenceRiskEligible,
  SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
  SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE,
  type KoshaGroundingReason,
  type SafetyReferenceItem,
  type SafetyReferenceRetrievalMode,
  type SafetyReferenceSearchResult
} from "./safety-reference-catalog";
import { searchSafetyReferences } from "./safety-reference-catalog-server";
import { loadLegalDetail, searchLegalSources } from "./legal-sources";
import { summarizeLegalSourceMix } from "./legal-sources";
import { fetchWeatherSignal } from "./weather";
import { fetchTrainingRecommendations } from "./work24";
import { fetchKoshaEducationRecommendations } from "./kosha-education";
import { fetchKoshaReferences } from "./kosha";
import { fetchAccidentCases } from "./accident-cases";
import { fetchKoshaOpenApiEvidence } from "./kosha-openapi";
import { buildForeignWorkerBriefing, buildForeignWorkerLanguages, buildForeignWorkerTransmission, reconcileLanguages } from "./foreign-worker";
import { matchSafetyKnowledge } from "./safety-knowledge";
import { validateRiskAssessmentRows, type AccidentType, type FourM, type RiskAssessmentRow, type RiskAssessmentValidationIssue } from "./risk-assessment-schema";
import { splitDocumentMeta } from "./doc-meta-split";
import { buildEvidenceLabels } from "./smsa-mapping";
import { createLogger } from "@/lib/logger";
import { attachProgressListeners, safeEmit, type OnAskProgress } from "./ask-progress";
import { resolveRunAskMode } from "./run-ask-mode";
import {
  buildDbHarnessAnswer,
  buildDbHarnessPacket,
  buildDbHarnessPracticalPoints,
  buildHarnessPromptContext,
  buildPublicDbHarnessPacket,
  hasRelevantKoshaParent,
  type DbHarnessPacket,
  type HarnessImprovement,
  type HarnessMemoryInput
} from "./db-harness";

const log = createLogger("search");

function buildPhaseACanonicalDeliverables(
  grounding: PhaseAGenerationGrounding,
): AskResponse["deliverables"] {
  const canonicalText = buildPhaseACanonicalAnswer(grounding);
  return {
    workpackSummaryDraft: canonicalText,
    riskAssessmentDraft: canonicalText,
    workPlanDraft: canonicalText,
    tbmBriefing: canonicalText,
    tbmLogDraft: canonicalText,
    safetyEducationRecordDraft: canonicalText,
    emergencyResponseDraft: canonicalText,
    photoEvidenceDraft: canonicalText,
    foreignWorkerBriefing: canonicalText,
    foreignWorkerTransmission: canonicalText,
    foreignWorkerLanguages: [],
    safetyEducationPoints: [],
    tbmQuestions: [],
    kakaoMessage: canonicalText,
  };
}

function buildPhaseACanonicalSummary(
  _response: AskResponse,
  _grounding: PhaseAGenerationGrounding,
): Pick<AskResponse, "riskSummary" | "practicalPoints"> {
  const reviewRequired = ["현장 확인 필요"];
  return {
    riskSummary: {
      title: "현장 확인 필요",
      riskLevel: "현장 확인 필요",
      topRisk: "현장 확인 필요",
      immediateActions: reviewRequired,
    },
    practicalPoints: reviewRequired,
  };
}

function applyPhaseAResponseBoundary(
  response: AskResponse,
  grounding?: PhaseAGenerationGrounding,
): AskResponse {
  if (!grounding) return response;
  return {
    ...applyPhaseAAnswerBoundary(response, grounding),
    ...buildPhaseACanonicalSummary(response, grounding),
    deliverables: buildPhaseACanonicalDeliverables(grounding),
    structured: {
      riskAssessmentRows: [],
      tbmRiskLinks: [],
      riskAssessmentValidation: {
        ok: false,
        issueCount: 0,
        issues: [],
      },
    },
  };
}

function buildParentlessKoshaReviewDeliverables(
  question: string,
  citations: AskResponse["citations"]
): AskResponse["deliverables"] {
  return buildMockAskResponse(
    question,
    citations,
    "mock",
    "KOSHA 기술 보조지침은 SIF 사례 또는 직접 근거 확인 전 검토가 필요합니다."
  ).deliverables;
}

function safeFailureContext(error: unknown): { errorType: string } {
  return { errorType: error instanceof Error ? error.name : typeof error };
}

function buildGroundingReview(
  grounding: AiDeliverablesDiagnostics["grounding"]
): AskResponse["groundingReview"] {
  if (!grounding || grounding.status !== "review_required") return undefined;
  return {
    status: "review_required",
    sourceIdentity: grounding.sourceIdentity,
    criticalControls: [...grounding.criticalControls],
    rejectedGroups: [...grounding.rejectedGroups],
    violations: grounding.violations.map((violation) => ({ ...violation }))
  };
}

const FINAL_DELIVERABLE_TRACE_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "workPlanStructured",
  "permitInspectionStructured",
  "tbmBriefing",
  "tbmBriefingStructured",
  "tbmLogDraft",
  "tbmLogStructured",
  "safetyEducationRecordDraft",
  "educationRecordStructured",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
] as const;

function buildFinalAnswerTrace(upstream: AnswerGenerationResult["trace"]): GenerationTrace["answer"] {
  return {
    provider: "safeclaw",
    model: null,
    composition: "safeclaw_db_harness",
    upstream: {
      provider: upstream.provider,
      model: upstream.model,
      fallbackUsed: upstream.fallbackUsed,
      usedInFinal: false
    }
  };
}

function deterministicDeliverableTrace(fallbackUsed: boolean): GenerationDeliverableModelTrace {
  return {
    provider: "safeclaw",
    model: null,
    source: "deterministic",
    fallbackUsed
  };
}

function summarizeFinalDeliverablesProvider(
  modelPerDocument: Record<string, GenerationDeliverableModelTrace>
): GenerationTrace["deliverables"]["provider"] {
  const providers = new Set(Object.values(modelPerDocument).map((item) => item.provider));
  if (!providers.size) return null;
  if (providers.size > 1) return "mixed";
  return providers.values().next().value ?? null;
}

function finalizeDeliverablesTrace(
  response: AskResponse,
  execution: GenerationTrace["deliverables"] & { fallbackUsed: boolean }
): GenerationTrace["deliverables"] & { fallbackUsed: boolean } {
  const modelPerDocument = { ...execution.modelPerDocument };
  for (const key of FINAL_DELIVERABLE_TRACE_KEYS) {
    if (typeof response.deliverables[key] !== "undefined" && !modelPerDocument[key]) {
      modelPerDocument[key] = deterministicDeliverableTrace(false);
    }
  }
  if (response.structured?.riskAssessmentRows.length && !modelPerDocument.structuredRiskRows) {
    modelPerDocument.structuredRiskRows = deterministicDeliverableTrace(false);
  }
  if (response.structured?.tbmRiskLinks?.length && !modelPerDocument.tbmRiskLinks) {
    modelPerDocument.tbmRiskLinks = deterministicDeliverableTrace(false);
  }
  return {
    attempted: execution.attempted,
    provider: summarizeFinalDeliverablesProvider(modelPerDocument),
    modelPerDocument,
    fallbackUsed: execution.fallbackUsed
      || Object.values(modelPerDocument).some((item) => item.fallbackUsed === true)
  };
}

export async function runSearch(query: string) {
  return searchLegalSources(query);
}

function inferLegalEvidenceMode(sourceMix: ReturnType<typeof summarizeLegalSourceMix>): AskResponse["status"]["lawgo"] {
  if ((sourceMix.counts.lawgo || 0) > 0 || (sourceMix.counts["korean-law-mcp"] || 0) > 0) {
    return "live";
  }
  if ((sourceMix.counts.mock || 0) > 0) {
    return "fallback";
  }
  return "mock";
}

function riskLevelFrom(likelihood: number, severity: number): RiskAssessmentRow["riskLevel"] {
  const score = likelihood * severity;
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

export function normalizeRiskAssessmentRiskLevels(rows: RiskAssessmentRow[]): RiskAssessmentRow[] {
  return rows.map((row) => ({
    ...row,
    riskLevel: riskLevelFrom(row.likelihood, row.severity)
  }));
}

export function normalizeAndValidateRiskAssessmentRows(rows: RiskAssessmentRow[]): {
  rows: RiskAssessmentRow[];
  issues: RiskAssessmentValidationIssue[];
} {
  const normalized = normalizeRiskAssessmentRiskLevels(rows);
  const validation = validateRiskAssessmentRows(normalized);
  return { rows: validation.rows, issues: validation.issues };
}

function inferFourM(text: string): FourM {
  if (/비계|지게차|장비|기계|차량|전기|용접|공구|호스|배관|펌프|밸브/.test(text)) return "Machine";
  if (/강풍|우천|폭염|자외선|누수|천장|바닥|밀폐|환기|화학|가스|분진/.test(text)) return "Media";
  if (/신규|외국인|고령|2인|작업자|숙련|피로|보호구/.test(text)) return "Man";
  return "Management";
}

function inferAccidentType(text: string): AccidentType {
  if (/추락|고소|비계|개구부|사다리/.test(text)) return "fall";
  if (/미끄|우천|바닥|전도/.test(text)) return "slip";
  if (/지게차|차량|동선|충돌|교통/.test(text)) return "traffic";
  if (/끼임|협착|말림/.test(text)) return "caughtIn";
  if (/화학|세정|유해|누출|가스|분진/.test(text)) return "chemicalExposure";
  if (/폭염|온열|열사병|자외선/.test(text)) return "heatIllness";
  if (/화기|용접|화재|폭발/.test(text)) return "fireExplosion";
  if (/밀폐|산소|질식/.test(text)) return "asphyxiation";
  if (/감전|전기/.test(text)) return "electricShock";
  if (/붕괴|전도|전복/.test(text)) return "collapse";
  return "other";
}

function buildRiskRow(params: {
  location: string;
  process: string;
  task: string;
  equipment: string;
  hazard: string;
  currentControls: string;
  likelihood: number;
  severity: number;
  additionalControls: string;
  owner: string;
  due: string;
  verification: string;
  verificationChecker: string;
  evidenceRefs: string[];
  verificationStatus?: RiskAssessmentRow["verificationStatus"];
}): RiskAssessmentRow {
  const hazardContext = `${params.task} ${params.equipment} ${params.hazard}`;
  return {
    location: params.location,
    process: params.process,
    task: params.task,
    equipment: params.equipment,
    hazard: params.hazard,
    fourM: inferFourM(hazardContext),
    accidentType: inferAccidentType(hazardContext),
    currentControls: params.currentControls,
    likelihood: params.likelihood,
    severity: params.severity,
    riskLevel: riskLevelFrom(params.likelihood, params.severity),
    additionalControls: params.additionalControls,
    owner: params.owner,
    due: params.due,
    verification: params.verification,
    verificationStatus: params.verificationStatus || "planned",
    verificationDate: params.due,
    verificationChecker: params.verificationChecker,
    whyLikelihood: `${params.location}의 작업 조건과 ${params.equipment} 사용 상태를 고려해 발생 가능성을 ${params.likelihood}로 산정했습니다.`,
    whySeverity: `${params.hazard} 발생 시 작업중지, 부상 또는 중대재해로 이어질 수 있어 중대성을 ${params.severity}로 산정했습니다.`,
    evidenceRefs: params.evidenceRefs
  };
}

function buildFallbackRiskAssessmentRows(response: AskResponse, weatherSummary: string): RiskAssessmentRow[] {
  const scenario = response.scenario;
  const topRisk = response.riskSummary.topRisk || "작업 조건 변화로 인한 현장 안전 위험";
  const actions = response.riskSummary.immediateActions.length
    ? response.riskSummary.immediateActions
    : ["작업 전 현장 점검", "작업중지 기준 공유", "관리감독자 확인"];
  const workText = `${scenario.workSummary} ${topRisk}`;
  const weatherText = weatherSummary || scenario.weatherNote || "기상청 현재·예보 신호 확인";
  const location = scenario.siteName || "현장 작업구역";
  const process = response.riskSummary.title || scenario.companyType || "현장 작업";
  const due = "현장 확인";

  const paintFireRows: RiskAssessmentRow[] = /도장|도료|페인트|유기용제|방수/.test(workText)
    ? [
        buildRiskRow({
          location,
          process,
          task: "도장 자재 취급 및 작업구역 환기",
          equipment: "도료, 희석제, 환기장치, 소화기, 점화원 관리표지",
          hazard: "도료·희석제 증기와 점화원 관리 미흡으로 인한 화재·폭발 및 유해증기 노출 위험",
          currentControls: "도료·희석제 보관 상태, 환기 상태, 소화기 배치, 흡연·용접 등 점화원 금지를 확인합니다.",
          likelihood: 3,
          severity: 5,
          additionalControls: "작업 전 MSDS와 사용량을 공유하고 밀폐·강풍 조건에서는 환기와 작업중지 기준을 함께 확인합니다.",
          owner: "작업반장",
          due,
          verification: "도장 자재 반입 전 MSDS, 환기, 소화기, 점화원 통제 상태를 현장 사진과 TBM으로 확인",
          verificationChecker: "관리감독자",
          evidenceRefs: ["KOSHA 위험성평가", "MSDS", "화재·폭발 예방 조치", "TBM 기록"]
        })
      ]
    : [];

  return [
    ...paintFireRows,
    buildRiskRow({
      location,
      process,
      task: scenario.workSummary,
      equipment: /비계/.test(workText) ? "이동식 비계, 작업발판, 보호구" : /지게차/.test(workText) ? "지게차, 팔레트, 하역구역 표지" : "작업 장비·공구·보호구",
      hazard: topRisk,
      currentControls: "작업 전 장비 상태, 작업구역, 보호구 착용 상태를 확인합니다.",
      likelihood: 4,
      severity: 5,
      additionalControls: actions[0] || "작업 전 핵심 위험요인과 통제대책을 TBM에서 공유합니다.",
      owner: "작업반장",
      due,
      verification: "작업 시작 전 현장 점검과 TBM 구두 복창으로 확인",
      verificationChecker: "관리감독자",
      evidenceRefs: ["산업안전보건법", "KOSHA 위험성평가", "문서팩 입력 조건"]
    }),
    buildRiskRow({
      location,
      process,
      task: "작업환경 및 기상 조건 확인",
      equipment: "기상청 현재·예보, 작업중지 기준표",
      hazard: `${weatherText}에 따른 작업환경 변화 위험`,
      currentControls: "기상 변화와 작업장 바닥·시야·풍속 상태를 작업 전 확인합니다.",
      likelihood: /강풍|우천|폭염|위험|높음/.test(weatherText) ? 4 : 3,
      severity: /강풍|폭염|위험/.test(weatherText) ? 4 : 3,
      additionalControls: actions[1] || "기상 악화 또는 위험 징후 체감 시 즉시 작업을 중지하고 대기합니다.",
      owner: "관리감독자",
      due,
      verification: "기상청 신호와 현장 체감 조건을 함께 확인해 작업 지속 여부 결정",
      verificationChecker: "현장소장",
      evidenceRefs: ["기상청 현재·예보", "KOSHA 위험성평가", "작업중지 기준"]
    }),
    buildRiskRow({
      location,
      process,
      task: "장비·도구 안전점검",
      equipment: /누수|천장/.test(workText) ? "사다리, 전동공구, 누수 점검 장비" : "작업 장비, 공구, 방호장치",
      hazard: "장비·도구 상태 불량 또는 방호조치 미흡으로 인한 사고 위험",
      currentControls: "사용 전 외관, 고정상태, 전원·잠금·방호장치 상태를 점검합니다.",
      likelihood: 3,
      severity: 4,
      additionalControls: "이상 발견 시 해당 장비 사용을 중지하고 대체 장비 또는 보수 후 작업합니다.",
      owner: "장비 담당자",
      due,
      verification: "장비별 점검 체크와 사진 증빙으로 확인",
      verificationChecker: "작업반장",
      evidenceRefs: ["KOSHA 안전작업 지침", "장비 점검표", "사진·증빙 기록"]
    }),
    buildRiskRow({
      location,
      process,
      task: "작업자 배치 및 의사소통",
      equipment: "보호구, 무전·휴대전화, 다국어 안내문",
      hazard: "신규·외국인·소수 인원 작업에서 지시 미이해 또는 단독작업으로 인한 위험",
      currentControls: "작업 전 역할, 연락체계, 보호구 착용, 이해 여부를 확인합니다.",
      likelihood: /신규|외국인|2인|소수/.test(workText) ? 4 : 3,
      severity: 3,
      additionalControls: "핵심 위험 문구를 쉬운 한국어와 필요 언어로 공유하고 이해하지 못하면 작업을 시작하지 않습니다.",
      owner: "작업반장",
      due,
      verification: "TBM 참석자 확인, 구두 복창, 서명 또는 전송 로그로 확인",
      verificationChecker: "관리감독자",
      evidenceRefs: ["안전보건교육 기록", "외국인 근로자 안내문", "TBM 기록"]
    }),
    buildRiskRow({
      location,
      process,
      task: "관리체계 및 조치 확인",
      equipment: "위험성평가표, TBM일지, 사진·증빙 기록",
      hazard: "위험성평가 결과가 TBM·교육·현장 전파로 이어지지 않아 조치가 누락될 위험",
      currentControls: "위험성평가 결과와 즉시조치 항목을 문서팩과 TBM에 함께 반영합니다.",
      likelihood: 2,
      severity: 3,
      additionalControls: actions[2] || "조치 담당자, 확인자, 확인시각을 남기고 미조치 항목은 후속조치로 분리합니다.",
      owner: "현장소장",
      due,
      verification: "문서팩 저장, 전파 로그, 사진 증빙, 확인자 서명으로 추적",
      verificationChecker: "안전관리 담당자",
      evidenceRefs: ["산업안전보건법", "KOSHA TBM OPS", "전파·이력 로그"]
    })
  ];
}

function compactRiskCell(value: string | null | undefined, maxLength = 96): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function includesRiskAssessmentDocument(item: SafetyReferenceItem): boolean {
  const documents = [...(item.primary_documents || []), ...(item.reflected_documents || [])];
  return documents.length === 0 || documents.some((document) =>
    /위험성평가|TBM|티비엠|안전보건교육|작업계획/.test(document)
  );
}

const MAX_SUPPORTING_KOSHA_REFS_PER_RISK_ROW = 2;

function isSafetyReferenceRiskParentEligible(item: SafetyReferenceItem): boolean {
  if (item.item_type === "sif-case") return true;
  return item.evidence_role === "direct" && isSafetyReferenceDirectEligible(item);
}

function getSupportingKoshaEvidenceRef(item: SafetyReferenceItem): string {
  if (!isKoshaSupportingCitationEligible(item)) return "";
  if (item.kosha_guide?.evidenceRef) return item.kosha_guide.evidenceRef;
  const grounding = getKoshaGroundingDecision(item);
  const metadata = grounding?.metadata;
  if (!metadata) return "";
  return compactRiskCell(
    `KOSHA 기술 보조지침 ${metadata.currentVersion}: ${getSafetyReferenceDisplayTitle(item)} · ${metadata.provenance}`,
    240
  );
}

function buildKoshaParentEvidenceReadyIds(packet: DbHarnessPacket): Set<string> {
  const parentCandidates = [...packet.sifCases, ...packet.directEvidence];
  const exactDirectIds = packet.directEvidence
    .filter(isKoshaTechnicalReference)
    .filter(isSafetyReferenceDirectEligible)
    .map((item) => item.id);
  const parentReadySupportingIds = packet.supportingEvidence
    .filter(isKoshaTechnicalReference)
    .filter((item) => hasRelevantKoshaParent(item, parentCandidates))
    .map((item) => item.id);
  return new Set([...exactDirectIds, ...parentReadySupportingIds]);
}

export function buildSafetyReferenceRiskRows(
  response: AskResponse,
  references: readonly SafetyReferenceItem[],
  weatherSummary: string,
  query?: string
): RiskAssessmentRow[] {
  const scenario = response.scenario;
  const location = scenario.siteName || "현장 작업구역";
  const process = response.riskSummary.title || scenario.companyType || "현장 작업";
  const rankQuery = query || [
    scenario.siteName,
    scenario.workSummary,
    response.riskSummary.title,
    response.riskSummary.topRisk
  ].filter(Boolean).join(" ");
  const eligibleReferences = references
    .filter(isSafetyReferenceRiskEligible)
    .filter(isSafetyReferenceRiskParentEligible)
    .filter(includesRiskAssessmentDocument)
    .filter((item) => item.title || item.summary || item.controls.length);
  const supportingKoshaReferences = references.filter((item) =>
    item.evidence_role === "supporting"
      && Boolean(getSupportingKoshaEvidenceRef(item))
  );
  const rankedEligibleReferences = filterAndRankSafetyReferencesByQuery(
    rankQuery,
    [...eligibleReferences],
    eligibleReferences.length
  );
  const topCandidates = rankedEligibleReferences;
  const seen = new Set<string>();
  const rows: RiskAssessmentRow[] = [];

  for (const item of topCandidates) {
    const displayTitle = getSafetyReferenceDisplayTitle(item);
    const operationalView = deriveSafetyReferenceOperationalView(item);
    const control = compactRiskCell(operationalView.controls[0], 120) ||
      "해당 근거의 필수 확인 항목을 작업 전 점검합니다.";
    const additionalControl = compactRiskCell(operationalView.controls[1], 120) ||
      compactRiskCell(item.document_reflection_label, 120) ||
      control;
    const hazard = compactRiskCell(operationalView.hazard, 120);
    const dedupeKey = `${hazard}|${control}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const supportingEvidenceRefs = Array.from(new Set(filterAndRankSafetyReferencesByQuery(
      `${rankQuery} ${displayTitle} ${hazard} ${control}`,
      supportingKoshaReferences.filter((supporting) => (
        hasRelevantKoshaParent(supporting, [item])
      )),
      supportingKoshaReferences.length
    ).map(getSupportingKoshaEvidenceRef)
      .filter((ref): ref is string => Boolean(ref))))
      .slice(0, MAX_SUPPORTING_KOSHA_REFS_PER_RISK_ROW);
    const evidenceRefs = [
      item.evidence_role === "direct" ? "DB 하네스 직접근거" : "DB 하네스 보조근거",
      item.source_kind_label || item.item_type || "safety_reference_items",
      displayTitle,
      item.retrieval_source ? `검색: ${item.retrieval_source}` : "",
      item.source_url || "",
      ...supportingEvidenceRefs
    ].filter(Boolean);
    const candidateRow = buildRiskRow({
      location,
      process,
      task: scenario.workSummary || compactRiskCell(displayTitle, 48) || "현장 작업",
      equipment: compactRiskCell([item.category, item.subcategory].filter(Boolean).join(", "), 80) || "작업 장비·공구·보호구",
      hazard,
      currentControls: control,
      likelihood: item.item_type === "sif-case" ? 4 : item.evidence_role === "direct" ? 3 : 2,
      severity: item.item_type === "sif-case" ? 5 : /추락|질식|폭발|감전|화재|붕괴|끼임/.test(hazard) ? 5 : 4,
      additionalControls: additionalControl,
      owner: "작업반장",
      due: "현장 확인",
      verification: operationalView.reviewRequired
        ? "DB 하네스 근거의 위험요인·통제대책을 원문 및 현장 조건과 대조해 검토"
        : "DB 하네스 근거와 현장 사진·TBM 확인으로 조치 반영 여부를 확인",
      verificationChecker: "관리감독자",
      evidenceRefs,
      verificationStatus: operationalView.reviewRequired ? "needsReview" : "planned"
    });
    rows.push(candidateRow);

    if (rows.length >= 4) break;
  }

  if (!rows.length) return [];
  const baselineRows = buildFallbackRiskAssessmentRows(response, weatherSummary);
  const rowKeys = new Set(rows.map((row) => `${row.hazard}|${row.currentControls}`));
  for (const row of baselineRows) {
    const key = `${row.hazard}|${row.currentControls}`;
    if (!rowKeys.has(key)) {
      rows.push(row);
      rowKeys.add(key);
    }
    if (rows.length >= 5) break;
  }
  return rows;
}

function photoSeverityFromImprovement(item: HarnessImprovement): "high" | "medium" | "low" | "review" {
  const severityTag = item.detectedHazards?.find((hazard) => /^severity:/.test(hazard))?.replace("severity:", "");
  if (severityTag === "high" || severityTag === "medium" || severityTag === "low") return severityTag;
  return "review";
}

function buildPhotoHazardRiskRows(response: AskResponse, improvements: readonly HarnessImprovement[]): RiskAssessmentRow[] {
  const scenario = response.scenario;
  const location = scenario.siteName || "현장 작업구역";
  const process = response.riskSummary.title || scenario.companyType || "현장 작업";
  return improvements
    .filter((item) => item.sourceType === "photo_analysis")
    .filter((item) => item.hazardLabel || item.detectedHazards?.length || item.visionEvidence || item.sourcePhotoNames?.length)
    .slice(0, 4)
    .map((item) => {
      const severity = photoSeverityFromImprovement(item);
      const hazard = item.hazardLabel || item.detectedHazards?.find((value) => !value.startsWith("severity:")) || "사진 기반 위험요인";
      const likelihood = severity === "high" ? 4 : severity === "medium" ? 3 : 2;
      const severityValue = severity === "high" ? 5 : severity === "medium" ? 4 : 3;
      const photoNames = item.sourcePhotoNames?.length ? item.sourcePhotoNames.slice(0, 5).join(", ") : "";
      const siteSignals = item.siteSignals?.length ? item.siteSignals.slice(0, 4).join(", ") : "";
      const evidenceRefs = [
        item.visionUserLabel || "사진 위험요인 후보",
        photoNames ? `사진: ${photoNames}` : "",
        item.ocrText ? `OCR: ${item.ocrText}` : "",
        siteSignals ? `현장 신호: ${siteSignals}` : "",
        item.visionEvidence ? `사진 분석 근거: ${item.visionEvidence}` : ""
      ].filter(Boolean);
      return buildRiskRow({
        location,
        process,
        task: item.taskLabel || scenario.workSummary || "사진 첨부 작업",
        equipment: siteSignals ? `사진 첨부 작업면, ${siteSignals}` : "사진 첨부 작업면, 보호구, 작업구역",
        hazard,
        currentControls: item.improvementText || "사진 위험요인 확인 결과를 작업 전 현장 확인 항목으로 반영합니다.",
        likelihood,
        severity: severityValue,
        additionalControls: item.observedImprovement || item.visionSummary || item.improvementText || "사진에서 확인된 위험요인을 TBM에서 공유하고 조치 완료 사진을 남깁니다.",
        owner: "작업반장",
        due: "현장 확인",
        verification: "첨부 사진, OCR, 현장 재확인을 통해 위험요인과 조치 반영 여부를 확인",
        verificationChecker: "관리감독자",
        evidenceRefs
      });
    });
}

function appendPhotoSeedRiskRows(rows: RiskAssessmentRow[], photoRows: RiskAssessmentRow[]) {
  if (!photoRows.length) return rows;
  const existingHazards = new Set(rows.map((row) => row.hazard.trim()));
  const uniquePhotoRows = photoRows.filter((row) => !existingHazards.has(row.hazard.trim()));
  return uniquePhotoRows.length ? [...rows, ...uniquePhotoRows] : rows;
}

function buildTbmQuestionHazardLabel(hazard: string): string {
  const label = compactRiskCell(hazard, 140);
  if (!label) return "해당 위험";
  return /위험/.test(label) ? label : `${label} 위험`;
}

export function buildTbmRiskLinks(rows: RiskAssessmentRow[], weatherSummary: string): TbmRiskLink[] {
  return rows.slice(0, 6).map((row, index) => {
    const owner = row.owner || "작업반장";
    const checker = row.verificationChecker || "관리감독자";
    const verificationStatus = row.verificationStatus || "planned";
    const verificationDate = row.verificationDate || "작업 전";
    const control = row.additionalControls || row.currentControls || "작업 전 안전조치를 확인합니다.";
    const hazardLabel = buildTbmQuestionHazardLabel(row.hazard);
    return {
      riskRowIndex: index,
      hazard: row.hazard,
      control,
      weatherSignal: weatherSummary || "기상청 현재·예보 신호 확인",
      confirmQuestion: `${hazardLabel}에 대해 ${control} 조치를 이해하고 작업 전 확인했습니까?`,
      owner,
      verification: `${checker}가 ${verificationDate} 기준 ${verificationStatus} 상태로 확인하고 TBM 기록에 남깁니다.`,
      evidenceRefs: row.evidenceRefs || []
    };
  });
}

type TbmHazardCategory = TbmBriefingStructured["hazards"][number]["category"];

function compactTbmText(value: string | undefined, fallback: string, maxLength: number): string {
  const text = (value || fallback).replace(/\s+/g, " ").trim() || fallback;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function tbmCategory(row: RiskAssessmentRow): TbmHazardCategory {
  return row.fourM;
}

function equipmentFromScenarioRows(scenario: AskResponse["scenario"], rows: RiskAssessmentRow[]): string[] {
  const fromRows = rows.flatMap((row) => row.equipment.split(/[,/·]/).map((part) => part.trim()));
  const values = uniqueNonEmpty(fromRows);
  if (values.length) return values.slice(0, 5);
  return uniqueNonEmpty([scenario.workSummary, "보호구", "작업구역 표지"]).slice(0, 5);
}

function tbmRows(rows: RiskAssessmentRow[]): RiskAssessmentRow[] {
  return rows.length ? rows.slice(0, 5) : [];
}

function fillTbmList(values: string[], fallbacks: string[], count: number): string[] {
  const filled = uniqueNonEmpty([...values, ...fallbacks]).slice(0, count);
  return filled.length >= count ? filled : [...filled, ...fallbacks].slice(0, count);
}

export function buildTbmBriefingStructuredFromRiskRows(
  scenario: AskResponse["scenario"],
  rows: RiskAssessmentRow[],
  weatherSummary: string
): TbmBriefingStructured {
  const selectedRows = tbmRows(rows);
  const hazards = selectedRows.map((row) => ({
    category: tbmCategory(row),
    description: compactTbmText(row.hazard, "작업 전 위험요인 확인", 60)
  }));
  const safeHazards = hazards.length ? hazards : [
    { category: "Management" as const, description: "작업 전 위험요인 확인" }
  ];
  const measures = selectedRows.map((row, index) => ({
    hazardRef: Math.min(index + 1, safeHazards.length),
    action: compactTbmText(row.additionalControls || row.currentControls, "작업 전 안전조치 확인", 80),
    owner: compactTbmText(row.owner, "작업반장", 30),
    evidenceRefs: [...row.evidenceRefs]
  }));
  const stopCriteria = fillTbmList(
    [
      weatherSummary ? `기상 신호 이상 시 작업중지: ${compactTbmText(weatherSummary, "", 46)}` : "",
      ...selectedRows
        .filter((row) => row.riskLevel === "high")
        .map((row) => `${compactTbmText(row.hazard, "고위험", 32)} 조치 전 작업 금지`)
    ],
    ["보호구 미착용 시 작업 금지", "통제구역 이탈 시 작업 중지", "관리감독자 확인 전 작업 재개 금지"],
    5
  );
  const confirmTopics = fillTbmList(
    selectedRows.map((row) => `${compactTbmText(row.hazard, "위험요인", 34)} 조치를 확인했습니까?`),
    ["작업중지 기준을 이해했습니까?", "비상연락과 대피경로를 확인했습니까?", "사진 증빙 위치를 확인했습니까?", "작업자 동선을 확인했습니까?", "보호구 착용을 확인했습니까?"],
    5
  );

  return {
    meta: {
      dateTime: "작업 전 TBM",
      location: scenario.siteName,
      target: `전 작업자 ${scenario.workerCount}명`,
      attendees: "현장 서명 또는 열람 확인 버튼"
    },
    todayWork: {
      name: scenario.workSummary,
      location: scenario.siteName,
      time: "작업 전",
      equipment: equipmentFromScenarioRows(scenario, selectedRows)
    },
    hazards: safeHazards,
    measures: measures.length ? measures : [{
      hazardRef: 1,
      action: "작업 전 안전조치 확인",
      owner: "작업반장",
      evidenceRefs: []
    }],
    stopCriteria,
    confirmTopics,
    photoEvidenceLocation: "작업 전·중·후 사진을 문서팩 사진 증빙에 첨부"
  };
}

export function buildTbmLogStructuredFromRiskRows(
  scenario: AskResponse["scenario"],
  rows: RiskAssessmentRow[],
  weatherSummary: string
): TbmLogStructured {
  const selectedRows = tbmRows(rows);
  const workerCount = Math.max(1, scenario.workerCount || 1);
  const confirmations = fillTbmList(
    selectedRows.map((row) => `${compactTbmText(row.hazard, "위험요인", 34)} 조치 확인`),
    ["작업중지 기준 공유", "보호구 착용 확인", "비상연락망 확인", "사진 증빙 위치 공유", "작업자 동선 확인"],
    5
  );
  const keyPoints = fillTbmList(
    [
      ...selectedRows.map((row) => compactTbmText(row.additionalControls || row.currentControls, "작업 전 안전조치 확인", 70)),
      weatherSummary ? `기상 신호 확인: ${compactTbmText(weatherSummary, "기상 확인", 46)}` : ""
    ],
    ["위험성평가 결과를 TBM에서 재확인", "현장 변경사항은 즉시 작업반장에게 보고", "작업중지 기준 발생 시 즉시 대피"],
    5
  );
  const unaddressedItems = selectedRows
    .filter((row) => row.verificationStatus === "needsReview")
    .slice(0, 3)
    .map((row) => ({
      item: compactTbmText(row.hazard, "보완 필요 위험요인", 50),
      plannedAction: compactTbmText(row.additionalControls || row.verification, "관리감독자 확인 후 작업 재개", 70),
      owner: compactTbmText(row.owner, "작업반장", 30),
      dueDate: row.due || "현장 확인",
      evidenceRefs: [...row.evidenceRefs]
    }));

  return {
    meta: {
      dateTime: "작업 당일 TBM 기록",
      location: scenario.siteName,
      workType: scenario.workSummary,
      instructor: "작업반장"
    },
    attendance: {
      expected: workerCount,
      actual: workerCount,
      attendees: Array.from({ length: Math.min(workerCount, 12) }, (_, index) => `작업자 ${index + 1}`),
      absenceReason: "없음",
      confirmationMethod: "현장 서명 또는 열람 확인 버튼"
    },
    todayWork: {
      name: scenario.workSummary,
      location: scenario.siteName,
      time: "작업 전·중",
      equipment: equipmentFromScenarioRows(scenario, selectedRows)
    },
    workerConfirmations: confirmations,
    hazardsDiscussed: (selectedRows.length ? selectedRows : []).slice(0, 5).map((row, index) => ({
      category: tbmCategory(row),
      description: compactTbmText(row.hazard, "작업 전 위험요인 확인", 60),
      relatedRiskRowIndex: index
    })),
    safetyEducation: {
      topic: `${scenario.workSummary} 작업 전 위험성평가 공유`,
      keyPoints,
      materials: uniqueNonEmpty(selectedRows.flatMap((row) => row.evidenceRefs)).slice(0, 4).join(" / ") || "위험성평가표, KOSHA 자료, 현장 사진"
    },
    unaddressedItems,
    photoEvidence: {
      captureLocations: uniqueNonEmpty([scenario.siteName, scenario.workSummary]).slice(0, 3),
      storagePath: "SafeClaw 문서팩 사진 증빙"
    },
    signatures: {
      author: "작성자",
      reviewer: "검토자",
      approver: "승인자"
    }
  };
}

function tokenizeForRiskLink(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  )];
}

function riskRowLinkText(row: RiskAssessmentRow): string {
  return [
    row.location,
    row.process,
    row.task,
    row.equipment,
    row.hazard,
    row.fourM,
    row.accidentType,
    row.currentControls,
    row.additionalControls,
    row.verification,
    ...row.evidenceRefs
  ].join(" ");
}

function scoreRiskRowLink(targetText: string, row: RiskAssessmentRow): number {
  const targetTokens = tokenizeForRiskLink(targetText);
  const rowTokens = new Set(tokenizeForRiskLink(riskRowLinkText(row)));
  const overlap = targetTokens.filter((token) => rowTokens.has(token)).length;
  const hazardBonus = tokenizeForRiskLink(row.hazard).some((token) => targetText.toLowerCase().includes(token)) ? 4 : 0;
  const controlBonus = tokenizeForRiskLink(row.additionalControls).some((token) => targetText.toLowerCase().includes(token)) ? 2 : 0;
  const fourMBonus = row.fourM && targetText.includes(row.fourM) ? 1 : 0;
  const accidentBonus = row.accidentType && targetText.includes(row.accidentType) ? 1 : 0;
  return overlap + hazardBonus + controlBonus + fourMBonus + accidentBonus;
}

function fallbackRiskRowIndex(rows: RiskAssessmentRow[]): number {
  const highIndex = rows.findIndex((row) => row.riskLevel === "high");
  return highIndex >= 0 ? highIndex : 0;
}

function pickRiskRowIndexes(targetText: string, rows: RiskAssessmentRow[], limit: number): number[] {
  if (!rows.length) return [];
  const fallbackIndex = fallbackRiskRowIndex(rows);
  const ranked = rows
    .map((row, index) => ({ index, score: scoreRiskRowLink(targetText, row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.index);
  return ranked.length ? ranked : [fallbackIndex];
}

function buildRiskRowVerification(row: RiskAssessmentRow): string {
  const checker = row.verificationChecker || "관리감독자";
  const date = row.verificationDate || row.due || "작업 전";
  return row.verification || `${checker}가 ${date} 기준 위험성평가 조치 이행을 확인`;
}

function linkWorkPlanToRiskRows(
  workPlan: WorkPlanStructured | undefined,
  rows: RiskAssessmentRow[]
): WorkPlanStructured | undefined {
  if (!workPlan || !rows.length) return workPlan;

  return {
    ...workPlan,
    workSteps: workPlan.workSteps.map((step, index) => {
      const existingIndexes = Array.isArray(step.relatedRiskRowIndex)
        ? step.relatedRiskRowIndex.filter((value) => Number.isInteger(value) && value >= 0 && value < rows.length)
        : [];
      const relatedRiskRowIndex = existingIndexes.length
        ? existingIndexes
        : pickRiskRowIndexes(`${step.action} ${step.equipment} ${step.safetyMeasure} ${step.owner}`, rows, 2);
      const primaryRow = rows[relatedRiskRowIndex[0] ?? fallbackRiskRowIndex(rows)];
      return {
        ...step,
        stepNo: step.stepNo || index + 1,
        relatedRiskRowIndex,
        evidenceRefs: step.evidenceRefs?.length ? step.evidenceRefs : primaryRow.evidenceRefs,
        verification: step.verification || buildRiskRowVerification(primaryRow)
      };
    })
  };
}

function linkPermitToRiskRows(
  permit: PermitInspectionStructured | undefined,
  rows: RiskAssessmentRow[]
): PermitInspectionStructured | undefined {
  if (!permit || !rows.length) return permit;

  return {
    ...permit,
    conditions: permit.conditions.map((condition) => {
      const candidateIndex = condition.relatedRiskRowIndex;
      const existingIndex = typeof candidateIndex === "number" && Number.isInteger(candidateIndex) && candidateIndex >= 0 && candidateIndex < rows.length
        ? candidateIndex
        : undefined;
      const relatedRiskRowIndex = existingIndex ?? pickRiskRowIndexes(`${condition.category} ${condition.requirement} ${condition.action} ${condition.owner}`, rows, 1)[0] ?? fallbackRiskRowIndex(rows);
      const linkedRow = rows[relatedRiskRowIndex];
      return {
        ...condition,
        relatedRiskRowIndex,
        evidenceRefs: condition.evidenceRefs?.length ? condition.evidenceRefs : linkedRow.evidenceRefs,
        verification: condition.verification || buildRiskRowVerification(linkedRow)
      };
    })
  };
}

type DocumentEvidenceTarget = "risk" | "workPlan" | "tbm" | "education" | "emergency";

function getTargetLabel(target: DocumentEvidenceTarget) {
  if (target === "risk") return "위험성평가표";
  if (target === "workPlan") return "작업계획서";
  if (target === "tbm") return "TBM 기록";
  if (target === "education") return "안전교육 기록";
  return "비상대응 절차";
}

function getTargetAction(target: DocumentEvidenceTarget) {
  if (target === "risk") return "위험요인, 감소대책, 조치 확인란에 반영합니다.";
  if (target === "workPlan") return "작업순서, 통제구역, 작업중지 기준에 반영합니다.";
  if (target === "tbm") return "작업 전 공유 질문과 현장 확인 멘트에 반영합니다.";
  if (target === "education") return "교육내용, 이해도 확인, 서명·사진 증빙 항목에 반영합니다.";
  return "초기조치, 보고, 현장보존, 재발방지 확인 항목에 반영합니다.";
}

function compactTitleList(titles: string[]) {
  return titles.filter(Boolean).slice(0, 2).join(" / ");
}

function formatOfficialTemplateAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  if (!references.length) return "";

  return [
    "",
    "[반영 근거: 공식자료]",
    ...references.slice(0, 3).map((item) => (
      `- ${item.agency || "KOSHA"} ${item.title}: ${(item.templateHints || []).slice(0, 2).join(", ") || item.category} 항목을 확인란으로 옮깁니다.`
    ))
  ].join("\n");
}

function formatRiskAssessmentOfficialAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  const riskReferences = references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("위험성평가표"));
  if (!riskReferences.length) return "";

  return [
    "",
    "[공식 서식 기준 보강]",
    "- KOSHA 위험성평가 흐름에 맞춰 사전준비, 유해·위험요인 파악, 위험성 결정, 감소대책, 공유·교육, 조치 확인 순서로 기록합니다.",
    "- 4M 관점(작업자, 장비·도구, 작업환경, 관리체계)을 누락 점검 기준으로 사용합니다.",
    `- 반영 근거: ${riskReferences.slice(0, 3).map((item) => item.title).join(" / ")}`
  ].join("\n");
}

function formatSafetyEducationOfficialAppendix(references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]) {
  const educationReferences = references.filter((item) => (item.appliesTo || item.appliedTo || []).includes("안전교육일지"));
  if (!educationReferences.length) return "";

  return [
    "",
    "[공식 교육기록 기준 보강]",
    "- 교육대상, 교육내용, 확인방법, 후속 교육 추천을 분리해 기록합니다.",
    "- TBM 기록은 위험성평가 결과를 반영한 경우 정기교육 증빙 활용 가능 여부를 검토할 수 있습니다.",
    "- 본 문서는 법정 제출서식 대체가 아니라 현장 기록 보조용 초안입니다.",
    `- 반영 근거: ${educationReferences.slice(0, 3).map((item) => item.title).join(" / ")}`
  ].join("\n");
}

function formatAccidentCaseAppendix(accidentCases: Awaited<ReturnType<typeof fetchAccidentCases>>["cases"]) {
  if (!accidentCases.length) return "";

  return [
    "",
    "[근거 요약: 유사 재해사례]",
    ...accidentCases.slice(0, 2).map((item) => (
      `- ${item.title}: ${item.preventionPoint} 항목을 작업 전 확인과 재발방지 조치에 반영합니다.`
    ))
  ].join("\n");
}

function buildPhotoEvidenceAppendix(
  citations: AskResponse["citations"],
  koshaReferences: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"],
  accidentCases: Awaited<ReturnType<typeof fetchAccidentCases>>["cases"]
) {
  return [
    "",
    "[사진/증빙 체계 보강]",
    "- 작업 전 사진: 작업구역, 장비, 작업환경, 출입통제 상태를 작업 시작 전 촬영합니다.",
    "- 조치 전 사진: 위험구역, 장비, 작업환경, 출입통제의 미조치 상태를 촬영합니다.",
    "- 조치 후 사진: 감소대책 실행 후 방호조치, 표지, 차단, 보호구 착용 상태를 같은 각도에서 촬영합니다.",
    "- 전후 비교: 조치 전 사진과 조치 후 사진을 같은 위험요인 번호로 묶고 촬영자, 확인자, 보관 위치를 남깁니다.",
    "",
    "[확인 근거 첨부]",
    `- 법령·해석례·판례: ${citations.slice(0, 3).map((item) => item.title).join(" / ") || "현장 문서 확인 후 첨부"}`,
    `- KOSHA 자료: ${koshaReferences.slice(0, 2).map((item) => item.title).join(" / ") || "현장 작업유형 확인 후 첨부"}`,
    `- 유사 재해사례: ${accidentCases.slice(0, 2).map((item) => item.title).join(" / ") || "사례 확인 후 첨부"}`
  ].join("\n");
}

function ensurePhotoEvidenceDraft(baseDraft: string, appendix: string) {
  const requiredTerms = ["작업 전 사진", "조치 전 사진", "조치 후 사진", "보관 위치"];
  const missingTerms = requiredTerms.filter((term) => !baseDraft.includes(term));
  if (!missingTerms.length && baseDraft.includes("[사진/증빙 체계 보강]")) {
    return baseDraft;
  }
  return `${baseDraft.trim()}${appendix}`.trim();
}

function formatKoshaOpenApiAppendix(
  references: Awaited<ReturnType<typeof fetchKoshaOpenApiEvidence>>["references"],
  target: DocumentEvidenceTarget
) {
  const targetLabel = getTargetLabel(target);
  const matched = references.filter((item) => (
    item.reflectedIn.includes(targetLabel)
      || (target === "tbm" && item.reflectedIn.includes("TBM"))
      || item.reflectedIn.includes("문서 반영 근거")
  ));
  if (!matched.length) return "";

  return [
    "",
    `[근거 요약: ${targetLabel}]`,
    ...matched.slice(0, 2).map((item) => (
      `- ${item.service}: ${item.title} 자료를 확인해 ${getTargetAction(target)}`
    ))
  ].join("\n");
}

type CompressedSafetyReference = {
  id: string;
  title: string;
  reflectsDocuments: string[];
  evidenceShort: string;
  documentSentence: string;
  kind: "kosha-support-regulation" | "kosha-guideline" | "construction-process" | "machinery" | "sif-case" | "other";
  /** Short label for the source kind, e.g., "KOSHA 기술지침" / "KOSHA 기술지원규정" / "KOSHA 사고사례" */
  kindLabel: string;
  quality?: "accepted" | "review_required";
  lifecycle?: "current" | "stale" | "retired";
  directEligible?: boolean;
  groundingReason?: KoshaGroundingReason;
};

function classifySafetyReferenceKind(itemType: string | undefined): { kind: CompressedSafetyReference["kind"]; kindLabel: string } {
  switch (itemType) {
    case "technical-support-regulation":
      return { kind: "kosha-support-regulation", kindLabel: "KOSHA 기술지원규정" };
    case "technical-guideline":
      return { kind: "kosha-guideline", kindLabel: "KOSHA 기술지침" };
    case "construction-process":
      return { kind: "construction-process", kindLabel: "KOSHA 작업공정" };
    case "machinery":
      return { kind: "machinery", kindLabel: "KOSHA 기계류" };
    case "sif-case":
      return { kind: "sif-case", kindLabel: "KOSHA 사고사례" };
    default:
      return { kind: "other", kindLabel: itemType || "내부지식DB" };
  }
}

/**
 * Compress raw Supabase safety_reference_items into a "문서 반영 문장" form.
 * Per Hermes review: never inject the raw catalog into the AI prompt or document body —
 * keep it short, name the reflection target, and write a sentence that the document
 * can directly use as a control statement. Also dedupe near-identical entries.
 */
function compressSafetyReferenceMatches(items: SafetyReferenceItem[], limit = 5): CompressedSafetyReference[] {
  const seen = new Set<string>();
  const out: CompressedSafetyReference[] = [];
  for (const item of items) {
    const displayTitle = getSafetyReferenceDisplayTitle(item);
    const operationalView = deriveSafetyReferenceOperationalView(item);
    const grounding = getKoshaGroundingDecision(item);
    const isTechnicalKosha = isKoshaTechnicalReference(item);
    const groundingLifecycle = grounding?.metadata?.lifecycle;
    const operationalControls = operationalView.controls.slice(0, 2);
    const evidenceCore = operationalControls.slice(0, 1).join(", ");
    const dedupeKey = `${operationalView.hazard}|${operationalControls.join("|")}|${(item.primary_documents || []).join("|")}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const documents = (item.primary_documents || []).filter(Boolean).slice(0, 3);
    const evidenceShort = evidenceCore.replace(/\s+/g, " ").trim().slice(0, 80);
    const sentenceBase = isTechnicalKosha
      ? grounding?.status === "verified_current"
        ? "검증된 현행 KOSHA 본문 발췌를 기술적 보조지침으로 대조"
        : "검증 전 KOSHA 본문과 통제문구를 사용하지 않음"
      : `${operationalView.hazard}: ${operationalControls.join(" / ")}`.replace(/\s+/g, " ").trim();
    const documentSentence = `${sentenceBase}.`;
    const { kind, kindLabel } = classifySafetyReferenceKind(item.item_type);
    out.push({
      id: item.id,
      title: displayTitle,
      reflectsDocuments: documents,
      evidenceShort,
      documentSentence: documentSentence.slice(0, 200),
      kind,
      kindLabel,
      quality: item.kosha_guide?.quality ?? (isTechnicalKosha
        ? grounding?.status === "verified_current" ? "accepted" : "review_required"
        : undefined),
      lifecycle: item.kosha_guide?.lifecycle ?? (groundingLifecycle === "unresolved" ? undefined : groundingLifecycle),
      directEligible: isTechnicalKosha
        ? grounding?.mandatoryCitationEligible === true
        : item.kosha_guide?.directEligible,
      groundingReason: grounding?.reason
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function buildSafetyReferenceSurfaceItem(
  item: SafetyReferenceItem,
  retrievalMode?: SafetyReferenceRetrievalMode,
  options: { parentEvidenceReady?: boolean } = {}
) {
  const operationalView = deriveSafetyReferenceOperationalView(item);
  const grounding = getKoshaGroundingDecision(item);
  const groundingLifecycle = grounding?.metadata?.lifecycle;
  const technicalKosha = isKoshaTechnicalReference(item);
  const parentEvidenceReady = options.parentEvidenceReady ?? true;
  const unverifiedTechnicalKosha = technicalKosha && !grounding?.supportingCitationEligible;
  const parentlessTechnicalKosha = technicalKosha && !parentEvidenceReady;
  const blockedTechnicalKosha = unverifiedTechnicalKosha || parentlessTechnicalKosha;
  const controls = parentlessTechnicalKosha
    ? []
    : unverifiedTechnicalKosha
      ? ["검증된 현행 원문과 provenance 확인 전 본문·통제문구 미사용"]
      : operationalView.controls.slice(0, 2);
  const displayTitle = getSafetyReferenceDisplayTitle(item);
  return {
    rawTitle: item.title,
    id: item.id,
    itemType: item.item_type,
    title: displayTitle,
    displayTitle,
    displaySummary: blockedTechnicalKosha ? undefined : item.display_summary,
    shortSummary: blockedTechnicalKosha
      ? parentlessTechnicalKosha
        ? "검토 필요 · SIF 사례 또는 직접 근거 확인 전 KOSHA 통제문구 미사용"
        : `검토 필요 · ${controls[0]}`
      : item.display_summary || `${operationalView.hazard} · ${controls.join(" · ")}`,
    primaryDocuments: item.primary_documents || [],
    controls,
    evidenceRoleLabel: item.evidence_role_label,
    evidenceRole: item.evidence_role,
    sourceKindLabel: item.source_kind_label,
    operationSignalLabel: parentlessTechnicalKosha
      ? "SIF 사례 또는 직접 근거 확인 후 기술 보조지침 검토"
      : controls[0]
        ? `문서와 TBM에 ${controls[0]} 반영`
        : item.operation_signal_label,
    stableDocumentKey: item.kosha_guide?.stableDocumentKey ?? grounding?.metadata?.stableDocumentKey,
    anchor: blockedTechnicalKosha ? undefined : item.kosha_guide?.anchors[0],
    retrievalSource: item.retrieval_source,
    retrievalMode,
    quality: item.kosha_guide?.quality ?? (grounding
      ? grounding.status === "verified_current" ? "accepted" : "review_required"
      : undefined),
    lifecycle: item.kosha_guide?.lifecycle ?? (groundingLifecycle === "unresolved" ? undefined : groundingLifecycle),
    directEligible: technicalKosha ? false : item.kosha_guide?.directEligible,
    supportingCitationEligible: grounding?.supportingCitationEligible === true && parentEvidenceReady,
    groundingReason: grounding?.reason,
    reviewRequired: blockedTechnicalKosha || (grounding?.reviewRequired ?? operationalView.reviewRequired)
  };
}

function isTechnicalKoshaCompressed(item: CompressedSafetyReference): boolean {
  return item.kind === "kosha-support-regulation" || item.kind === "kosha-guideline";
}

function isAcceptedCurrentKoshaCompressed(item: CompressedSafetyReference): boolean {
  return isTechnicalKoshaCompressed(item)
    && item.quality === "accepted"
    && item.lifecycle === "current";
}

function isVerifiedCurrentKoshaCompressed(item: CompressedSafetyReference): boolean {
  return isAcceptedCurrentKoshaCompressed(item)
    && item.directEligible === true
    && item.groundingReason === "verified-current";
}

function buildRequiredKoshaCitations(
  items: readonly SafetyReferenceItem[],
  options: { parentEvidenceReadyIds: ReadonlySet<string> }
) {
  const uniqueVerified = new Map<string, SafetyReferenceItem>();
  for (const item of items) {
    const decision = getKoshaGroundingDecision(item);
    const metadata = decision?.metadata;
    if (
      !isKoshaTechnicalReference(item)
      || !options.parentEvidenceReadyIds.has(item.id)
      || decision?.status !== "verified_current"
      || decision.mandatoryCitationEligible !== true
      || !metadata
    ) {
      continue;
    }
    const key = `${metadata.stableDocumentKey}|${metadata.currentVersion}`;
    if (!uniqueVerified.has(key)) uniqueVerified.set(key, item);
  }

  return [...uniqueVerified.values()].slice(0, 4).map((item) => ({
    kindLabel: classifySafetyReferenceKind(item.item_type).kindLabel,
    title: getSafetyReferenceDisplayTitle(item),
    sentence: "검증된 현행 KOSHA 본문 발췌를 기술적 보조지침으로 대조."
  }));
}

function formatSafetyReferencePromptLine(
  item: CompressedSafetyReference,
  index: number,
  options: { parentEvidenceReady: boolean }
): string {
  const parentMissing = isTechnicalKoshaCompressed(item)
    && isAcceptedCurrentKoshaCompressed(item)
    && !options.parentEvidenceReady;
  if (isTechnicalKoshaCompressed(item) && (!isVerifiedCurrentKoshaCompressed(item) || parentMissing)) {
    const reason = parentMissing ? "parent-evidence-missing" : item.groundingReason || "metadata-absent";
    return `${index}. [${item.kindLabel}] ${item.title} | 검토필요 reason=${reason} | SIF/직접 근거 확인 전 본문·통제문구·필수 인용 미사용`;
  }
  const status = isTechnicalKoshaCompressed(item) ? "검증된 현행 기술 보조지침" : "확정근거";
  return `${index}. [${item.kindLabel}] ${item.title} | ${status} | 반영: ${item.reflectsDocuments.join("·") || "-"} | ${item.documentSentence}`;
}

function formatSafetyReferenceAppendix(
  items: CompressedSafetyReference[],
  options: { parentEvidenceReadyIds: ReadonlySet<string> }
): string {
  if (!items.length) return "";
  const koshaItems = items.filter(isTechnicalKoshaCompressed);
  const koshaPrimary = koshaItems.filter((item) => (
    isVerifiedCurrentKoshaCompressed(item)
    && options.parentEvidenceReadyIds.has(item.id)
  ));
  const koshaReviewRequired = koshaItems.filter((item) => (
    !isVerifiedCurrentKoshaCompressed(item)
    || !options.parentEvidenceReadyIds.has(item.id)
  ));
  const others = items.filter((item) => !isTechnicalKoshaCompressed(item));
  const blocks: string[] = [];
  if (koshaPrimary.length) {
    blocks.push("");
    blocks.push("[KOSHA 기술지침/기술지원규정 검증된 보조 인용]");
    for (const item of koshaPrimary) {
      blocks.push(
        `- ${item.kindLabel}: ${item.title} / 반영 위치: ${item.reflectsDocuments.join(" / ") || "현장 확인 필요"} / 문서 문장: ${item.documentSentence}`
      );
    }
  }
  if (koshaReviewRequired.length) {
    blocks.push("");
    blocks.push("[KOSHA 기술지침/기술지원규정 검토 필요]");
    for (const item of koshaReviewRequired) {
      const parentMissing = isAcceptedCurrentKoshaCompressed(item)
        && !options.parentEvidenceReadyIds.has(item.id);
      blocks.push(
        `- ${item.kindLabel}: ${item.title} / reason=${parentMissing ? "parent-evidence-missing" : item.groundingReason || "metadata-absent"} / quality=${item.quality || "review_required"} / lifecycle=${item.lifecycle || "unknown"} / SIF·직접 근거 확인 전 본문·통제문구·필수 인용에 사용하지 않음`
      );
    }
  }
  if (others.length) {
    blocks.push("");
    blocks.push("[내부 안전지식 DB 반영]");
    for (const item of others) {
      blocks.push(
        `- ${item.kindLabel} / 반영 위치: ${item.reflectsDocuments.join(" / ") || "현장 확인 필요"} / 근거: ${item.evidenceShort || item.title} / 문서 문장: ${item.documentSentence}`
      );
    }
  }
  return blocks.join("\n");
}

function formatSafetyKnowledgeAppendix(matches: ReturnType<typeof matchSafetyKnowledge>, target: "risk" | "tbm" | "education") {
  if (!matches.length) return "";

  const targetLabel = target === "risk" ? "위험성평가표" : target === "tbm" ? "TBM 기록" : "안전보건교육";
  const action = target === "risk"
    ? "감소대책과 잔여위험 확인란에 넣습니다."
    : target === "tbm"
      ? "작업 전 질문과 확인 멘트로 바꿉니다."
      : "교육내용과 이해도 확인 질문으로 바꿉니다.";
  return [
    "",
    `[문서 반영: ${targetLabel}]`,
    ...matches.slice(0, 2).map((item) => (
      `- ${item.title}: ${item.shortSummary} / ${item.documentReflectionLabel}. ${action}`
    ))
  ].join("\n");
}

function hasOutdoorHeatSignal(weather: Awaited<ReturnType<typeof fetchWeatherSignal>>, question: string) {
  // 명시적 실내 마커가 있으면 옥외 폭염 부록을 붙이지 않는다.
  // 한빛로지스 검수에서 "인천 남동공단 물류센터 ... 실내 작업"인데 '하역' 키워드 때문에
  // 옥외 폭염 섹션이 부록으로 들어가던 버그 차단. 'indoor' fast-path가 outdoor 휴리스틱을 누른다.
  const indoorByInput = /실내|옥내|물류센터|창고\s|클린룸|반도체|데이터센터|기계실|지하실|밀폐공간|반응기 내부/.test(question);
  if (indoorByInput) {
    // 기상 신호가 폭염 경보 수준이어도 실내라면 옥외 폭염 섹션은 부적합.
    // 단, 31°C 이상 + 실내 + 환기 부재 같은 조합은 별도(열중증)이지만 그건 outdoor 부록 아님.
    return false;
  }
  // '하역'은 항만 하역(옥외) ↔ 물류센터 하역(실내) 양쪽이라 모호. 위에서 indoor 마커 없음을
  // 확인했으니 여기 도달했다면 outdoor 가능성이 더 큼. 다만 키워드만으로 단정하지 않고
  // 명시적 옥외 마커(외벽/지붕/조경/도장/건설/비계/고소/도로 등)만 신뢰.
  const outdoorByInput = /옥외|실외|야외|외벽|지붕|도로|조경|도장|건설|비계|고소|폭염|자외선|여름|한여름|온열|열사병|열탈진|열경련/.test(question);
  const outdoorBySignal = (weather.signals || []).some((signal) => {
    if (signal.endpoint === "생활기상 자외선" || signal.endpoint === "실시간 홍반자외선") return true;
    if (signal.endpoint === "영향예보" && /폭염|온열|더위|고온|주의|경고|위험/.test(signal.summary)) return true;
    const temp = Number(signal.temperatureC || "");
    return Number.isFinite(temp) && temp >= 31;
  });
  return outdoorByInput || outdoorBySignal;
}

function formatOutdoorHeatAppendix(weather: Awaited<ReturnType<typeof fetchWeatherSignal>>, target: "risk" | "tbm" | "education" | "message") {
  const signals = weather.signals || [];
  const uvSignals = signals.filter((signal) => signal.endpoint === "생활기상 자외선" || signal.endpoint === "실시간 홍반자외선");
  const heatSignal = signals.find((signal) => signal.endpoint === "영향예보" && /폭염|온열|더위|고온|주의|경고|위험/.test(signal.summary))
    || signals.find((signal) => signal.endpoint === "생활기상 체감온도")
    || signals.find((signal) => {
      const temp = Number(signal.apparentTemperature || signal.temperatureC || "");
      return Number.isFinite(temp) && temp >= 31;
    });
  const uvLine = uvSignals.length
    ? `- 자외선 신호: ${uvSignals.map((signal) => signal.summary).join(" / ")}`
    : "- 자외선 신호: 옥외작업 시 차광 보호구와 그늘 휴식을 보수적으로 적용";
  const heatLine = heatSignal
    ? `- 폭염·고온 신호: ${heatSignal.summary}`
    : "- 폭염·고온 신호: 한여름 옥외작업 기준으로 물·그늘·휴식 계획을 선반영";

  if (target === "message") {
    return [
      "",
      "[한여름 옥외작업 추가공지]",
      "- 물을 자주 마시고, 그늘에서 쉬며, 어지러움·구토·두통이 있으면 즉시 작업을 멈추고 보고하세요.",
      "- 오후 가장 더운 시간대에는 작업반장 지시에 따라 작업 조절 또는 대기합니다."
    ].join("\n");
  }

  if (target === "risk") {
    return [
      "",
      "[옥외작업 폭염·자외선 위험 반영]",
      heatLine,
      uvLine,
      "- 유해·위험요인: 고온 노출, 직사광선, 탈수, 열탈진·열사병, 자외선 노출, 신규·고령·민감군 작업자 상태 악화",
      "- 감소대책: 작업 전 기상청 현재/예보/생활기상 신호 확인, 가까운 그늘 휴게공간 확보, 시원한 물 비치, 14~17시 작업 조절, 동료 작업자 상호관찰",
      "- 확인기준: 어지러움·두통·구토·근육경련 등 이상 징후자는 정해진 휴식시간과 무관하게 작업중단 및 보고",
      "- 관련 법령 확인 대상: 산업안전보건법상 안전보건조치, 근로자 안전보건교육, 산업안전보건기준에 관한 규칙의 휴식·건강장해 예방 관련 기준"
    ].join("\n");
  }

  if (target === "tbm") {
    return [
      "",
      "[한여름 옥외작업 TBM 추가질문]",
      heatLine,
      uvLine,
      "- 오늘 그늘 휴게공간, 시원한 물, 휴식 주기, 가장 더운 시간대 작업 조절 기준을 누가 확인했는가?",
      "- 신규 투입자, 고령자, 민감군, 중작업 수행자는 동료 작업자와 짝을 지어 이상 징후를 확인하는가?",
      "- 어지러움·두통·구토·경련이 있으면 불이익 없이 즉시 작업을 멈추고 보고한다는 내용을 전원이 이해했는가?"
    ].join("\n");
  }

  return [
    "",
    "[폭염·자외선 안전교육 추가]",
    heatLine,
    uvLine,
    "- 교육내용: 열사병·열탈진·열경련 증상, 물·그늘·휴식 3대 수칙, 자외선 차단 보호구, 동료 작업자 상호관찰, 응급조치와 119 신고 기준",
    "- 확인방법: 작업자가 물 마시는 위치, 그늘 휴게공간, 작업중지 보고 절차를 직접 말하게 하고 교육기록에 확인자와 시간을 남김",
    "- 현장 문구: 이해하지 못했거나 몸이 이상하면 작업을 시작하지 말고 관리자에게 다시 설명을 요청"
  ].join("\n");
}

function formatLegalEvidenceAppendix(citations: AskResponse["citations"], target: "risk" | "workPlan" | "tbm" | "education") {
  const targetLabel = getTargetLabel(target);
  const legalItems = citations
    .filter((item) => item.type === "law" || item.type === "interpretation")
    .slice(0, 2);
  const precedentItems = citations
    .filter((item) => item.type === "precedent")
    .slice(0, 1);

  if (!legalItems.length && !precedentItems.length) return "";

  const targetPurpose = {
    risk: "위험요인, 감소대책, 조치 확인란에 연결합니다.",
    workPlan: "작업순서, 작업허가, 통제구역, 작업중지 기준에 연결합니다.",
    tbm: "작업중지 기준, 보호구, 접근통제 공유 문구에 연결합니다.",
    education: "교육내용, 이해도 확인, 반복 교육 문구에 연결합니다."
  }[target];

  return [
    "",
    `[반영 근거: ${targetLabel}]`,
    `- 법령·해석례: ${compactTitleList(legalItems.map((item) => item.title)) || "공식 법령정보"} 기준을 ${targetPurpose}`,
    ...(
      precedentItems.length
        ? [
            `- 판례 보조: ${precedentItems[0].title}은 조치·교육·보호구 이행 여부 점검용으로만 참고합니다.`
          ]
        : []
    )
  ].join("\n");
}

function formatKoshaPracticalAppendix(
  references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"],
  target: DocumentEvidenceTarget,
  title: string
) {
  const targetLabel = getTargetLabel(target);
  const matched = references.filter((item) => {
    const appliesTo = item.appliesTo || item.appliedTo || [];
    return appliesTo.includes(targetLabel) || (target === "tbm" && appliesTo.some((value) => value.includes("TBM")));
  });
  const picked = (matched.length ? matched : references).slice(0, 2);
  if (!picked.length) return "";

  return [
    "",
    `[${title}]`,
    ...picked.map((item) => (
      `- ${item.title}: ${getTargetAction(target)}`
    ))
  ].join("\n");
}

function formatTbmQualityAppendix(
  response: AskResponse,
  weather: Awaited<ReturnType<typeof fetchWeatherSignal>>,
  foreignWorkerLanguages: AskResponse["deliverables"]["foreignWorkerLanguages"],
  references: Awaited<ReturnType<typeof fetchKoshaReferences>>["references"]
) {
  const tbmReferences = references.filter((item) => {
    const appliesTo = item.appliesTo || item.appliedTo || [];
    return /TBM|작업 전 안전점검|Tool Box/i.test(item.title) || appliesTo.some((value) => value.includes("TBM"));
  });
  const referenceTitles = tbmReferences.length
    ? tbmReferences.slice(0, 2).map((item) => item.title).join(" / ")
    : "고용노동부 작업 전 안전점검회의 가이드 및 TBM 일지 서식";
  const weatherAction = weather.actions[0] || "기상 변화 시 관리감독자가 작업 가능 여부를 재판단";
  const languageLine = foreignWorkerLanguages.length
    ? foreignWorkerLanguages.map((item) => item.label).slice(0, 3).join(", ")
    : "필요 시 쉬운 한국어와 현장 통역";

  return [
    "",
    "[TBM 필수 반영 체크]",
    `- 주요 유해·위험요인: ${response.riskSummary.topRisk}`,
    `- 기상 API 결과: ${weather.summary} / ${weatherAction}`,
    `- 작업중지 기준: ${response.riskSummary.immediateActions.slice(0, 2).join(" / ") || "위험 발견 즉시 작업중지 및 보고"}`,
    `- 참석자 확인: 작업자 ${response.scenario.workerCount.toLocaleString("ko-KR")}명 대상 구두 복창·서명·보호구 확인`,
    `- 신규·외국인·미숙련 작업자: ${languageLine}로 이해 여부 별도 확인`,
    "- 사진·증빙 위치: 작업 전 현장, 보호구, 위험구역 통제, TBM 실시 사진을 작업일지·모바일 기록·문서팩 첨부자료에 보관",
    `- 반영 근거: ${referenceTitles}. 원문성 근거는 evidence UI/metadata에서 확인`
  ].join("\n");
}

function formatSeriousAccidentReferenceAppendix(target: "risk" | "tbm" | "education") {
  const common = [
    "- 내부 참고자료 반영: 중대재해처벌법 실무서 파싱 요약을 바탕으로 유해·위험요인 확인, 개선조치, 교육, 작업중지, 도급관리 축을 점검합니다.",
    "- 주의: 해당 참고자료는 공식 법령 원문을 대체하지 않으며, 최종 근거는 법제처 법령정보와 공식 자료로 재확인합니다."
  ];
  const targetLines = {
    risk: [
      "- 위험성평가 연결: 유해·위험요인을 확인한 뒤 개선대책, 이행 담당자, 조치 완료 확인까지 같은 표에서 남깁니다.",
      "- 도급·협력 작업이 있으면 원청·협력업체 간 위험정보 공유와 작업구역 통제 책임을 별도 확인 항목으로 둡니다."
    ],
    tbm: [
      "- TBM 연결: 작업중지 기준, 보호구 착용, 위험구역 접근금지, 관리감독자 확인을 작업 시작 전에 구두로 확인합니다.",
      "- 작업자가 이해하지 못했거나 위험을 발견한 경우 즉시 멈추고 보고하는 문구를 현장 공유 메시지에 포함합니다."
    ],
    education: [
      "- 안전교육 연결: 신규 투입자, 외국인 근로자, 협력업체 작업자는 이해 여부 확인과 서명·사진·모바일 기록을 남깁니다.",
      "- 교육 후 확인: 위험요인, 작업중지 기준, 보호구·작업방법을 작업자에게 다시 말하게 해 이해도를 확인합니다."
    ]
  }[target];

  return [
    "",
    "[중대재해 예방 관리체계 점검]",
    ...common,
    ...targetLines
  ].join("\n");
}

/**
 * workPlanDraft / tbmBriefing / safetyEducationRecordDraft have no free-text AI
 * producer (only *Structured schema-first prompts exist — see ai-deliverables.ts
 * TABULAR_SPECS), so `aiBodies.*` is always empty for these three fields and the
 * template + appendix-chain branch below always runs. Prod evidence (2026-07-02)
 * showed the appended evidence-log blocks ("[반영 근거]", "[문서 반영]",
 * "[KOSHA ... 직접 인용]", "[공식 서식 기준 보강]", "[근거 요약]") leaking into the
 * printed document — in the worst cases roughly half the document was meta.
 * Strip them here, right before the text becomes the printed document body.
 */
function stripPipelineMeta(text: string): string {
  return splitDocumentMeta(text).body;
}

const SAFETY_TERM_TYPO_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b지게브\b/g, "지게차"],
  [/지게브(?=\s*동선)/g, "지게차"],
  [/지게브(?=\s*후진|\s*선회|\s*작업|\s*운행|\s*충돌|\s*협착|\s*상하차)/g, "지게차"]
];

const TEXT_DELIVERABLE_KEYS = [
  "workpackSummaryDraft",
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft",
  "foreignWorkerBriefing",
  "foreignWorkerTransmission",
  "kakaoMessage"
] as const;

export function normalizeSafetyTermTypos(text: string): string {
  return SAFETY_TERM_TYPO_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  );
}

function normalizeStringArray(values: readonly string[]): string[] {
  return values.map(normalizeSafetyTermTypos);
}

function normalizeAskResponseText(response: AskResponse): AskResponse {
  const deliverables = { ...response.deliverables };
  for (const key of TEXT_DELIVERABLE_KEYS) {
    deliverables[key] = normalizeSafetyTermTypos(deliverables[key]);
  }

  return {
    ...response,
    answer: normalizeSafetyTermTypos(response.answer),
    practicalPoints: normalizeStringArray(response.practicalPoints),
    riskSummary: {
      ...response.riskSummary,
      title: normalizeSafetyTermTypos(response.riskSummary.title),
      topRisk: normalizeSafetyTermTypos(response.riskSummary.topRisk),
      immediateActions: normalizeStringArray(response.riskSummary.immediateActions)
    },
    deliverables
  };
}

export type RunAskOptions = {
  aiMode?: AiMode;
  harnessMemory?: HarnessMemoryInput;
  /** Fixed Phase A evidence selected before any answer or deliverable provider call. */
  phaseAGrounding?: PhaseAGenerationGrounding;
  /** Task D-2a: SSE progress callback for the AI console. Defaults to no-op. */
  onProgress?: OnAskProgress;
};

function summarizeDbHarnessPacket(packet: ReturnType<typeof buildDbHarnessPacket>): NonNullable<AskResponse["dbHarness"]>["summary"] {
  return {
    mode: packet.mode,
    llmRole: packet.generationContract.llmRole,
    llmOutputScope: packet.generationContract.llmOutputScope,
    evidenceAuthority: packet.generationContract.evidenceAuthority,
    providerRetryScope: packet.generationContract.providerRetryScope,
    fallbackChainAllowed: packet.generationContract.fallbackChainAllowed,
    genericProseSubstitutionAllowed: packet.generationContract.genericProseSubstitutionAllowed,
    missingEvidencePolicy: packet.generationContract.missingEvidencePolicy,
    directEvidence: packet.directEvidence.length,
    sifCases: packet.sifCases.length,
    supportingEvidence: packet.supportingEvidence.length,
    improvementMemory: packet.improvementMemory.length,
    workpackMemory: packet.workpackMemory.length,
    missingEvidence: packet.ontologyChecklist.missing,
    documentCoverage: packet.generationContract.documentCoverage,
    retrievalContract: packet.retrievalContract,
    ontologyStatus: packet.ontologyChecklist.status
  };
}

function appendUniqueSection(text: string, heading: string, lines: string[]) {
  const body = text.trim();
  if (!lines.length || body.includes(heading)) return text;
  return `${body}\n\n${heading}\n${lines.map((line) => `- ${line}`).join("\n")}`.trim();
}

function prependUniqueSection(text: string, heading: string, lines: string[]) {
  const body = text.trim();
  if (!lines.length || body.includes(heading)) return text;
  return `${heading}\n${lines.map((line) => `- ${line}`).join("\n")}\n\n${body}`.trim();
}

function buildDbHarnessReflectionLines(packet: DbHarnessPacket) {
  const improvementLines = packet.improvementMemory.slice(0, 3).map((item) => {
    const photoLabel = item.sourceType === "photo_analysis"
      ? item.photoPairAttached
        ? "전후 사진 분석"
        : "사진 분석"
      : "개선 이력";
    const visionSummary = [
      item.visionUserLabel,
      item.visionSummary || item.observedImprovement,
      item.detectedHazards?.length ? `위험요인 ${item.detectedHazards.slice(0, 3).join(", ")}` : "",
      item.ocrText ? `OCR ${item.ocrText}` : "",
      item.visionEvidence
    ].filter(Boolean).join(" / ");
    return `${item.taskLabel} / ${item.hazardLabel}: ${item.improvementText}${visionSummary ? ` (${photoLabel}: ${visionSummary})` : ` (${photoLabel})`}`;
  });
  const workpackLines = packet.workpackMemory.slice(0, 2).map((item) =>
    `${item.generatedAt} 유사 작업: ${item.question} / 상태 ${item.statusLabel}`
  );
  const missingLines = packet.ontologyChecklist.missing.slice(0, 3).map((item) =>
    `공유 전 보완: ${item}`
  );
  return {
    improvementLines,
    workpackLines,
    missingLines,
    coreLines: [...improvementLines, ...workpackLines, ...missingLines]
  };
}

function reflectDbHarnessInDeliverables(response: AskResponse, packet: DbHarnessPacket): AskResponse {
  const { improvementLines, workpackLines, missingLines, coreLines } = buildDbHarnessReflectionLines(packet);
  if (!coreLines.length) return response;

  const riskLines = [
    ...improvementLines.map((line) => `위험성평가 반영: ${line}`),
    ...workpackLines.map((line) => `유사 작업 이력: ${line}`),
    ...missingLines
  ];
  const tbmLines = [
    ...improvementLines.map((line) => `TBM 전달 항목: ${line}`),
    ...workpackLines.map((line) => `이전 작업 재확인: ${line}`),
    ...missingLines
  ];
  const photoLines = [
    ...packet.improvementMemory.slice(0, 5).map((item) => {
      const attached = item.photoPairAttached ? "Before/After 사진 첨부" : "사진 또는 메모 기반";
      const detected = item.detectedHazards?.length ? ` / 감지 위험: ${item.detectedHazards.slice(0, 3).join(", ")}` : "";
      const observed = item.observedImprovement ? ` / 확인 개선: ${item.observedImprovement}` : "";
      const sourcePhotos = item.sourcePhotoNames?.length ? ` / 사진: ${item.sourcePhotoNames.slice(0, 5).join(", ")}` : "";
      const ocr = item.ocrText ? ` / OCR: ${item.ocrText}` : "";
      const siteSignals = item.siteSignals?.length ? ` / 현장 신호: ${item.siteSignals.slice(0, 4).join(", ")}` : "";
      const evidence = item.visionEvidence ? ` / 분석 근거: ${item.visionEvidence}` : "";
      return `${attached}: ${item.taskLabel} - ${item.improvementText}${sourcePhotos}${detected}${observed}${ocr}${siteSignals}${evidence}`;
    }),
    ...missingLines
  ];

  return {
    ...response,
    deliverables: {
      ...response.deliverables,
      riskAssessmentDraft: prependUniqueSection(
        response.deliverables.riskAssessmentDraft,
        "[오늘 개선·이력 반영 - 위험성평가]",
        riskLines
      ),
      tbmBriefing: prependUniqueSection(
        response.deliverables.tbmBriefing,
        "[오늘 개선·이력 반영 - TBM]",
        tbmLines
      ),
      tbmLogDraft: prependUniqueSection(
        response.deliverables.tbmLogDraft,
        "[오늘 개선·이력 반영 - 확인 기록]",
        tbmLines
      ),
      photoEvidenceDraft: appendUniqueSection(
        response.deliverables.photoEvidenceDraft,
        "[사진·개선사항 반영]",
        photoLines.length ? photoLines : coreLines
      )
    }
  };
}

function attachPhotoSeedStructuredOutput(response: AskResponse, improvements: readonly HarnessImprovement[]): AskResponse {
  const photoRows = buildPhotoHazardRiskRows(response, improvements);
  if (!photoRows.length) return response;
  const existingRows = response.structured?.riskAssessmentRows || [];
  const riskAssessmentRows = appendPhotoSeedRiskRows(existingRows, photoRows);
  const acceptedPhotoRows = riskAssessmentRows.slice(existingRows.length);
  const validation = validateRiskAssessmentRows(riskAssessmentRows);
  const existingLinks = response.structured?.tbmRiskLinks || [];
  const firstPhotoIndex = existingRows.length;
  const photoLinks = buildTbmRiskLinks(acceptedPhotoRows, response.scenario.weatherNote)
    .map((link, index) => ({ ...link, riskRowIndex: firstPhotoIndex + index }));
  const tbmRiskLinks = existingLinks.length ? [...existingLinks, ...photoLinks] : buildTbmRiskLinks(riskAssessmentRows, response.scenario.weatherNote);
  return {
    ...response,
    structured: {
      ...response.structured,
      riskAssessmentRows,
      tbmRiskLinks,
      riskAssessmentValidation: {
        ok: validation.rows.length > 0 && validation.issues.length === 0,
        issueCount: validation.issues.length,
        issues: validation.issues
      }
    }
  };
}

export function attachDbHarnessFallback(response: AskResponse, input: {
  question: string;
  harnessMemory: Required<HarnessMemoryInput>;
}): AskResponse {
  const internalPacket = buildDbHarnessPacket({
    question: input.question,
    references: [],
    improvements: input.harnessMemory.improvements,
    workpackMemory: input.harnessMemory.workpackMemory
  });
  const packet = buildPublicDbHarnessPacket(internalPacket);
  const promptContext = buildHarnessPromptContext(packet);
  const reflectedResponse = reflectDbHarnessInDeliverables(response, packet);
  const structuredResponse = attachPhotoSeedStructuredOutput(reflectedResponse, input.harnessMemory.improvements);
  return attachQualityContract({
    ...structuredResponse,
    answer: buildDbHarnessAnswer(packet),
    practicalPoints: buildDbHarnessPracticalPoints(packet),
    dbHarness: {
      packet,
      promptContext,
      summary: summarizeDbHarnessPacket(packet)
    },
    status: {
      ...response.status,
      detail: `${response.status.detail} / DB 하네스 계약: ${packet.ontologyChecklist.status}`
    }
  });
}

export async function runAsk(question: string, options: RunAskOptions = {}): Promise<AskResponse> {
  const onProgress = options.onProgress;
  const traceId = randomUUID();
  const harnessMemory = {
    improvements: options.harnessMemory?.improvements || [],
    workpackMemory: options.harnessMemory?.workpackMemory || []
  };
  const aiMode = resolveRunAskMode({
    requestedMode: options.aiMode,
    envDefault: process.env.AI_MODE_DEFAULT
  });
  let deliverablesAttempted = false;
  let deliverablesGroundingPacket: GroundedGenerationPacket | null = null;

  // Fix 4: template fast path — no external calls, no AI, pure static output < 100ms
  if (aiMode === "template") {
    const response = applyPhaseAResponseBoundary(attachDbHarnessFallback(
      buildMockAskResponse(
        question,
        mockSearchResults.slice(0, 4),
        "mock",
        "AI_MODE=template (외부 호출 없음, DB 하네스 템플릿 계약 적용)"
      ),
      { question, harnessMemory }
    ), options.phaseAGrounding);
    const upstreamTrace = {
      provider: "mock",
      model: null,
      fallbackUsed: false
    } as const;
    const deliverablesTrace = finalizeDeliverablesTrace(response, {
      attempted: false,
      provider: null,
      modelPerDocument: {},
      fallbackUsed: false
    });
    const generationTrace: GenerationTrace = {
      traceId,
      askMode: aiMode,
      answer: buildFinalAnswerTrace(upstreamTrace),
      deliverables: {
        attempted: deliverablesTrace.attempted,
        provider: deliverablesTrace.provider,
        modelPerDocument: deliverablesTrace.modelPerDocument
      },
      fallbackUsed: deliverablesTrace.fallbackUsed
    };
    return { ...response, generationTrace };
  }

  try {
    const accidentCasesPromise = fetchAccidentCases(question, {
      requestTimeoutMs: 5_000,
      retryCount: 0,
      budgetLabel: "KOSHA accident case enrichment budget"
    });

    // Fix 5: decouple enhance and generateAnswer — both branch off rawCitations in parallel.
    // enhanceLegalEvidenceMappings is a quality add-on (AI reorders citations); it no longer
    // gates generateAnswer. generateAnswer starts as soon as raw citations arrive.
    // citationsPromise resolves to enhanced citations when available (best-effort).
    const rawCitationsPromise = searchLegalSources(question);
    const rawCitationsBasePromise = rawCitationsPromise.then(async (raw) =>
      raw.length ? raw : searchLegalSources("산업안전보건법")
    );
    // enhanceLegalEvidenceMappings: optional quality pass, runs in parallel, best-effort.
    const citationsPromise = rawCitationsBasePromise.then((base) =>
      enhanceLegalEvidenceMappings(question, base, options.phaseAGrounding).catch((error) => {
        log.error(
          "AI legal evidence mapping failed; using original legal evidence order",
          safeFailureContext(error)
        );
        return base;
      })
    );
    // generateAnswer uses raw citations directly — no longer waits for enhance.
    const responsePromise = rawCitationsBasePromise.then((rawBase) =>
      generateAnswer(question, rawBase.slice(0, 6), {
        traceId,
        phaseAGrounding: options.phaseAGrounding,
      }).catch((error): AnswerGenerationResult => {
        log.error("AI response generation failed; using DB harness fallback", safeFailureContext(error));
        return {
          response: applyPhaseAResponseBoundary(buildMockAskResponse(
            question,
            rawBase.slice(0, 6),
            "fallback",
            "AI 응답 생성에 실패해 공식자료 기반 산출물 초안으로 전환했습니다."
          ), options.phaseAGrounding),
          trace: {
            provider: "mock",
            model: null,
            fallbackUsed: true
          }
        };
      })
    );

    const weatherPromise = fetchWeatherSignal(question);
    const trainingPromise = fetchTrainingRecommendations(question);
    const koshaEducationPromise = fetchKoshaEducationRecommendations(question);
    const koshaPromise = fetchKoshaReferences(question);
    const koshaOpenApiPromise = fetchKoshaOpenApiEvidence(question);
    // Track D / E: Supabase safety_reference_items (9,920 rows) RAG.
    // Boost KOSHA technical-* types ahead of generic sif-case rows so the
    // most authoritative refs (KOSHA 기술지침 / 기술지원규정) actually show up.
    const emptyResult: SafetyReferenceSearchResult = {
      ok: false as const,
      configured: false as const,
      query: question,
      count: 0,
      items: [] as SafetyReferenceItem[],
      retrievalMode: "unconfigured",
      vectorSearch: {
        enabled: false,
        attempted: false,
        ok: false,
        reason: "disabled",
        count: 0,
        model: "text-embedding-3-small",
        message: "SIF 임베딩 검색은 승인 전 기본 비활성입니다."
      },
      message: ""
    };
    const safeSearch = (opts: Parameters<typeof searchSafetyReferences>[0]) =>
      searchSafetyReferences(opts).catch((error) => {
        log.error("safety reference search failed", safeFailureContext(error));
        return {
          ...emptyResult,
          errorCode: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
          message: SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE
        };
      });
    const safetyReferencePromise = (async () => {
      const [supportReg, guideline, sif, general] = await Promise.all([
        safeSearch({ query: question, limit: 3, itemType: "technical-support-regulation" }),
        safeSearch({ query: question, limit: 3, itemType: "technical-guideline" }),
        safeSearch({ query: question, limit: 3, itemType: "sif-case" }),
        safeSearch({ query: question, limit: 5 })
      ]);
      // Merge all buckets, then rerank by task-specific query relevance. Official
      // KOSHA refs still stay in the candidate set, but broad support regulations
      // should not outrank SIF/confined-space/LOTO-specific evidence.
      const seen = new Set<string>();
      const candidates: SafetyReferenceItem[] = [];
      for (const bucket of [supportReg.items, guideline.items, sif.items, general.items]) {
        for (const item of bucket) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          candidates.push(item);
        }
      }
      const rankedCandidates = filterAndRankSafetyReferencesByQuery(question, candidates, 10);
      const merged = rankedCandidates.length ? rankedCandidates : candidates.slice(0, 10);
      const configured = supportReg.configured || guideline.configured || sif.configured || general.configured;
      const messageParts = [
        `KOSHA 기술지원규정 ${supportReg.count}건`,
        `KOSHA 기술지침 ${guideline.count}건`,
        `SIF 유사사례 ${sif.count}건`,
        `일반 카탈로그 ${general.count}건`
      ];
      const buckets = [supportReg, guideline, sif, general];
      const errorCode = buckets.some((bucket) => bucket.errorCode === SAFETY_REFERENCE_SEARCH_FAILURE_CODE)
        ? SAFETY_REFERENCE_SEARCH_FAILURE_CODE
        : undefined;
      const attemptedRetrievalMode: SafetyReferenceRetrievalMode = buckets.some((bucket) => bucket.retrievalMode === "hybrid-vector-rpc")
        ? "hybrid-vector-rpc"
        : buckets.some((bucket) => bucket.retrievalMode === "ranked-rpc")
          ? "ranked-rpc"
          : buckets.some((bucket) => bucket.retrievalMode === "rest-ilike")
            ? "rest-ilike"
            : "unconfigured";
      const retrievalMode = deriveSafetyReferenceRetrievalModeFromItems(merged, attemptedRetrievalMode);
      const vectorSearch =
        buckets.find((bucket) => bucket.vectorSearch.ok)?.vectorSearch ||
        buckets.find((bucket) => bucket.vectorSearch.attempted)?.vectorSearch ||
        general.vectorSearch ||
        guideline.vectorSearch ||
        supportReg.vectorSearch;
      return {
        ok: merged.length > 0 || general.ok || guideline.ok || supportReg.ok,
        configured,
        ...(errorCode ? { errorCode } : {}),
        query: question,
        count: merged.length,
        items: merged,
        retrievalMode,
        vectorSearch,
        message: errorCode
          ? SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE
          : configured
          ? `Supabase 안전 지식 DB 호출 완료 (${messageParts.join(", ")}, 작업특화 rerank 적용)`
          : "Supabase 안전 지식 DB가 설정되지 않았습니다."
      };
    })();

    // Fix 6: Start full-mode deliverables generation as a Promise BEFORE awaiting allSettled.
    // Scenario is derived synchronously from the question (inferScenario is pure).
    // We chain off rawCitationsBasePromise/weather/training/kosha/accident so the
    // full-mode Vertex calls start as soon as those resolve (~2-5s), running
    // fully in parallel with responsePromise's Vertex call. Enhanced mode is
    // row-first: DB/SIF/KOSHA/photo harness rows are assembled deterministically.
    const earlyScenario = inferScenario(question);
    const earlyScenarioParsed = {
      companyName: earlyScenario.companyName,
      companyType: earlyScenario.companyType,
      siteName: earlyScenario.siteName,
      workSummary: earlyScenario.workSummary,
      workerCount: earlyScenario.workerCount,
      weatherNote: earlyScenario.weatherNote
    };
    const deliverablesPromise: Promise<{ deliverables: Awaited<ReturnType<typeof generateAllDeliverables>>; diagnostics: Awaited<ReturnType<typeof generateAllDeliverablesWithDiagnostics>>["diagnostics"] } | null> =
      aiMode === "full"
        ? Promise.all([
            rawCitationsBasePromise.catch(() => [] as Awaited<ReturnType<typeof searchLegalSources>>),
            weatherPromise.catch(() => null),
            trainingPromise.catch(() => null),
            koshaPromise.catch(() => null),
            accidentCasesPromise.catch(() => null),
            safetyReferencePromise.catch(() => null),
          ]).then(([rawBase, wthr, trng, ksha, acc, safeRef]) => {
            const safeRefItems = safeRef?.items ?? [];
            const internalDbHarnessPacket = buildDbHarnessPacket({
              question,
              references: safeRefItems,
              improvements: harnessMemory.improvements,
              workpackMemory: harnessMemory.workpackMemory,
              retrieval: safeRef
                ? {
                    errorCode: safeRef.errorCode,
                    mode: safeRef.retrievalMode,
                    vectorSearch: safeRef.vectorSearch,
                    message: safeRef.message
                  }
                : undefined
            });
            const dbHarnessPacket = buildPublicDbHarnessPacket(internalDbHarnessPacket);
            const koshaParentEvidenceReadyIdsEarly = buildKoshaParentEvidenceReadyIds(dbHarnessPacket);
            const groundingPacket = buildGroundedGenerationPacket({
              dbHarnessPacket,
              legalCandidates: rawBase.slice(0, 6),
              eligibleKoshaIds: koshaParentEvidenceReadyIdsEarly
            });
            deliverablesGroundingPacket = groundingPacket;
            const dbHarnessContext = buildHarnessPromptContext(dbHarnessPacket);
            const publicSafeRefItems = [
              ...dbHarnessPacket.directEvidence,
              ...dbHarnessPacket.sifCases,
              ...dbHarnessPacket.supportingEvidence
            ];
            const compressed = compressSafetyReferenceMatches(publicSafeRefItems, 5);
            const koshaPrimaryRefsEarly = buildRequiredKoshaCitations(publicSafeRefItems, {
              parentEvidenceReadyIds: koshaParentEvidenceReadyIdsEarly
            });
            const koshaLinesEarly = [
              ...(ksha?.references ?? []).slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.url}`),
              ...compressed.slice(0, 5).map((item, index) => formatSafetyReferencePromptLine(
                item,
                Math.min(5, (ksha?.references ?? []).length) + index + 1,
                { parentEvidenceReady: koshaParentEvidenceReadyIdsEarly.has(item.id) }
              ))
            ].slice(0, 12);
            const trainingLinesEarly = (trng?.recommendations ?? []).slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.institution} | ${r.fitLabel || ""}`);
            const accidentLinesEarly = (acc?.cases ?? []).slice(0, 5).map((c, i) => `${i + 1}. ${c.title} | ${c.preventionPoint}`);
            deliverablesAttempted = true;
            return generateAllDeliverablesWithDiagnostics({
              scenario: earlyScenarioParsed,
              question,
              citations: rawBase.slice(0, 6),
              weatherSummary: wthr?.summary,
              trainingLines: trainingLinesEarly,
              koshaLines: koshaLinesEarly,
              accidentLines: accidentLinesEarly,
              koshaPrimaryRefs: koshaPrimaryRefsEarly,
              dbHarnessContext,
              groundingPacket,
              phaseAGrounding: options.phaseAGrounding,
              scope: "full",
              onProgress,
              traceId
            }).then((result) => {
              deliverablesAttempted = result.diagnostics.trace.attempted;
              return result;
            }).catch((error) => {
              log.error(
                "AI deliverable generation failed (parallel path); falling back to template bodies",
                safeFailureContext(error)
              );
              return {
                deliverables: {},
                diagnostics: buildFailedDeliverablesDiagnostics({
                  attempted: deliverablesAttempted,
                  fallbackUsed: true,
                  groundingPacket
                })
              };
            });
          }).catch((error) => {
            log.error("deliverablesPromise setup failed", safeFailureContext(error));
            return {
              deliverables: {},
              diagnostics: buildFailedDeliverablesDiagnostics({
                attempted: false,
                fallbackUsed: true,
                groundingPacket: deliverablesGroundingPacket
              })
            };
          })
        : Promise.resolve(null);

    // Fix 2: Promise.allSettled — one hanging branch no longer blocks the whole batch.
    // Fix 3 completes: citationsPromise + responsePromise are now in the same batch.
    const weatherFallback: Awaited<ReturnType<typeof fetchWeatherSignal>> = {
      source: "kma",
      mode: "fallback",
      locationLabel: "알 수 없음",
      summary: "기상 정보를 가져오지 못했습니다.",
      actions: [],
      detail: "기상청 API 호출 실패",
      signals: []
    };
    const trainingFallback: Awaited<ReturnType<typeof fetchTrainingRecommendations>> = {
      source: "work24",
      mode: "fallback",
      detail: "고용24 교육 정보를 가져오지 못했습니다.",
      recommendations: []
    };
    const koshaEducationFallback: Awaited<ReturnType<typeof fetchKoshaEducationRecommendations>> = {
      source: "kosha-edu",
      mode: "fallback",
      detail: "KOSHA 교육포털 정보를 가져오지 못했습니다.",
      recommendations: []
    };
    const koshaFallback: Awaited<ReturnType<typeof fetchKoshaReferences>> = {
      source: "kosha",
      mode: "fallback",
      detail: "KOSHA 공식자료 확인에 실패했습니다.",
      references: []
    };
    const koshaOpenApiFallback: Awaited<ReturnType<typeof fetchKoshaOpenApiEvidence>> = {
      source: "kosha-openapi",
      mode: "fallback",
      detail: "KOSHA OpenAPI 호출에 실패했습니다.",
      references: []
    };
    const accidentCasesFallback: Awaited<ReturnType<typeof fetchAccidentCases>> = {
      source: "kosha-accident",
      mode: "fallback",
      detail: "KOSHA 사고사례 호출에 실패했습니다.",
      cases: []
    };
    const safetyReferenceFallback: SafetyReferenceSearchResult = {
      ...emptyResult,
      errorCode: SAFETY_REFERENCE_SEARCH_FAILURE_CODE,
      message: SAFETY_REFERENCE_SEARCH_FAILURE_MESSAGE
    };

    // Task D-2a: side-listener attachment only — does not alter allSettled's inputs or
    // timing. Each promise below is passed through to Promise.allSettled unchanged.
    attachProgressListeners(
      [
        { stage: "weather", promise: weatherPromise },
        { stage: "training", promise: trainingPromise },
        { stage: "koshaEducation", promise: koshaEducationPromise },
        { stage: "kosha", promise: koshaPromise },
        { stage: "koshaOpenApi", promise: koshaOpenApiPromise },
        { stage: "accidentCases", promise: accidentCasesPromise },
        { stage: "response", promise: responsePromise },
        { stage: "safetyReference", promise: safetyReferencePromise },
        { stage: "citations", promise: citationsPromise },
        { stage: "deliverables", promise: deliverablesPromise }
      ],
      onProgress
    );

    const allResults = await Promise.allSettled([
      weatherPromise,         // 0
      trainingPromise,        // 1
      koshaEducationPromise,  // 2
      koshaPromise,           // 3
      koshaOpenApiPromise,    // 4
      accidentCasesPromise,   // 5
      responsePromise,        // 6
      safetyReferencePromise, // 7
      citationsPromise,       // 8
      deliverablesPromise     // 9 — runs in parallel with the above
    ]);

    const weather = allResults[0].status === "fulfilled" ? allResults[0].value : (
      log.warn("weatherPromise failed", safeFailureContext((allResults[0] as PromiseRejectedResult).reason)),
      weatherFallback
    );
    const training = allResults[1].status === "fulfilled" ? allResults[1].value : (
      log.warn("trainingPromise failed", safeFailureContext((allResults[1] as PromiseRejectedResult).reason)),
      trainingFallback
    );
    const koshaEducation = allResults[2].status === "fulfilled" ? allResults[2].value : (
      log.warn("koshaEducationPromise failed", safeFailureContext((allResults[2] as PromiseRejectedResult).reason)),
      koshaEducationFallback
    );
    const kosha = allResults[3].status === "fulfilled" ? allResults[3].value : (
      log.warn("koshaPromise failed", safeFailureContext((allResults[3] as PromiseRejectedResult).reason)),
      koshaFallback
    );
    const koshaOpenApi = allResults[4].status === "fulfilled" ? allResults[4].value : (
      log.warn("koshaOpenApiPromise failed", safeFailureContext((allResults[4] as PromiseRejectedResult).reason)),
      koshaOpenApiFallback
    );
    const accidentCases = allResults[5].status === "fulfilled" ? allResults[5].value : (
      log.warn("accidentCasesPromise failed", safeFailureContext((allResults[5] as PromiseRejectedResult).reason)),
      accidentCasesFallback
    );
    const answerResult: AnswerGenerationResult = allResults[6].status === "fulfilled"
      ? allResults[6].value
      : (
          log.warn("responsePromise failed", safeFailureContext((allResults[6] as PromiseRejectedResult).reason)),
          {
          response: applyPhaseAResponseBoundary(
            buildMockAskResponse(question, mockSearchResults.slice(0, 4), "fallback", "AI 응답 생성 실패"),
            options.phaseAGrounding,
          ),
          trace: {
            provider: "mock" as const,
            model: null,
            fallbackUsed: true
          }
          }
        );
    const response = applyPhaseAAnswerBoundary(answerResult.response, options.phaseAGrounding);
    const safetyReference = allResults[7].status === "fulfilled" ? allResults[7].value : (
      log.warn("safetyReferencePromise failed", safeFailureContext((allResults[7] as PromiseRejectedResult).reason)),
      safetyReferenceFallback
    );
    const internalDbHarnessEvidencePacket = buildDbHarnessPacket({
      question,
      references: safetyReference.items,
      improvements: harnessMemory.improvements,
      workpackMemory: harnessMemory.workpackMemory,
      retrieval: {
        errorCode: safetyReference.errorCode,
        mode: safetyReference.retrievalMode,
        vectorSearch: safetyReference.vectorSearch,
        message: safetyReference.message
      }
    });
    const dbHarnessEvidencePacket = buildPublicDbHarnessPacket(internalDbHarnessEvidencePacket);
    const koshaParentEvidenceReadyIds = buildKoshaParentEvidenceReadyIds(dbHarnessEvidencePacket);
    const hasIndependentParentEvidence = dbHarnessEvidencePacket.directEvidence.length > 0
      || dbHarnessEvidencePacket.sifCases.length > 0;
    const hasOperationalParentEvidence = hasIndependentParentEvidence
      || dbHarnessEvidencePacket.improvementMemory.length > 0;
    const hasParentlessKoshaSupport = dbHarnessEvidencePacket.supportingEvidence.some((item) => (
      isKoshaTechnicalReference(item)
      && !koshaParentEvidenceReadyIds.has(item.id)
    ));
    const parentlessKoshaReviewRequired = !hasOperationalParentEvidence && hasParentlessKoshaSupport;
    const publicEvidenceItems = [
      ...dbHarnessEvidencePacket.directEvidence,
      ...dbHarnessEvidencePacket.sifCases,
      ...dbHarnessEvidencePacket.supportingEvidence
    ];
    const citations = allResults[8].status === "fulfilled" ? allResults[8].value : (
      log.warn("citationsPromise failed", safeFailureContext((allResults[8] as PromiseRejectedResult).reason)),
      mockSearchResults.slice(0, 4)
    );
    const deliverablesResult = allResults[9].status === "fulfilled"
      ? allResults[9].value
      : (
          log.warn(
            "deliverablesPromise failed",
            safeFailureContext((allResults[9] as PromiseRejectedResult).reason)
          ),
          aiMode === "full"
            ? {
                deliverables: {},
                diagnostics: buildFailedDeliverablesDiagnostics({
                  attempted: deliverablesAttempted,
                  fallbackUsed: true,
                  groundingPacket: deliverablesGroundingPacket
                })
              }
            : null
        );
    const koreanLawMcpCount = citations.filter((item) => item.sourceSystem === "korean-law-mcp").length;
    const sourceMix = summarizeLegalSourceMix(citations);
    const legalEvidenceMode = inferLegalEvidenceMode(sourceMix);
    const trainingAppendix = training.recommendations.length
      ? `\n\n[추천 후속 교육]\n${training.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.institution} / ${item.startDate}~${item.endDate}`).join("\n")}`
      : "";
    const koshaEducationAppendix = koshaEducation.recommendations.length
      ? `\n\n[KOSHA 교육포털 연계]\n${koshaEducation.recommendations.map((item, index) => `${index + 1}. ${item.title} / ${item.provider} / ${item.target} / ${item.fitLabel}`).join("\n")}`
      : "";
    const koshaAppendix = formatOfficialTemplateAppendix(kosha.references);
    const riskAssessmentOfficialAppendix = formatRiskAssessmentOfficialAppendix(kosha.references);
    const safetyEducationOfficialAppendix = formatSafetyEducationOfficialAppendix(kosha.references);
    const riskLegalAppendix = formatLegalEvidenceAppendix(citations, "risk");
    const workPlanLegalAppendix = formatLegalEvidenceAppendix(citations, "workPlan");
    const educationLegalAppendix = formatLegalEvidenceAppendix(citations, "education");
    const riskSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("risk");
    const educationSeriousAccidentAppendix = formatSeriousAccidentReferenceAppendix("education");
    const workPlanKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "workPlan", "반영 근거: 작업계획 공식자료");
    const educationKoshaAppendix = formatKoshaPracticalAppendix(kosha.references, "education", "반영 근거: 교육 공식자료");
    const trainingFitLines = training.recommendations.slice(0, 2).map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`);
    const accidentAppendix = formatAccidentCaseAppendix(accidentCases.cases);
    const photoEvidenceAppendix = buildPhotoEvidenceAppendix(citations, kosha.references, accidentCases.cases);
    const riskKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "risk");
    const workPlanKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "workPlan");
    const educationKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "education");
    const emergencyKoshaOpenApiAppendix = formatKoshaOpenApiAppendix(koshaOpenApi.references, "emergency");
    const outdoorHeatEnabled = hasOutdoorHeatSignal(weather, question);
    const outdoorHeatRiskAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "risk") : "";
    const outdoorHeatTbmAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "tbm") : "";
    const outdoorHeatEducationAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "education") : "";
    const outdoorHeatMessageAppendix = outdoorHeatEnabled ? formatOutdoorHeatAppendix(weather, "message") : "";
    const safetyKnowledgeMatches = matchSafetyKnowledge(question, 4);
    const safetyKnowledgeAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "risk");
    const safetyKnowledgeEducationAppendix = formatSafetyKnowledgeAppendix(safetyKnowledgeMatches, "education");
    const foreignWorkerInput = {
      question,
      scenario: response.scenario,
      riskSummary: response.riskSummary
    };

    const foreignWorkerLanguages = buildForeignWorkerLanguages(foreignWorkerInput);
    const tbmQualityAppendix = formatTbmQualityAppendix(response, weather, foreignWorkerLanguages, kosha.references);

    // Track C: Optionally call Gemini for the document bodies. The decoration
    // appendices below still apply on top of whichever body source we choose.
    const accidentLines = accidentCases.cases.slice(0, 5).map((c, i) => `${i + 1}. ${c.title} | ${c.preventionPoint}`);
    const trainingLinesCtx = training.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.institution} | ${r.fitLabel || ""}`);
    // Compress catalog hits before prompting; unverified technical KOSHA rows keep
    // only an honest review-state marker and never expose their body or control text.
    const safetyReferenceCompressed = compressSafetyReferenceMatches(publicEvidenceItems, 5);
    const safetyReferenceAppendix = formatSafetyReferenceAppendix(
      safetyReferenceCompressed.filter(
        (item) => !isTechnicalKoshaCompressed(item) || koshaParentEvidenceReadyIds.has(item.id)
      ),
      {
        parentEvidenceReadyIds: koshaParentEvidenceReadyIds
      }
    );

    // Fix 6 continued: consume deliverables from the parallel Promise (allResults[9]).
    let aiBodies: Awaited<ReturnType<typeof generateAllDeliverables>> = {};
    let aiModeAppliedDetail = "AI_MODE=template (템플릿 본문 사용)";
    if (aiMode === "enhanced" || aiMode === "full") {
      if (aiMode === "enhanced") {
        aiModeAppliedDetail = "AI_MODE=enhanced (DB 하네스 row-first: 위험성평가 row 확정, TBM 구조 deterministic 조립)";
      } else if (deliverablesResult) {
        const { deliverables, diagnostics } = deliverablesResult;
        aiBodies = parentlessKoshaReviewRequired ? {} : deliverables;
        const filled = Object.keys(aiBodies);
        const groupBrief = diagnostics.groupResults
          .map((g) => `${g.group}=${g.status === "fulfilled" ? "ok" : "fallback"}`)
          .join(" ");
        aiModeAppliedDetail = parentlessKoshaReviewRequired
          ? `AI_MODE=${aiMode} (SIF/direct parent 없음: 제공자 본문 폐기, deterministic 검토 baseline 사용) [${groupBrief}]`
          : `AI_MODE=${aiMode} (AI 본문 ${filled.length}개 채움: ${filled.join(", ") || "없음"}) [${groupBrief}]`;
      } else {
        aiModeAppliedDetail = `AI_MODE=${aiMode} 문서 생성기 미응답 → 하네스 템플릿 보강`;
      }
    }
    const responseDeliverables = options.phaseAGrounding
      ? buildPhaseACanonicalDeliverables(options.phaseAGrounding)
      : parentlessKoshaReviewRequired
        ? buildParentlessKoshaReviewDeliverables(question, citations)
        : response.deliverables;
    const boundedResponseDeliverables = hasParentlessKoshaSupport
      ? Object.fromEntries(Object.entries(responseDeliverables).filter(([key]) => (
          key !== "structuredRiskRows"
          && key !== "structuredRiskRowsValidationIssues"
          && key !== "tbmRiskLinks"
        ))) as AskResponse["deliverables"]
      : responseDeliverables;
    const baseDeliverables = {
      ...boundedResponseDeliverables,
      ...Object.fromEntries(Object.entries(aiBodies).filter(([key, v]) => (
        v != null
        && key !== "structuredRiskRows"
        && key !== "structuredRiskRowsValidationIssues"
        && (!hasParentlessKoshaSupport || key !== "tbmRiskLinks")
      )))
    };
    const generatedStructuredRiskValidation = normalizeAndValidateRiskAssessmentRows(aiBodies.structuredRiskRows || []);
    const generatedStructuredRiskRows = parentlessKoshaReviewRequired || hasParentlessKoshaSupport
      ? []
      : generatedStructuredRiskValidation.rows;
    const photoSeedRiskRows = options.phaseAGrounding
      ? []
      : buildPhotoHazardRiskRows(response, harnessMemory.improvements);
    const harnessStructuredRiskRows = generatedStructuredRiskRows.length
      || parentlessKoshaReviewRequired
      ? []
      : buildSafetyReferenceRiskRows(response, publicEvidenceItems, weather.summary, question);
    const fallbackStructuredRiskRows = options.phaseAGrounding
      ? []
      : generatedStructuredRiskRows.length
      ? []
      : harnessStructuredRiskRows.length
        ? harnessStructuredRiskRows
        : parentlessKoshaReviewRequired
          ? []
          : buildFallbackRiskAssessmentRows(response, weather.summary);
    const baseStructuredRiskRows = generatedStructuredRiskRows.length
      ? generatedStructuredRiskRows
      : fallbackStructuredRiskRows;
    const structuredRiskRows = appendPhotoSeedRiskRows(baseStructuredRiskRows, photoSeedRiskRows);
    const acceptedPhotoSeedRiskRows = structuredRiskRows.slice(baseStructuredRiskRows.length);
    const structuredValidation = validateRiskAssessmentRows(structuredRiskRows);
    const structuredRiskIssues = structuredValidation.issues;
    if (aiMode === "enhanced") {
      safeEmit(onProgress, {
        kind: "doc",
        name: "structuredRiskRows",
        status: structuredRiskRows.length && !structuredRiskIssues.length ? "ok" : "fail"
      });
    }
    const structuredRiskSourceDetail = parentlessKoshaReviewRequired
      ? `structured rows=review required (SIF/direct parent 없음)${photoSeedRiskRows.length ? ` + photo seeds ${photoSeedRiskRows.length}` : ""}`
      : generatedStructuredRiskRows.length
        ? `structured rows=AI${photoSeedRiskRows.length ? ` + photo seeds ${photoSeedRiskRows.length}` : ""}`
        : `structured rows=${harnessStructuredRiskRows.length ? "DB harness deterministic" : "deterministic baseline"}${photoSeedRiskRows.length ? ` + photo seeds ${photoSeedRiskRows.length}` : ""}`;
    const generatedTbmRiskLinks = parentlessKoshaReviewRequired || hasParentlessKoshaSupport ? [] : aiBodies.tbmRiskLinks || [];
    const photoSeedRiskStartIndex = baseStructuredRiskRows.length;
    const photoSeedTbmRiskLinks = acceptedPhotoSeedRiskRows.length
      ? buildTbmRiskLinks(acceptedPhotoSeedRiskRows, weather.summary)
        .map((link, index) => ({ ...link, riskRowIndex: photoSeedRiskStartIndex + index }))
      : [];
    const tbmRiskLinks = generatedTbmRiskLinks.length
      ? [...generatedTbmRiskLinks, ...photoSeedTbmRiskLinks]
      : buildTbmRiskLinks(structuredRiskRows, weather.summary);
    const tbmRiskSourceDetail = parentlessKoshaReviewRequired
      ? "TBM-risk links=review required (SIF/direct parent 없음)"
      : generatedTbmRiskLinks.length
        ? `TBM-risk links=AI${photoSeedTbmRiskLinks.length ? ` + photo seed links ${photoSeedTbmRiskLinks.length}` : ""}`
        : `TBM-risk links=${harnessStructuredRiskRows.length ? "DB harness deterministic" : "deterministic baseline"}`;
    const deterministicTbmBriefingStructured = aiMode === "enhanced" && structuredRiskRows.length
      ? buildTbmBriefingStructuredFromRiskRows(response.scenario, structuredRiskRows, weather.summary)
      : null;
    const deterministicTbmLogStructured = aiMode === "enhanced" && structuredRiskRows.length
      ? buildTbmLogStructuredFromRiskRows(response.scenario, structuredRiskRows, weather.summary)
      : null;
    const tbmStructuredSourceDetail = aiBodies.tbmBriefingStructured || aiBodies.tbmLogStructured
      ? "TBM structured=AI"
      : deterministicTbmBriefingStructured && deterministicTbmLogStructured
        ? "TBM structured=deterministic from risk rows"
        : "TBM structured=template";
    const linkedWorkPlanStructured = linkWorkPlanToRiskRows(baseDeliverables.workPlanStructured, structuredRiskRows);
    const linkedPermitInspectionStructured = linkPermitToRiskRows(baseDeliverables.permitInspectionStructured, structuredRiskRows);
    const foreignWorkerBriefingText = aiBodies.foreignWorkerBriefing ?? buildForeignWorkerBriefing(foreignWorkerInput);
    const foreignWorkerTransmissionText = aiBodies.foreignWorkerTransmission ?? buildForeignWorkerTransmission(foreignWorkerInput);
    const groundingDiagnostics = deliverablesResult?.diagnostics.grounding;
    const fallbackMaterialization = JSON.stringify({
      deliverables: baseDeliverables,
      structuredRiskRows,
      tbmRiskLinks
    });
    const hasRejectedDeliverableGroup = deliverablesResult?.diagnostics.groupResults.some((group) => (
      group.status === "rejected"
    )) === true;
    const groundingFallbackMissing = groundingDiagnostics && hasRejectedDeliverableGroup
      ? groundingDiagnostics.criticalControls
        .filter((control) => !fallbackMaterialization.includes(control))
        .map((control) => `grounded-generation fallback missing critical control: ${control}`)
      : [];
    const internalDbHarnessPacket = buildDbHarnessPacket({
      question,
      references: safetyReference.items,
      improvements: harnessMemory.improvements,
      workpackMemory: harnessMemory.workpackMemory,
      ontologyMissing: [
        ...structuredRiskIssues.map((issue) => `${String(issue.field)}: ${issue.message}`),
        ...groundingFallbackMissing
      ],
      retrieval: {
        errorCode: safetyReference.errorCode,
        mode: safetyReference.retrievalMode,
        vectorSearch: safetyReference.vectorSearch,
        message: safetyReference.message
      }
    });
    const dbHarnessPacket = buildPublicDbHarnessPacket(internalDbHarnessPacket);
    const dbHarnessPromptContext = buildHarnessPromptContext(dbHarnessPacket);
    const dbHarnessSummary = summarizeDbHarnessPacket(dbHarnessPacket);
    const dbHarnessAnswer = buildDbHarnessAnswer(dbHarnessPacket);
    const dbHarnessPracticalPoints = buildDbHarnessPracticalPoints(dbHarnessPacket);
    const publicSafetyReferenceItems = [
      ...dbHarnessPacket.directEvidence,
      ...dbHarnessPacket.sifCases,
      ...dbHarnessPacket.supportingEvidence
    ];
    const upstreamDeliverablesExecutionTrace = deliverablesResult?.diagnostics.trace ?? {
      attempted: false,
      provider: null,
      modelPerDocument: {},
      fallbackUsed: false
    };
    const deliverablesExecutionTrace = parentlessKoshaReviewRequired
      ? {
          ...upstreamDeliverablesExecutionTrace,
          provider: null,
          modelPerDocument: {}
        }
      : upstreamDeliverablesExecutionTrace;
    const generationTrace: GenerationTrace = {
      traceId,
      askMode: aiMode,
      answer: buildFinalAnswerTrace(answerResult.trace),
      deliverables: {
        attempted: deliverablesExecutionTrace.attempted,
        provider: deliverablesExecutionTrace.provider,
        modelPerDocument: deliverablesExecutionTrace.modelPerDocument
      },
      fallbackUsed: answerResult.trace.fallbackUsed || deliverablesExecutionTrace.fallbackUsed
    };

    const enriched: AskResponse = {
      ...response,
      groundingReview: buildGroundingReview(groundingDiagnostics),
      riskSummary: parentlessKoshaReviewRequired
        ? { ...response.riskSummary, immediateActions: [] }
        : response.riskSummary,
      generationMode: aiMode,
      generationTrace,
      answer: [
        dbHarnessAnswer,
        `[기상 신호] ${weather.summary}`,
        training.recommendations.length ? `[교육 연계] ${training.recommendations[0].title} (${training.recommendations[0].fitLabel || "조건부 후보"})` : "",
        kosha.references.length ? `[KOSHA 보강] ${kosha.references[0].title} (${kosha.references[0].verified ? "공식 링크 확인" : "사전 매핑"})` : "",
        accidentCases.cases.length ? `[유사 재해사례] ${accidentCases.cases[0].title}: ${accidentCases.cases[0].preventionPoint}` : ""
      ].filter(Boolean).join("\n\n"),
      practicalPoints: dbHarnessPracticalPoints,
      externalData: {
        weather,
        training,
        koshaEducation,
        kosha,
        koshaOpenApi,
        accidentCases,
        safetyReference: {
          source: "safety-reference-catalog",
          mode: safetyReference.errorCode
            ? "fallback"
            : safetyReference.configured
              ? (safetyReference.ok ? "live" : "fallback")
              : "unconfigured",
          ...(safetyReference.errorCode ? { errorCode: safetyReference.errorCode } : {}),
          query: safetyReference.query,
          count: publicSafetyReferenceItems.length,
          totalItems: publicSafetyReferenceItems.length,
          retrievalMode: safetyReference.retrievalMode,
          vectorSearch: safetyReference.vectorSearch,
          message: safetyReference.message,
          items: publicSafetyReferenceItems.slice(0, 8).map((item) => (
            buildSafetyReferenceSurfaceItem(item, safetyReference.retrievalMode, {
              parentEvidenceReady: !isKoshaTechnicalReference(item)
                || koshaParentEvidenceReadyIds.has(item.id)
            })
          ))
        },
        safetyKnowledge: {
          source: "safety-knowledge",
          mode: "live",
          detail: `기초 지식 DB ${safetyKnowledgeMatches.length}건을 문서팩 반영 후보로 매칭했습니다.`,
          matches: safetyKnowledgeMatches.map((item) => ({
            id: item.id,
            title: item.title,
            primaryDocuments: item.primaryDocuments,
            controls: item.controls,
            sourceTitles: item.sources.map((source) => source.title),
            legalMappingTitles: item.legalMappings.map((legalItem) => legalItem.title),
            evidenceRole: item.evidenceRole,
            roleLabel: item.roleLabel,
            shortSummary: item.shortSummary,
            documentReflectionLabel: item.documentReflectionLabel
          }))
        }
      },
      // When AI body is present for a deliverable, the AI was already given the
      // citations + KOSHA refs in the prompt and instructed to weave them into
      // the body. Stacking the legacy decoration appendices on top duplicates
      // the same evidence as a 5-section policy noise block at the bottom of
      // the form (가온테크 검수에서 발견된 문제). For each deliverable, append
      // legacy appendices ONLY when we fell back to template body.
      deliverables: {
        ...baseDeliverables,
        workpackSummaryDraft: aiBodies.workpackSummaryDraft
          ? aiBodies.workpackSummaryDraft
          : `${baseDeliverables.workpackSummaryDraft}\n\n[연결 상태 요약]\n- 법령 근거: ${legalEvidenceMode === "live" ? "연결됨" : "일부 근거 보류"}\n- 기상: ${weather.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- 후속 교육: ${training.mode === "live" ? "연결됨" : "일부 근거 보류"}\n- KOSHA 자료: ${kosha.mode === "live" ? "연결됨" : "일부 근거 보류"}`,
        riskAssessmentDraft: aiBodies.riskAssessmentDraft
          ? aiBodies.riskAssessmentDraft
          : `${baseDeliverables.riskAssessmentDraft}${riskAssessmentOfficialAppendix}${outdoorHeatRiskAppendix}${riskLegalAppendix}${riskSeriousAccidentAppendix}${safetyKnowledgeAppendix}${safetyReferenceAppendix}${riskKoshaOpenApiAppendix}`,
        workPlanDraft: aiBodies.workPlanDraft
          ? aiBodies.workPlanDraft
          : stripPipelineMeta(`${baseDeliverables.workPlanDraft}${outdoorHeatRiskAppendix}${workPlanLegalAppendix}${workPlanKoshaAppendix}${safetyKnowledgeAppendix}${safetyReferenceAppendix}${workPlanKoshaOpenApiAppendix}`),
        // schema-first: AI가 셀 단위 구조로 직접 반환했으면 통과. xlsx-builder가 이걸로
        // parseSheetRows 우회하고 표 양식에 매핑.
        ...(linkedWorkPlanStructured ? { workPlanStructured: linkedWorkPlanStructured } : {}),
        ...(linkedPermitInspectionStructured ? { permitInspectionStructured: linkedPermitInspectionStructured } : {}),
        ...(aiBodies.tbmBriefingStructured
          ? { tbmBriefingStructured: aiBodies.tbmBriefingStructured }
          : deterministicTbmBriefingStructured
            ? { tbmBriefingStructured: deterministicTbmBriefingStructured }
            : {}),
        ...(aiBodies.tbmLogStructured
          ? { tbmLogStructured: aiBodies.tbmLogStructured }
          : deterministicTbmLogStructured
            ? { tbmLogStructured: deterministicTbmLogStructured }
            : {}),
        ...(aiBodies.educationRecordStructured ? { educationRecordStructured: aiBodies.educationRecordStructured } : {}),
        tbmBriefing: aiBodies.tbmBriefing
          ? aiBodies.tbmBriefing
          : stripPipelineMeta(`${baseDeliverables.tbmBriefing}${tbmQualityAppendix}${outdoorHeatTbmAppendix}${safetyReferenceAppendix}`),
        tbmLogDraft: aiBodies.tbmLogDraft
          ? aiBodies.tbmLogDraft
          : `${baseDeliverables.tbmLogDraft}${tbmQualityAppendix}`.trim(),
        // Substantive appendices (official-form guidance, heat-education content,
        // serious-accident checklist, recommended follow-up training, fit-check)
        // are concatenated BEFORE the evidence-citation appendices on purpose:
        // stripPipelineMeta() cuts from the FIRST meta header to the end of the
        // string, so anything meta-tagged must trail everything the field crew
        // actually needs to read.
        safetyEducationRecordDraft: aiBodies.safetyEducationRecordDraft
          ? aiBodies.safetyEducationRecordDraft
          : stripPipelineMeta(`${baseDeliverables.safetyEducationRecordDraft}${safetyEducationOfficialAppendix}${outdoorHeatEducationAppendix}${educationSeriousAccidentAppendix}${trainingAppendix}${koshaEducationAppendix}${trainingFitLines.length ? `\n\n[교육 적합성 확인]\n- ${trainingFitLines.join("\n- ")}` : ""}${educationLegalAppendix}${educationKoshaAppendix}${safetyKnowledgeEducationAppendix}${safetyReferenceAppendix}${accidentAppendix}${educationKoshaOpenApiAppendix}`),
        emergencyResponseDraft: aiBodies.emergencyResponseDraft
          ? aiBodies.emergencyResponseDraft
          : `${baseDeliverables.emergencyResponseDraft}${educationSeriousAccidentAppendix}${accidentAppendix}${emergencyKoshaOpenApiAppendix}`,
        photoEvidenceDraft: aiBodies.photoEvidenceDraft
          ? aiBodies.photoEvidenceDraft
          : ensurePhotoEvidenceDraft(baseDeliverables.photoEvidenceDraft, photoEvidenceAppendix),
        foreignWorkerBriefing: foreignWorkerBriefingText,
        foreignWorkerTransmission: foreignWorkerTransmissionText,
        // Reconciled against the actual body text — the static pack (or the
        // AI's own foreignWorkerLanguages claim, which we discard) can claim
        // up to 10 rich language objects while the body only ever contains
        // 3-5 language sections. Prod evidence, 2026-07: a 10-language claim
        // rendered next to a 3-language briefing / 5-language transmission.
        foreignWorkerLanguages: reconcileLanguages(foreignWorkerBriefingText, foreignWorkerTransmissionText, foreignWorkerLanguages),
        kakaoMessage: aiBodies.kakaoMessage
          ? aiBodies.kakaoMessage
          : `${baseDeliverables.kakaoMessage}${outdoorHeatMessageAppendix}\n\n[외국인 근로자 공지]\n${foreignWorkerTransmissionText.split("\n").slice(0, 8).join("\n")}`
      },
      structured: {
        riskAssessmentRows: structuredRiskRows,
        tbmRiskLinks,
        riskAssessmentValidation: {
          ok: structuredRiskRows.length > 0 && structuredRiskIssues.length === 0,
          issueCount: structuredRiskIssues.length,
          issues: structuredRiskIssues
        }
      },
      // 중대재해처벌법 시행령 제4조 증빙 매핑 라벨 (SafeClaw 2 Phase 0 프리뷰).
      // 산문 문서 필드 + 존재하는 schema-first 구조 필드를 모두 키로 넘겨
      // buildEvidenceLabels가 매핑된 것만 골라 채운다.
      evidenceLabels: buildEvidenceLabels([
        "riskAssessmentDraft",
        "workPlanDraft",
        "tbmBriefing",
        "tbmLogDraft",
        "safetyEducationRecordDraft",
        "emergencyResponseDraft",
        "photoEvidenceDraft",
        "foreignWorkerBriefing",
        "foreignWorkerTransmission",
        "kakaoMessage",
        ...(structuredRiskRows.length ? ["structuredRiskRows"] : [])
      ]),
      dbHarness: {
        packet: dbHarnessPacket,
        promptContext: dbHarnessPromptContext,
        summary: dbHarnessSummary
      },
      status: {
        ...response.status,
        lawgo: legalEvidenceMode,
        weather: weather.mode,
        work24: training.mode,
        kosha: kosha.mode,
        detail: `${response.status.detail} / 법령 근거 상태: ${legalEvidenceMode} / ${weather.detail} / ${training.detail} / ${koshaEducation.detail} / ${kosha.detail} / ${koshaOpenApi.detail} / ${accidentCases.detail} / 지식 DB 매칭 ${safetyKnowledgeMatches.length}건 / Supabase 카탈로그 매칭 ${safetyReference.count}건 (configured=${safetyReference.configured}) / structured 위험성평가 rows ${structuredRiskRows.length}건, 검증 이슈 ${structuredRiskIssues.length}건 (${structuredRiskSourceDetail}) / TBM-risk 연결 ${tbmRiskLinks.length}건 (${tbmRiskSourceDetail}) / ${tbmStructuredSourceDetail} / ${aiModeAppliedDetail}`
      },
      sourceMix
    };

    const reflectedEnriched = normalizeAskResponseText(reflectDbHarnessInDeliverables(enriched, dbHarnessPacket));
    const withMcpDetail: AskResponse = !koreanLawMcpCount ? reflectedEnriched : {
      ...reflectedEnriched,
      status: {
        ...reflectedEnriched.status,
        detail: `${reflectedEnriched.status.detail} / korean-law-mcp 근거 ${koreanLawMcpCount}건 보강`
      }
    };

    const withOntologyQa = await attachWebOntologyQa(withMcpDetail, question);
    const finalResponse = applyPhaseAResponseBoundary(
      attachQualityContract(withOntologyQa),
      options.phaseAGrounding,
    );
    const finalDeliverablesTrace = finalizeDeliverablesTrace(finalResponse, deliverablesExecutionTrace);
    return {
      ...finalResponse,
      generationTrace: {
        ...generationTrace,
        deliverables: {
          attempted: finalDeliverablesTrace.attempted,
          provider: finalDeliverablesTrace.provider,
          modelPerDocument: finalDeliverablesTrace.modelPerDocument
        },
        fallbackUsed: answerResult.trace.fallbackUsed || finalDeliverablesTrace.fallbackUsed
      }
    };
  } catch (error) {
    log.error("runAsk pipeline failed; using DB harness fallback", {
      errorType: error instanceof Error ? error.name : typeof error
    });
    const response = applyPhaseAResponseBoundary(attachDbHarnessFallback(
      buildMockAskResponse(
        question,
        mockSearchResults.slice(0, 4),
        "fallback",
        "일부 외부 연결을 확인하지 못해 규정 기반 문서팩으로 전환했습니다."
      ),
      { question, harnessMemory }
    ), options.phaseAGrounding);
    const upstreamTrace = {
      provider: "mock",
      model: null,
      fallbackUsed: true
    } as const;
    const failedDeliverables = buildFailedDeliverablesDiagnostics({
      attempted: deliverablesAttempted,
      fallbackUsed: true,
      groundingPacket: deliverablesGroundingPacket
    });
    const finalDeliverablesTrace = finalizeDeliverablesTrace(response, failedDeliverables.trace);
    return {
      ...response,
      groundingReview: buildGroundingReview(failedDeliverables.grounding),
      generationTrace: {
        traceId,
        askMode: aiMode,
        answer: buildFinalAnswerTrace(upstreamTrace),
        deliverables: {
          attempted: finalDeliverablesTrace.attempted,
          provider: finalDeliverablesTrace.provider,
          modelPerDocument: finalDeliverablesTrace.modelPerDocument
        },
        fallbackUsed: true
      }
    };
  }
}

export async function loadDetail(id: string) {
  return loadLegalDetail(id);
}
