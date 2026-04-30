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
