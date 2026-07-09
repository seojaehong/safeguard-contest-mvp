import type { AskResponse, QualityContract, QualityContractItem, QualityContractStatus } from "./types";

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

  const contract = harness.packet.generationContract;
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
  return {
    key: "dbHarness",
    label: "DB 하네스 계약",
    status: hasEvidence && missingCount === 0 && coveredDocuments === requiredDocuments ? "ready" : hasEvidence ? "degraded" : "blocked",
    detail: hasEvidence
      ? `DB 근거 ${harness.summary.directEvidence + harness.summary.sifCases + harness.summary.supportingEvidence}건을 고정했고, 필수 문서 ${coveredDocuments}/${requiredDocuments}종을 하네스가 커버했습니다.`
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

export function buildQualityContract(response: AskResponse, generatedAt = new Date().toISOString()): QualityContract {
  const items = [
    modeItem(response),
    ontologyItem(response),
    evidenceItem(response),
    structuredItem(response),
    dbHarnessItem(response),
    persistenceItem(response)
  ];
  const modes = integrationModes(response);
  const overall = worstStatus(items);
  const structuredRequiredKeys = requiredStructuredKeys(response);
  const ontology = items.find((item) => item.key === "ontology") ?? ontologyItem(response);
  const evidence = items.find((item) => item.key === "evidence") ?? evidenceItem(response);
  const structured = items.find((item) => item.key === "structured") ?? structuredItem(response);
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
    dbHarness: {
      status: dbHarness.status,
      mode: response.dbHarness?.packet.mode,
      llmRole: response.dbHarness?.packet.generationContract.llmRole,
      llmOutputScope: response.dbHarness?.packet.generationContract.llmOutputScope,
      evidenceAuthority: response.dbHarness?.packet.generationContract.evidenceAuthority,
      providerRetryScope: response.dbHarness?.packet.generationContract.providerRetryScope,
      fallbackChainAllowed: response.dbHarness?.packet.generationContract.fallbackChainAllowed,
      genericProseSubstitutionAllowed: response.dbHarness?.packet.generationContract.genericProseSubstitutionAllowed,
      missingEvidencePolicy: response.dbHarness?.packet.generationContract.missingEvidencePolicy,
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
