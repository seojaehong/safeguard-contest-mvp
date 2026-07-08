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
      detail: "주요 생성·근거 경로가 live 모드입니다."
    };
  }

  const onlyDemo = response.mode === "mock" && Object.values(modes).every((mode) => mode === "mock" || mode === "fallback" || mode === "unavailable");
  return {
    key: "fallback",
    label: "실시간 근거",
    status: onlyDemo ? "blocked" : "degraded",
    detail: `${fallbackEntries.map(([key, mode]) => `${key}:${mode}`).join(", ")} 경로가 live가 아닙니다.`
  };
}

function ontologyItem(response: AskResponse): QualityContractItem {
  const matches = response.externalData.safetyKnowledge?.matches ?? [];
  if (matches.length > 0) {
    return {
      key: "ontology",
      label: "온톨로지 매칭",
      status: "ready",
      detail: `작업·위험·조치 온톨로지 ${matches.length}건이 문서팩 후보로 연결됐습니다.`
    };
  }

  return {
    key: "ontology",
    label: "온톨로지 매칭",
    status: "degraded",
    detail: "작업·위험·조치 온톨로지 매칭이 없어 QA 검수 우선순위를 보강해야 합니다."
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
  const readyCount = REQUIRED_STRUCTURED_KEYS.filter((key) => readyFlags[key]).length;
  if (readyCount === REQUIRED_STRUCTURED_KEYS.length) {
    return {
      key: "structured",
      label: "하네스 구조화",
      status: "ready",
      detail: `필수 구조화 산출물 ${readyCount}/${REQUIRED_STRUCTURED_KEYS.length}종이 준비됐습니다.`
    };
  }

  return {
    key: "structured",
    label: "하네스 구조화",
    status: readyCount === 0 ? "blocked" : "degraded",
    detail: `필수 구조화 산출물 ${readyCount}/${REQUIRED_STRUCTURED_KEYS.length}종만 준비됐습니다. 산문 fallback을 확인하세요.`
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
    persistenceItem(response)
  ];
  const modes = integrationModes(response);
  const overall = worstStatus(items);
  const ontology = items.find((item) => item.key === "ontology") ?? ontologyItem(response);
  const evidence = items.find((item) => item.key === "evidence") ?? evidenceItem(response);
  const structured = items.find((item) => item.key === "structured") ?? structuredItem(response);
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
      readyCount: REQUIRED_STRUCTURED_KEYS.filter((key) => {
        if (key === "riskAssessmentRows") {
          return Boolean(response.structured?.riskAssessmentRows.length && response.structured.riskAssessmentValidation.ok);
        }
        return Boolean(response.deliverables[key]);
      }).length,
      requiredCount: REQUIRED_STRUCTURED_KEYS.length,
      detail: structured.detail
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
