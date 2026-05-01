import hazards from "@/data/safety-knowledge/hazards.json";
import legalMap from "@/data/safety-knowledge/legal-map.json";
import resources from "@/data/safety-knowledge/kosha-resources.json";
import templates from "@/data/safety-knowledge/templates.json";

export type SafetyKnowledgeHazard = {
  id: string;
  title: string;
  keywords: string[];
  primaryDocuments: string[];
  controls: string[];
  sourceIds: string[];
  liveEvidence?: Array<{
    title: string;
    summary: string;
    sourceUrl: string;
  }>;
};

export type SafetyKnowledgeSource = {
  id: string;
  agency: string;
  title: string;
  sourceType: string;
  url: string;
  appliesTo: string[];
  summary: string;
};

export type SafetyKnowledgeLegalMap = {
  id: string;
  sourceId: string;
  title: string;
  appliesTo: string[];
  plainLanguage: string;
  caution: string;
};

export type SafetyKnowledgeTemplate = {
  id: string;
  title: string;
  requiredSections: string[];
  reflectedSources: string[];
};

export type SafetyKnowledgeMatch = {
  id: string;
  title: string;
  primaryDocuments: string[];
  controls: string[];
  sources: SafetyKnowledgeSource[];
  legalMappings: SafetyKnowledgeLegalMap[];
  score: number;
};

export type KnowledgeRawEvent = {
  source: "kma" | "lawgo" | "work24" | "kosha" | "kosha-openapi" | "kosha-accident" | "manual";
  sourceId: string;
  capturedAt: string;
  title: string;
  url?: string;
  payload: Record<string, unknown>;
  relatedHazardIds: string[];
  reflectedDocuments: string[];
};

export type KnowledgeRegenerationBundle = {
  question: string;
  matchedHazards: SafetyKnowledgeMatch[];
  templates: SafetyKnowledgeTemplate[];
  rawEvents: KnowledgeRawEvent[];
  aiInstruction: string;
  storagePolicy: {
    mode: "stateless" | "persistent-ready";
    message: string;
  };
};

const typedHazards = hazards as SafetyKnowledgeHazard[];
const typedResources = resources as SafetyKnowledgeSource[];
const typedLegalMap = legalMap as SafetyKnowledgeLegalMap[];
const typedTemplates = templates as SafetyKnowledgeTemplate[];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ");
}

export function getSafetyKnowledgeSources() {
  return typedResources;
}

export function getSafetyKnowledgeTemplates() {
  return typedTemplates;
}

export function getSafetyKnowledgeLegalMap() {
  return typedLegalMap;
}

export function findSafetyKnowledgeHazards(question: string, limit = 4) {
  const normalized = normalize(question);
  return typedHazards
    .map((hazard) => ({
      hazard,
      score: hazard.keywords.reduce((sum, keyword) => (
        normalized.includes(normalize(keyword)) ? sum + 1 : sum
      ), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.hazard);
}

export function getSafetyKnowledgeSourceMap() {
  return new Map(typedResources.map((source) => [source.id, source]));
}

export function matchSafetyKnowledge(question: string, limit = 4): SafetyKnowledgeMatch[] {
  const normalized = normalize(question);
  const sourceMap = getSafetyKnowledgeSourceMap();

  return typedHazards
    .map((hazard) => {
      const keywordScore = hazard.keywords.reduce((sum, keyword) => (
        normalized.includes(normalize(keyword)) ? sum + 1 : sum
      ), 0);
      const documentScore = hazard.primaryDocuments.reduce((sum, documentName) => (
        normalized.includes(normalize(documentName)) ? sum + 1 : sum
      ), 0);
      return {
        hazard,
        score: keywordScore + documentScore
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ hazard, score }) => {
      const sourceIds = new Set(hazard.sourceIds);
      const sources = hazard.sourceIds
        .map((sourceId) => sourceMap.get(sourceId))
        .filter((source): source is SafetyKnowledgeSource => Boolean(source));
      const legalMappings = typedLegalMap.filter((item) => sourceIds.has(item.sourceId));
      return {
        id: hazard.id,
        title: hazard.title,
        primaryDocuments: hazard.primaryDocuments,
        controls: hazard.controls,
        sources,
        legalMappings,
        score
      };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArrayField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function readPayloadField(record: Record<string, unknown>) {
  const value = record.payload;
  return isRecord(value) ? value : {};
}

export function normalizeKnowledgeRawEvent(input: unknown): { ok: true; event: KnowledgeRawEvent } | { ok: false; errors: string[] } {
  if (!isRecord(input)) {
    return { ok: false, errors: ["request body must be an object"] };
  }

  const validSources: KnowledgeRawEvent["source"][] = ["kma", "lawgo", "work24", "kosha", "kosha-openapi", "kosha-accident", "manual"];
  const source = readStringField(input, "source");
  const sourceId = readStringField(input, "sourceId");
  const title = readStringField(input, "title");
  const capturedAt = readOptionalStringField(input, "capturedAt") || new Date().toISOString();
  const relatedHazardIds = readStringArrayField(input, "relatedHazardIds");
  const reflectedDocuments = readStringArrayField(input, "reflectedDocuments");
  const errors: string[] = [];

  if (!validSources.includes(source as KnowledgeRawEvent["source"])) {
    errors.push("source must be one of kma, lawgo, work24, kosha, kosha-openapi, kosha-accident, manual");
  }
  if (!sourceId) errors.push("sourceId is required");
  if (!title) errors.push("title is required");
  if (Number.isNaN(Date.parse(capturedAt))) errors.push("capturedAt must be an ISO date string");
  if (!reflectedDocuments.length) errors.push("reflectedDocuments must include at least one document name");

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    event: {
      source: source as KnowledgeRawEvent["source"],
      sourceId,
      capturedAt,
      title,
      url: readOptionalStringField(input, "url"),
      payload: readPayloadField(input),
      relatedHazardIds,
      reflectedDocuments
    }
  };
}

export function buildKnowledgeRegenerationBundle(
  question: string,
  rawEvents: KnowledgeRawEvent[] = [],
  limit = 4
): KnowledgeRegenerationBundle {
  const matchedHazards = matchSafetyKnowledge(question, limit);
  const reflectedTemplateIds = new Set(
    matchedHazards.flatMap((hazard) => hazard.primaryDocuments)
  );
  const selectedTemplates = typedTemplates.filter((template) => (
    reflectedTemplateIds.size === 0
      ? true
      : template.requiredSections.some((section) => Array.from(reflectedTemplateIds).some((documentName) => documentName.includes(section) || section.includes(documentName)))
  ));

  return {
    question,
    matchedHazards,
    templates: selectedTemplates.length ? selectedTemplates : typedTemplates.slice(0, 4),
    rawEvents,
    aiInstruction: [
      "Use the seed safety knowledge, raw source events, and matched hazards to regenerate a conservative Korean safety workpack draft.",
      "Do not claim legal effect. Keep official-source citations attached to every risk, TBM, and education recommendation.",
      "If raw events conflict with the seed database, preserve the raw event and mark it as requiring human review."
    ].join(" "),
    storagePolicy: {
      mode: "stateless",
      message: "현재 API는 원본 이벤트를 검증하고 재생성 번들을 반환합니다. 영구 누적은 Supabase migration 승인 후 DailyEntry 또는 knowledge_events 테이블에 저장합니다."
    }
  };
}
