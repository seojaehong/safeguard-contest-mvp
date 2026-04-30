import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const outDir = path.join(root, "evaluation", "knowledge-runtime");

async function readJson(relativePath) {
  const raw = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(raw);
}

function normalize(value) {
  return String(value).toLowerCase().replace(/\s+/g, " ");
}

function matchHazards(hazards, question) {
  const normalized = normalize(question);
  return hazards
    .map((hazard) => ({
      id: hazard.id,
      title: hazard.title,
      score: hazard.keywords.reduce((sum, keyword) => (
        normalized.includes(normalize(keyword)) ? sum + 1 : sum
      ), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function validateRawEvent(event) {
  const errors = [];
  if (!event.source) errors.push("source missing");
  if (!event.sourceId) errors.push("sourceId missing");
  if (!event.title) errors.push("title missing");
  if (!Array.isArray(event.reflectedDocuments) || event.reflectedDocuments.length === 0) {
    errors.push("reflectedDocuments missing");
  }
  return errors;
}

const startedAt = performance.now();
const hazards = await readJson("data/safety-knowledge/hazards.json");
const resources = await readJson("data/safety-knowledge/kosha-resources.json");
const legalMap = await readJson("data/safety-knowledge/legal-map.json");
const templates = await readJson("data/safety-knowledge/templates.json");

const scenario = "서울 성수동 외벽 도장 작업. 이동식 비계 사용, 오후 강풍, 신규 작업자 포함, 추락과 지게차 동선 위험.";
const matches = matchHazards(hazards, scenario);
const rawEvent = {
  source: "kosha-openapi",
  sourceId: "smoke-kosha-smart-search-001",
  capturedAt: new Date().toISOString(),
  title: "이동식 비계 강풍 작업중지 기준 확인",
  url: "https://apis.data.go.kr/B552468/srch/smartSearch",
  payload: {
    keyword: "이동식 비계 강풍 추락",
    reflected: "위험성평가표, TBM"
  },
  relatedHazardIds: matches.slice(0, 2).map((item) => item.id),
  reflectedDocuments: ["위험성평가표", "TBM", "안전보건교육"]
};
const rawEventErrors = validateRawEvent(rawEvent);

await mkdir(outDir, { recursive: true });

const elapsedMs = Math.round(performance.now() - startedAt);
const report = {
  verdict: matches.length > 0 && rawEventErrors.length === 0 ? "pass" : "blocked",
  generatedAt: new Date().toISOString(),
  elapsedMs,
  seedDatabase: {
    hazards: hazards.length,
    officialSources: resources.length,
    legalMappings: legalMap.length,
    templates: templates.length
  },
  internalApis: [
    "/api/knowledge/match",
    "/api/knowledge/ingest",
    "/api/knowledge/regenerate"
  ],
  scenario,
  matchedHazards: matches.slice(0, 4),
  rawEventValidation: {
    ok: rawEventErrors.length === 0,
    errors: rawEventErrors
  },
  storagePolicy: {
    current: "stateless validation and regeneration bundle",
    next: "Supabase knowledge_events or DailyEntry snapshots after migration approval"
  }
};

await writeFile(
  path.join(outDir, "knowledge-api-smoke.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
