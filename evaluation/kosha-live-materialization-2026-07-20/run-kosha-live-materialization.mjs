import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), "evaluation", "kosha-live-materialization-2026-07-20");
const baseUrl = process.env.SAFECLAW_BASE_URL || "https://www.safeclaw.kr";
const askUrl = `${baseUrl}/api/ask`;
const buildInfoUrl = `${baseUrl}/api/build-info`;

const cases = [
  {
    id: "scaffold-fall",
    expectedTerms: ["KOSHA", "비계", "추락"],
    question: "세이프건설 서울 성수동 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 신규 1명, 오후 강풍 예보. 추락 위험과 비계 고정, 작업중지 기준을 반영해 위험성평가와 TBM을 만들어줘."
  },
  {
    id: "hotwork-ventilation",
    expectedTerms: ["KOSHA", "화기", "화재"],
    question: "그린메탈 경기 안산 공장 배관 용접·절단 화기작업. 작업자 6명, 베트남 작업자 2명, 실내 고온과 환기 불량, 가연물 인접. 화재감시자와 환기, 온열질환 조치를 반영해 위험성평가와 TBM, 외국인 전송본을 만들어줘."
  },
  {
    id: "electrical-panel",
    expectedTerms: ["KOSHA", "전기", "감전"],
    question: "세이프전기 부산 해운대 상가 정전전로 인근 배전반 점검 작업. 작업자 3명, 검전과 절연보호구, 접근통제 미흡 가능성. 감전 예방 조치와 TBM 확인 질문을 반영해줘."
  }
];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (isRecord(value)) Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

function collectStringsWithPaths(value, path = [], out = []) {
  if (typeof value === "string") {
    out.push({ path: path.join("."), value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringsWithPaths(item, [...path, String(index)], out));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => collectStringsWithPaths(item, [...path, key], out));
  }
  return out;
}

function isPublicSurfacePath(path) {
  if (!path) return false;
  if (/^(dbHarness|generationEvidence|generationTrace)\b/u.test(path)) return false;
  if (/^externalData\.weather\.signals\.\d+\.mode$/u.test(path)) return false;
  if (/^qualityContract\.items\.\d+\.key$/u.test(path)) return false;
  return /^(status|deliverables|structured|qualityContract|answer|practicalPoints|citations)\b/u.test(path);
}

function countTerm(text, term) {
  return (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;
}

function summarizeResponse(id, response, elapsedSec, expectedTerms) {
  const strings = collectStrings(response);
  const combined = strings.join("\n");
  const stringsWithPaths = collectStringsWithPaths(response);
  const internalTermPattern = /DB\s*하네스|qualityContract|ontologyQa|\bfallback\b|camelCase|JSONL|Obsidian|AI_MODE=|row-first|deterministic/iu;
  const publicInternalTermHits = stringsWithPaths
    .filter((item) => isPublicSurfacePath(item.path) && internalTermPattern.test(item.value))
    .map((item) => item.path);
  const internalOnlyTermHits = stringsWithPaths
    .filter((item) => !isPublicSurfacePath(item.path) && internalTermPattern.test(item.value))
    .map((item) => item.path);
  const deliverables = isRecord(response.deliverables) ? response.deliverables : {};
  const deliverableText = collectStrings(deliverables).join("\n");
  const citations = Array.isArray(response.citations) ? response.citations : [];
  const externalData = isRecord(response.externalData) ? response.externalData : {};
  const koshaExternal = isRecord(externalData.kosha) ? externalData.kosha : null;
  const status = isRecord(response.status) ? response.status : {};
  const expectedCoverage = Object.fromEntries(expectedTerms.map((term) => [term, countTerm(combined, term)]));
  const koshaCitationCount = citations.filter((citation) => {
    if (!isRecord(citation)) return false;
    return collectStrings(citation).join("\n").toLowerCase().includes("kosha");
  }).length;
  const koshaReferenceCount = koshaExternal && Array.isArray(koshaExternal.references)
    ? koshaExternal.references.length
    : 0;
  const deliverableKoshaCount = countTerm(deliverableText, "KOSHA");
  return {
    id,
    ok: true,
    elapsedSec,
    mode: response.mode ?? null,
    statusKosha: status.kosha ?? null,
    koshaExternalMode: koshaExternal?.mode ?? null,
    koshaExternalDetail: typeof koshaExternal?.detail === "string" ? koshaExternal.detail : null,
    koshaReferenceCount,
    koshaCitationCount,
    deliverableKoshaCount,
    expectedCoverage,
    publicInternalTermHits,
    internalOnlyTermHits,
    hasRiskAssessment: typeof deliverables.riskAssessmentDraft === "string" && deliverables.riskAssessmentDraft.length > 200,
    hasTbmBriefing: typeof deliverables.tbmBriefing === "string" && deliverables.tbmBriefing.length > 200,
    hasForeignTransmission: typeof deliverables.foreignWorkerTransmission === "string" && deliverables.foreignWorkerTransmission.length > 100,
    sampleKoshaLines: combined
      .split(/\r?\n/)
      .filter((line) => /KOSHA|안전보건자료|공식자료|가이드|스마트검색|중대재해사례/u.test(line))
      .slice(0, 12)
  };
}

async function postAsk(testCase) {
  const started = Date.now();
  const response = await fetch(askUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: testCase.question, aiMode: "enhanced" })
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    return { id: testCase.id, ok: false, status: response.status, bodyText: text.slice(0, 500) };
  }
  if (!response.ok) return { id: testCase.id, ok: false, status: response.status, body };
  return summarizeResponse(testCase.id, body, Number(((Date.now() - started) / 1000).toFixed(2)), testCase.expectedTerms);
}

await mkdir(outDir, { recursive: true });
const buildInfo = await (await fetch(buildInfoUrl)).json();
const results = [];
for (const testCase of cases) {
  results.push(await postAsk(testCase));
}

const findings = results.flatMap((result) => {
  if (!result.ok) return [{ severity: "P1", id: result.id, issue: "ask-failed", result }];
  const issues = [];
  if (result.koshaReferenceCount < 1 && result.koshaCitationCount < 1 && result.deliverableKoshaCount < 1) {
    issues.push({ severity: "P1", id: result.id, issue: "kosha-not-materialized" });
  }
  if (result.publicInternalTermHits.length) {
    issues.push({ severity: "P2", id: result.id, issue: "public-internal-terms", paths: result.publicInternalTermHits });
  }
  const missingExpected = Object.entries(result.expectedCoverage)
    .filter(([, count]) => count < 1)
    .map(([term]) => term);
  if (missingExpected.length) {
    issues.push({ severity: "P2", id: result.id, issue: "expected-terms-missing", missingExpected });
  }
  return issues;
});

const report = {
  generatedAt: new Date().toISOString(),
  buildInfo,
  cases: cases.map(({ id, expectedTerms, question }) => ({ id, expectedTerms, question })),
  results,
  findings
};

await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(join(outDir, "report.md"), [
  "# KOSHA Live Materialization Gate",
  "",
  `Generated at: ${report.generatedAt}`,
  "",
  `Production commit: \`${buildInfo.commitSha || "unknown"}\``,
  "",
  `Findings: ${findings.length}`,
  "",
  "## Case Summary",
  "",
  "| Case | Ask OK | KOSHA status | KOSHA refs | KOSHA citations | Deliverable KOSHA mentions | Public internal paths | Internal-only paths |",
  "| --- | ---: | --- | ---: | ---: | ---: | --- | ---: |",
  ...results.map((result) => `| ${result.id} | ${result.ok} | ${result.statusKosha || "-"} / ${result.koshaExternalMode || "-"} | ${result.koshaReferenceCount ?? 0} | ${result.koshaCitationCount ?? 0} | ${result.deliverableKoshaCount ?? 0} | ${(result.publicInternalTermHits || []).join(", ") || "-"} | ${(result.internalOnlyTermHits || []).length.toLocaleString("ko-KR")} |`),
  "",
  "## Findings",
  "",
  findings.length
    ? findings.map((finding) => `- ${finding.severity} ${finding.id}: ${finding.issue} ${JSON.stringify(finding)}`).join("\n")
    : "- No findings from this focused KOSHA materialization gate.",
  "",
  "## Sample KOSHA Lines",
  "",
  ...results.flatMap((result) => [
    `### ${result.id}`,
    "",
    "```text",
    ...(result.sampleKoshaLines || ["no sample lines"]),
    "```",
    ""
  ])
].join("\n"), "utf8");

console.log(JSON.stringify({
  buildInfo,
  findingCount: findings.length,
  findings,
  reportPath: join(outDir, "report.md")
}, null, 2));
