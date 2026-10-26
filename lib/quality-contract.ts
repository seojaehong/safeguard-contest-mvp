import type { AskResponse, QualityContract, QualityContractItem, QualityContractStatus } from "./types";
import {
  auditAskDeliverables,
  auditTextDocument,
  summarizeIntegrityItems,
  type IntegritySummary,
  type TextDocumentAudit
} from "./deliverable-integrity-policy";
import {
  auditWorkPlanStructuredForm,
  buildPermitRequiredTerms,
  buildWorkPlanLegalForm,
  buildWorkPlanRequiredTerms,
  resolvePermitCategory
} from "./permit-workplan-forms";

const REQUIRED_EVIDENCE_KEYS = [
  "riskAssessmentDraft",
  "workPlanDraft",
  "tbmBriefing",
  "tbmLogDraft",
  "safetyEducationRecordDraft",
  "emergencyResponseDraft",
  "photoEvidenceDraft"
] as const;

const REQUIRED_STRUCTURED_KEYS = [
  "riskAssessmentRows",
  "workPlanStructured",
  "tbmBriefingStructured",
  "tbmLogStructured"
] as const;

const ENHANCED_REQUIRED_STRUCTURED_KEYS = [
  "riskAssessmentRows",
  "tbmBriefingStructured",
  "tbmLogStructured"
] as const;

const CORE_DELIVERABLE_INTEGRITY_KEYS = [
  "riskAssessmentDraft",
  "tbmBriefing",
  "tbmLogDraft"
] as const;

type StructuredKey = typeof REQUIRED_STRUCTURED_KEYS[number];

function requiredStructuredKeys(response: AskResponse): readonly StructuredKey[] {
  return response.generationMode === "enhanced" ? ENHANCED_REQUIRED_STRUCTURED_KEYS : REQUIRED_STRUCTURED_KEYS;
}

function countReady(items: QualityContractItem[]) {
  return items.filter((item) => item.status === "ready").length;
}

function worstStatus(items: QualityContractItem[]): Exclude<QualityContractStatus, "pending"> {
  if (items.some((item) => item.status === "blocked")) return "blocked";
  if (items.some((item) => item.status === "degraded" || item.status === "pending")) return "degraded";
  return "ready";
}

function integrationModes(response: AskResponse): Record<string, string> {
  return {
    answer: response.mode,
    lawgo: response.status.lawgo,
    ai: response.status.ai,
    weather: response.status.weather,
    work24: response.status.work24,
    kosha: response.status.kosha,
    koshaEducation: response.externalData.koshaEducation.mode,
    accidentCases: response.externalData.accidentCases.mode,
    safetyKnowledge: response.externalData.safetyKnowledge?.mode ?? "unavailable",
    safetyReference: response.externalData.safetyReference?.mode ?? "unavailable"
  };
}

function hasNonLiveMode(mode: string) {
  return mode === "mock" || mode === "fallback" || mode === "unconfigured" || mode === "unavailable";
}

function modeItem(response: AskResponse): QualityContractItem {
  const modes = integrationModes(response);
  const fallbackEntries = Object.entries(modes).filter(([, mode]) => hasNonLiveMode(mode));
  if (!fallbackEntries.length) {
    return {
      key: "fallback",
      label: "실시간 근거",
      status: "ready",
      detail: "주요 근거 조회가 실시간으로 연결됐습니다."
    };
  }

  const onlyDemo = response.mode === "mock" && Object.values(modes).every((mode) => mode === "mock" || mode === "fallback" || mode === "unavailable");
  return {
    key: "fallback",
    label: "실시간 근거",
    status: onlyDemo ? "blocked" : "degraded",
    detail: `${fallbackEntries.length}개 근거 경로는 보조 자료 기준으로 표시됩니다. 전파 전 원문 확인을 권장합니다.`
  };
}

function ontologyItem(response: AskResponse): QualityContractItem {
  const matches = response.externalData.safetyKnowledge?.matches ?? [];
  const qa = response.ontologyQa?.result;
  if (qa?.reviewable) {
    const missingControlCount = qa.missing.controls.length;
    const status: QualityContractStatus =
      qa.verdict === "통과" ? "ready" : qa.verdict === "보완 권장" ? "degraded" : "blocked";
    return {
      key: "ontology",
      label: "안전조치 검수",
      status,
      detail:
        status === "ready"
          ? `${response.ontologyQa?.reviewTask ?? qa.task} 작업의 필수 안전조치가 문서팩에 반영됐습니다.`
          : `${response.ontologyQa?.reviewTask ?? qa.task} 작업에서 보완할 안전조치 ${missingControlCount}건이 남아 있습니다.`
    };
  }

  if (qa && !qa.reviewable) {
    return {
      key: "ontology",
      label: "안전조치 검수",
      status: "degraded",
      detail: qa.message
    };
  }

  if (matches.length > 0) {
    return {
      key: "ontology",
      label: "작업 이력 매칭",
      status: "ready",
      detail: `유사 작업·위험·조치 후보 ${matches.length}건이 문서팩에 연결됐습니다.`
    };
  }

  return {
    key: "ontology",
    label: "작업 이력 매칭",
    status: "degraded",
    detail: "유사 작업 이력이 아직 부족해 전파 전 안전조치 확인이 필요합니다."
  };
}

function evidenceItem(response: AskResponse): QualityContractItem {
  const mappedCount = REQUIRED_EVIDENCE_KEYS.filter((key) => response.evidenceLabels?.[key]).length;
  if (mappedCount === REQUIRED_EVIDENCE_KEYS.length) {
    return {
      key: "evidence",
      label: "증빙 매핑",
      status: "ready",
      detail: `필수 문서 ${mappedCount}/${REQUIRED_EVIDENCE_KEYS.length}종이 시행령 제4조 증빙 라벨에 연결됐습니다.`
    };
  }

  return {
    key: "evidence",
    label: "증빙 매핑",
    status: mappedCount === 0 ? "blocked" : "degraded",
    detail: `필수 문서 ${mappedCount}/${REQUIRED_EVIDENCE_KEYS.length}종만 증빙 라벨에 연결됐습니다.`
  };
}

function structuredItem(response: AskResponse): QualityContractItem {
  const readyFlags = {
    riskAssessmentRows: Boolean(response.structured?.riskAssessmentRows.length && response.structured.riskAssessmentValidation.ok),
    workPlanStructured: Boolean(response.deliverables.workPlanStructured),
    tbmBriefingStructured: Boolean(response.deliverables.tbmBriefingStructured),
    tbmLogStructured: Boolean(response.deliverables.tbmLogStructured)
  };
  const requiredKeys = requiredStructuredKeys(response);
  const readyCount = requiredKeys.filter((key) => readyFlags[key]).length;
  if (readyCount === requiredKeys.length) {
    return {
      key: "structured",
      label: "문서 구조 검수",
      status: "ready",
      detail: `필수 구조화 산출물 ${readyCount}/${requiredKeys.length}종이 준비됐습니다.`
    };
  }

  return {
    key: "structured",
    label: "문서 구조 검수",
    status: readyCount === 0 ? "blocked" : "degraded",
    detail: `필수 구조화 산출물 ${readyCount}/${requiredKeys.length}종이 준비됐습니다. 나머지는 기본 문서 형식으로 보완됐습니다.`
  };
}

// 허가서는 허가구분별 필수 칸을 본다(WP-14). 허가구분은 작업 분류에서 정한 값이고, 본문의 「허가구분:」 줄이
// 그 값과 다르거나 밀폐공간 측정·감시인 칸이 없으면 막힌다. 작업 유형 보류 응답은 허가서를 만들지 않으므로 보지 않는다.
// 작업계획서는 별표4 해당 호의 필수 칸을 본다(WP-06). 허가서 게이트(WP-14)와 같은 방식 — 작업 분류에서 만든 양식
// (buildWorkPlanLegalForm)의 섹션 제목·항목 라벨이 본문에 없으면 막고, full 모드 구조화본(workPlanStructured)도 같은 칸을 가져야 한다.
// 값이 비어 있는 칸(「(현장 기재)」)은 막지 않는다. 작업 유형 보류 응답은 양식을 만들 수 없으므로 보지 않는다.
const WORK_PLAN_GATE_KEYS: ReadonlySet<string> = new Set(["workPlanDraft", "workPlanStructured"]);

function auditCoreDeliverables(response: AskResponse): TextDocumentAudit[] {
  const classification = response.scenario?.taskClassification;
  const classified = classification?.status === "classified";
  const permitCategory = resolvePermitCategory(classification?.taskId, response.question);
  const permitText = response.deliverables.workPermitDraft;
  const auditPermit = permitCategory !== null
    && classified
    && typeof permitText === "string"
    && permitText.length > 0;
  const workPlanText = response.deliverables.workPlanDraft;
  const workPlanInput = classified && classification?.taskId && typeof workPlanText === "string" && workPlanText.length > 0
    ? { taskId: classification.taskId, question: response.question, workerCount: response.scenario.workerCount }
    : null;
  const workPlanForm = workPlanInput ? buildWorkPlanLegalForm(workPlanInput) : null;
  const items = auditAskDeliverables({
    deliverables: response.deliverables,
    requiredKeys: auditPermit ? [...CORE_DELIVERABLE_INTEGRITY_KEYS, "workPermitDraft"] : CORE_DELIVERABLE_INTEGRITY_KEYS,
    ...(auditPermit && permitCategory ? { requiredTermsByKey: { workPermitDraft: buildPermitRequiredTerms(permitCategory) } } : {})
  });
  if (workPlanInput && workPlanForm && typeof workPlanText === "string") {
    // 계획서는 「칸 존재」(필수어)만 본다. 일반 감사(placeholder·길이)는 지금까지 계획서에 돌지 않았고,
    // 운영 본문은 부록 체인이 붙어 「현장 확인 필요」가 여러 번 있을 수 있어 같이 걸면 멀쩡한 응답이 막힌다.
    const textAudit = auditTextDocument({
      key: "workPlanDraft",
      title: "workPlanDraft",
      text: workPlanText,
      requiredTerms: buildWorkPlanRequiredTerms(workPlanInput, workPlanForm)
    });
    const missingTerms = textAudit.missingRequiredTerms;
    items.push({
      ...textAudit,
      verdict: missingTerms.length ? "blocked" : "pass",
      issues: missingTerms.length ? [{ code: "missing_required_term", detail: `법정 칸 누락: ${missingTerms.join(", ")}` }] : []
    });
  }
  if (workPlanForm && response.deliverables.workPlanStructured) {
    const structuredAudit = auditWorkPlanStructuredForm(response.deliverables.workPlanStructured, workPlanForm);
    if (structuredAudit.verdict === "blocked") {
      items.push({
        key: "workPlanStructured",
        title: "workPlanStructured",
        verdict: "blocked",
        charCount: 0,
        placeholderCount: 0,
        missingRequiredTerms: structuredAudit.missing,
        missingScenarioTerms: [],
        issues: [{ code: "missing_required_term", detail: `법정 칸 누락: ${structuredAudit.missing.join(", ")}` }]
      });
    }
  }
  return items;
}

function integrityDetail(summary: IntegritySummary, blockedKeys: string[]): string {
  if (summary.verdict === "pass") {
    return `핵심 문서 ${summary.passCount}/${summary.totalCount}종의 본문 placeholder와 필수 문구를 확인했습니다.`;
  }
  const base = `핵심 문서 ${summary.blockedCount}/${summary.totalCount}종 보완 필요: ${blockedKeys.join(", ")}`;
  return blockedKeys.some((key) => WORK_PLAN_GATE_KEYS.has(key))
    ? `${base} — 작업계획서 별표4 법정 칸 누락, 현장 확인 필요`
    : base;
}

function deliverableIntegrityItem(response: AskResponse): QualityContractItem {
  const items = auditCoreDeliverables(response);
  const summary = summarizeIntegrityItems(items);
  const blockedKeys = items.filter((item) => item.verdict === "blocked").map((item) => item.key);
  return {
    key: "integrity",
    label: "문서 본문 검수",
    status: summary.verdict === "pass" ? "ready" : "blocked",
    detail: integrityDetail(summary, blockedKeys)
  };
}

function deliverableIntegritySummary(response: AskResponse) {
  const items = auditCoreDeliverables(response);
  const summary = summarizeIntegrityItems(items);
  const blockedKeys = items.filter((item) => item.verdict === "blocked").map((item) => item.key);
  return {
    status: summary.verdict === "pass" ? "ready" as const : "blocked" as const,
    checkedCount: summary.totalCount,
    blockedCount: summary.blockedCount,
    blockedKeys,
    detail: integrityDetail(summary, blockedKeys)
  };
}

function dbHarnessItem(response: AskResponse): QualityContractItem {
  const harness = response.dbHarness;
  if (!harness) {
    return {
      key: "dbHarness",
      label: "DB 하네스 계약",
      status: "blocked",
      detail: "DB가 근거를 먼저 고정한 생성 계약이 응답에 없습니다."
    };
  }

  const contract = harness.packet?.generationContract;
  if (!contract) {
    return {
      key: "dbHarness",
      label: "DB 하네스 계약",
      status: "blocked",
      detail: "DB 하네스 생성 계약이 응답에 없습니다."
    };
  }
  const contractReady =
    harness.packet.mode === "db_harness_first" &&
    contract.llmRole === "naturalize_only" &&
    contract.llmOutputScope === "rewrite_fixed_evidence_only" &&
    contract.evidenceAuthority === "db_harness" &&
    contract.providerRetryScope === "naturalization_retry_only" &&
    contract.fallbackChainAllowed === false &&
    contract.genericProseSubstitutionAllowed === false &&
    contract.missingEvidencePolicy === "surface_review_required";
  if (!contractReady) {
    return {
      key: "dbHarness",
      label: "DB 하네스 계약",
      status: "blocked",
      detail: "생성 계약이 DB 우선·문장화 전용 원칙과 맞지 않습니다."
    };
  }

  const hasEvidence = harness.summary.directEvidence + harness.summary.sifCases + harness.summary.supportingEvidence > 0;
  const missingCount = harness.summary.missingEvidence.length;
  const coveredDocuments = harness.summary.documentCoverage.filter((item) => item.covered).length;
  const requiredDocuments = harness.summary.documentCoverage.length;
  const ontologyReady = harness.summary.ontologyStatus === "ready";
  return {
    key: "dbHarness",
    label: "DB 하네스 계약",
    status: hasEvidence && missingCount === 0 && coveredDocuments === requiredDocuments && ontologyReady ? "ready" : hasEvidence ? "degraded" : "blocked",
    detail: hasEvidence && missingCount === 0 && ontologyReady
      ? `DB 근거 ${harness.summary.directEvidence + harness.summary.sifCases + harness.summary.supportingEvidence}건을 고정했고, 필수 문서 ${coveredDocuments}/${requiredDocuments}종을 하네스가 커버했습니다.`
      : hasEvidence
        ? `DB 근거는 고정됐지만 ${harness.summary.missingEvidence.slice(0, 3).join(", ") || "하네스 보완 항목"} 확인이 남았습니다.`
        : "고정된 DB 근거가 없어 전파 전 근거 매칭이 필요합니다."
  };
}

function persistenceItem(response: AskResponse): QualityContractItem {
  const hasWorkpackBody = Boolean(response.deliverables.workpackSummaryDraft && response.deliverables.riskAssessmentDraft);
  const hasEvidenceSummary = Boolean(response.evidenceLabels && Object.keys(response.evidenceLabels).length > 0);
  if (hasWorkpackBody && hasEvidenceSummary) {
    return {
      key: "persistence",
      label: "DB 저장 준비",
      status: "ready",
      detail: "문서팩 본문과 증빙 요약이 있어 관리자 로그인 후 서버 저장할 수 있습니다."
    };
  }

  return {
    key: "persistence",
    label: "DB 저장 준비",
    status: "blocked",
    detail: "문서팩 본문 또는 증빙 요약이 부족해 서버 저장 전 보완이 필요합니다."
  };
}

// 작업 유형을 판정하지 못한 응답만 항목을 더한다(분류된 응답의 항목 수는 그대로).
function taskClassificationItems(response: AskResponse): QualityContractItem[] {
  const classification = response.scenario?.taskClassification;
  if (classification?.status !== "review_required") return [];
  return [{
    key: "taskClassification",
    label: "작업 유형 확인",
    status: "blocked",
    detail: "작업 유형 확인 필요 — 입력에서 작업 유형을 판정하지 못해 문서 생성을 보류했습니다. 작업 종류와 사용 장비를 적어 다시 생성하세요."
  }];
}

export function buildQualityContract(response: AskResponse, generatedAt = new Date().toISOString()): QualityContract {
  const items = [
    ...taskClassificationItems(response),
    modeItem(response),
    ontologyItem(response),
    evidenceItem(response),
    structuredItem(response),
    deliverableIntegrityItem(response),
    dbHarnessItem(response),
    persistenceItem(response)
  ];
  const modes = integrationModes(response);
  const overall = worstStatus(items);
  const structuredRequiredKeys = requiredStructuredKeys(response);
  const ontology = items.find((item) => item.key === "ontology") ?? ontologyItem(response);
  const evidence = items.find((item) => item.key === "evidence") ?? evidenceItem(response);
  const structured = items.find((item) => item.key === "structured") ?? structuredItem(response);
  const integrity = deliverableIntegritySummary(response);
  const dbHarness = items.find((item) => item.key === "dbHarness") ?? dbHarnessItem(response);
  const persistence = items.find((item) => item.key === "persistence") ?? persistenceItem(response);
  const readyCount = countReady(items);

  return {
    overall,
    summary:
      overall === "ready"
        ? "실시간 근거, 온톨로지, 증빙, 구조화 산출물이 통합 준비 상태입니다."
        : `통합 루프 ${readyCount}/${items.length}개 항목만 준비됐습니다. 보완 항목을 먼저 확인하세요.`,
    generatedAt,
    items,
    fallback: {
      hasFallback: Object.values(modes).some(hasNonLiveMode),
      modes
    },
    ontology: {
      status: ontology.status,
      matchCount: response.externalData.safetyKnowledge?.matches.length ?? 0,
      reviewTask: response.ontologyQa?.reviewTask,
      verdict: response.ontologyQa?.result.reviewable ? response.ontologyQa.result.verdict : undefined,
      missingControlCount: response.ontologyQa?.result.reviewable ? response.ontologyQa.result.missing.controls.length : undefined,
      detail: ontology.detail
    },
    evidence: {
      status: evidence.status,
      mappedCount: REQUIRED_EVIDENCE_KEYS.filter((key) => response.evidenceLabels?.[key]).length,
      requiredCount: REQUIRED_EVIDENCE_KEYS.length,
      detail: evidence.detail
    },
    structured: {
      status: structured.status,
      readyCount: structuredRequiredKeys.filter((key) => {
        if (key === "riskAssessmentRows") {
          return Boolean(response.structured?.riskAssessmentRows.length && response.structured.riskAssessmentValidation.ok);
        }
        return Boolean(response.deliverables[key]);
      }).length,
      requiredCount: structuredRequiredKeys.length,
      detail: structured.detail
    },
    integrity,
    dbHarness: {
      status: dbHarness.status,
      mode: response.dbHarness?.packet.mode,
      llmRole: response.dbHarness?.packet.generationContract?.llmRole,
      llmOutputScope: response.dbHarness?.packet.generationContract?.llmOutputScope,
      evidenceAuthority: response.dbHarness?.packet.generationContract?.evidenceAuthority,
      providerRetryScope: response.dbHarness?.packet.generationContract?.providerRetryScope,
      fallbackChainAllowed: response.dbHarness?.packet.generationContract?.fallbackChainAllowed,
      genericProseSubstitutionAllowed: response.dbHarness?.packet.generationContract?.genericProseSubstitutionAllowed,
      missingEvidencePolicy: response.dbHarness?.packet.generationContract?.missingEvidencePolicy,
      directEvidenceCount: response.dbHarness?.summary.directEvidence ?? 0,
      sifCaseCount: response.dbHarness?.summary.sifCases ?? 0,
      supportingEvidenceCount: response.dbHarness?.summary.supportingEvidence ?? 0,
      retrievalContract: response.dbHarness?.summary.retrievalContract,
      missingEvidence: response.dbHarness?.summary.missingEvidence ?? [],
      documentCoverage: response.dbHarness?.summary.documentCoverage ?? [],
      detail: dbHarness.detail
    },
    persistence: {
      status: persistence.status,
      requiresLogin: true,
      detail: persistence.detail
    }
  };
}

export function attachQualityContract<T extends AskResponse>(response: T, generatedAt?: string): T {
  return {
    ...response,
    qualityContract: buildQualityContract(response, generatedAt)
  };
}
