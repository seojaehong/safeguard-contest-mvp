import type { AskResponse, PublicDataUsage, PublicDataUsageEntry, PublicDataUsagePosition } from "./types";

type ExternalDataInput = Omit<AskResponse["externalData"], "publicDataUsage">;

type BuildPublicDataUsageInput = {
  question: string;
  citations: AskResponse["citations"];
  externalData: ExternalDataInput;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatRecord(record: Record<string, string> | undefined): string[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}=${value}`);
}

function positionsFor(entry: Omit<PublicDataUsageEntry, "positions">): PublicDataUsagePosition[] {
  const positions: PublicDataUsagePosition[] = [];
  if (entry.queryOrFilters.length) positions.push("query/filter");
  if (entry.parsedFields.length) positions.push("parsed fields");
  if (entry.documentEvidence.length) positions.push("document evidence");
  if (entry.generatedSections.length) positions.push("generated sections");
  return positions;
}

function withPositions(entry: Omit<PublicDataUsageEntry, "positions">): PublicDataUsageEntry {
  return {
    ...entry,
    positions: positionsFor(entry)
  };
}

function summarizeUsage(dataset: string, sections: string[], evidence: string[]): string {
  const sectionText = sections.slice(0, 3).join(", ") || "응답 근거";
  const evidenceText = evidence.slice(0, 2).join(" / ") || "조회 조건과 파싱 필드";
  return `${dataset} 데이터는 ${evidenceText}를 근거로 ${sectionText}에 연결됩니다.`;
}

function weatherFields(externalData: ExternalDataInput): string[] {
  const weather = externalData.weather;
  return unique([
    ...Object.keys(weather.sourceFields || {}),
    ...(weather.signals || []).flatMap((signal) => Object.keys(signal.sourceFields || {})),
    "summary",
    "actions",
    weather.forecastTime ? "forecastTime" : "",
    weather.temperatureC ? "temperatureC" : "",
    weather.windSpeedMps ? "windSpeedMps" : "",
    weather.precipitationProbability ? "precipitationProbability" : ""
  ]);
}

function weatherFilters(externalData: ExternalDataInput): string[] {
  const weather = externalData.weather;
  return unique([
    ...formatRecord(weather.filters),
    ...(weather.signals || []).flatMap((signal) => formatRecord(signal.filters)),
    weather.locationLabel ? `location=${weather.locationLabel}` : ""
  ]);
}

function buildWeatherUsage(externalData: ExternalDataInput): PublicDataUsageEntry {
  const evidence = unique([
    externalData.weather.summary,
    ...(externalData.weather.signals || []).map((signal) => `${signal.endpoint}: ${signal.summary}`)
  ]).slice(0, 6);
  const sections = [
    "answer.[기상 신호]",
    "scenario.weatherNote",
    "riskAssessmentRows.weatherSignal",
    "workPlanDraft",
    "tbmBriefing",
    "kakaoMessage"
  ];
  return withPositions({
    dataset: "KMA weather",
    source: externalData.weather.source,
    mode: externalData.weather.mode,
    queryOrFilters: weatherFilters(externalData),
    parsedFields: weatherFields(externalData),
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("KMA weather", sections, evidence)
  });
}

function buildTrainingUsage(externalData: ExternalDataInput): PublicDataUsageEntry {
  const recommendations = externalData.training.recommendations;
  const filters = unique(recommendations.flatMap((item) => formatRecord(item.metadata?.filters)));
  const parsedFields = unique([
    ...recommendations.flatMap((item) => item.metadata?.usedFields || []),
    "title",
    "institution",
    "startDate",
    "endDate",
    "target",
    "fitLabel",
    "fitReason"
  ]);
  const evidence = unique(recommendations.map((item) => `${item.title}: ${item.fitLabel || "조건부 후보"} - ${item.fitReason || item.reason}`));
  const sections = ["answer.[교육 연계]", "workpackSummaryDraft", "safetyEducationRecordDraft"];
  return withPositions({
    dataset: "Work24 employer training",
    source: externalData.training.source,
    mode: externalData.training.mode,
    queryOrFilters: filters.length ? filters : ["srchNcs1=23", "srchTraProcessNm=외국인|안전", "dateRange=current+60d"],
    parsedFields,
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("Work24 employer training", sections, evidence)
  });
}

function buildKoshaEducationUsage(externalData: ExternalDataInput): PublicDataUsageEntry {
  const evidence = unique(externalData.koshaEducation.recommendations.map((item) => `${item.title}: ${item.target} / ${item.fitLabel}`));
  const sections = ["safetyEducationRecordDraft", "foreignWorkerBriefing", "foreignWorkerTransmission"];
  return withPositions({
    dataset: "KOSHA education portal",
    source: externalData.koshaEducation.source,
    mode: externalData.koshaEducation.mode,
    queryOrFilters: ["eduWayCd=01|02|03|04|05", "eduTrgtCd=question-derived", "riskKeywords=question"],
    parsedFields: ["title", "provider", "target", "educationMethod", "url", "fitLabel", "fitReason"],
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("KOSHA education portal", sections, evidence)
  });
}

function buildKoshaUsage(externalData: ExternalDataInput): PublicDataUsageEntry {
  const references = externalData.kosha.references;
  const evidence = unique(references.map((item) => `${item.agency || "KOSHA"} ${item.title}`));
  const sections = unique([
    "answer.[KOSHA 보강]",
    "workpackSummaryDraft",
    ...references.flatMap((item) => item.appliesTo || item.appliedTo || []),
    "riskAssessmentDraft",
    "workPlanDraft",
    "safetyEducationRecordDraft"
  ]);
  return withPositions({
    dataset: "KOSHA official resources",
    source: externalData.kosha.source,
    mode: externalData.kosha.mode,
    queryOrFilters: ["resourcePicker=question keywords", "urlVerification=HEAD/GET with retry"],
    parsedFields: ["title", "agency", "kind", "category", "summary", "impact", "url", "verified", "templateHints", "appliesTo"],
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("KOSHA official resources", sections, evidence)
  });
}

function buildKoshaOpenApiUsage(externalData: ExternalDataInput): PublicDataUsageEntry | null {
  const koshaOpenApi = externalData.koshaOpenApi;
  if (!koshaOpenApi) return null;
  const evidence = unique(koshaOpenApi.references.map((item) => `${item.service}: ${item.title}`));
  const sections = unique(koshaOpenApi.references.flatMap((item) => item.reflectedIn));
  return withPositions({
    dataset: "KOSHA open API",
    source: koshaOpenApi.source,
    mode: koshaOpenApi.mode,
    queryOrFilters: unique(koshaOpenApi.references.flatMap((item) => formatRecord(item.metadata?.filters))),
    parsedFields: unique(koshaOpenApi.references.flatMap((item) => item.metadata?.usedFields || [])),
    documentEvidence: evidence,
    generatedSections: sections.length ? sections : ["riskAssessmentDraft", "tbmBriefing", "emergencyResponseDraft"],
    usageSummary: summarizeUsage("KOSHA open API", sections, evidence)
  });
}

function buildAccidentUsage(externalData: ExternalDataInput): PublicDataUsageEntry {
  const evidence = unique(externalData.accidentCases.cases.map((item) => `${item.title}: ${item.preventionPoint}`));
  const sections = ["answer.[유사 재해사례]", "riskAssessmentDraft", "safetyEducationRecordDraft", "emergencyResponseDraft", "photoEvidenceDraft"];
  return withPositions({
    dataset: "KOSHA accident cases",
    source: externalData.accidentCases.source,
    mode: externalData.accidentCases.mode,
    queryOrFilters: ["riskKeywords=question", "industry/workType=question-derived"],
    parsedFields: ["title", "industry", "accidentType", "summary", "preventionPoint", "sourceUrl", "matchedReason"],
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("KOSHA accident cases", sections, evidence)
  });
}

function buildSafetyKnowledgeUsage(externalData: ExternalDataInput): PublicDataUsageEntry | null {
  const safetyKnowledge = externalData.safetyKnowledge;
  if (!safetyKnowledge) return null;
  const evidence = unique(safetyKnowledge.matches.map((item) => `${item.title}: ${item.documentReflectionLabel || item.roleLabel || "문서 반영 후보"}`));
  const sections = unique([
    ...safetyKnowledge.matches.flatMap((item) => item.primaryDocuments),
    "riskAssessmentDraft",
    "safetyEducationRecordDraft"
  ]);
  return withPositions({
    dataset: "Safety knowledge DB",
    source: safetyKnowledge.source,
    mode: safetyKnowledge.mode,
    queryOrFilters: ["matchSafetyKnowledge(question)", "limit=4"],
    parsedFields: ["id", "title", "primaryDocuments", "controls", "sourceTitles", "legalMappingTitles", "evidenceRole", "documentReflectionLabel"],
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("Safety knowledge DB", sections, evidence)
  });
}

function buildSafetyReferenceUsage(externalData: ExternalDataInput): PublicDataUsageEntry | null {
  const safetyReference = externalData.safetyReference;
  if (!safetyReference) return null;
  const evidence = unique(safetyReference.items.map((item) => `${item.title}: ${item.evidenceRoleLabel || "supporting"}`));
  const sections = unique([
    ...safetyReference.items.flatMap((item) => item.primaryDocuments),
    "riskAssessmentDraft",
    "workPlanDraft",
    "tbmBriefing",
    "safetyEducationRecordDraft"
  ]);
  return withPositions({
    dataset: "Safety reference catalog",
    source: safetyReference.source,
    mode: safetyReference.mode,
    queryOrFilters: [`query=${safetyReference.query}`, "itemType=technical-support-regulation|technical-guideline|general", `count=${safetyReference.count}`],
    parsedFields: ["id", "itemType", "title", "shortSummary", "primaryDocuments", "controls", "evidenceRoleLabel"],
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("Safety reference catalog", sections, evidence)
  });
}

function buildLegalUsage(input: BuildPublicDataUsageInput): PublicDataUsageEntry {
  const evidence = unique(input.citations.map((item) => `${item.sourceLabel}: ${item.title}`));
  const sections = ["answer", "citations", "riskAssessmentDraft", "workPlanDraft", "safetyEducationRecordDraft", "photoEvidenceDraft"];
  return withPositions({
    dataset: "Legal evidence",
    source: "lawgo/korean-law-mcp",
    mode: input.citations.some((item) => item.sourceSystem === "lawgo" || item.sourceSystem === "korean-law-mcp") ? "live" : "fallback",
    queryOrFilters: unique([
      `query=${input.question}`,
      ...input.citations.flatMap((item) => formatRecord(item.filters))
    ]),
    parsedFields: unique([
      "title",
      "summary",
      "citation",
      "sourceLabel",
      ...input.citations.flatMap((item) => Object.keys(item.sourceFields || {}))
    ]),
    documentEvidence: evidence,
    generatedSections: sections,
    usageSummary: summarizeUsage("Legal evidence", sections, evidence)
  });
}

export function buildPublicDataUsage(input: BuildPublicDataUsageInput): PublicDataUsage {
  const entries = [
    buildLegalUsage(input),
    buildWeatherUsage(input.externalData),
    buildTrainingUsage(input.externalData),
    buildKoshaEducationUsage(input.externalData),
    buildKoshaUsage(input.externalData),
    buildKoshaOpenApiUsage(input.externalData),
    buildAccidentUsage(input.externalData),
    buildSafetyKnowledgeUsage(input.externalData),
    buildSafetyReferenceUsage(input.externalData)
  ].filter((entry): entry is PublicDataUsageEntry => entry !== null);

  const liveCount = entries.filter((entry) => entry.mode === "live").length;
  return {
    summary: `공공/공식 데이터셋 ${entries.length}개 중 live ${liveCount}개를 query/filter, parsed fields, document evidence, generated sections 기준으로 추적했습니다.`,
    entries
  };
}
