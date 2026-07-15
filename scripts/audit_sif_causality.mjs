import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const EXPECTED_CORPUS_ROWS = 6032;
const EXPECTED_CORPUS_SHA256 = "54db348b32016725afcf1a550d819ef7cb9b6ef6a278c728ac6f8d7eed02a5f7";

function parseArguments(argv) {
  const options = {
    corpus: "evaluation/sif-embedding-gate/sif-embedding-corpus.jsonl",
    output: "evaluation/sif-corpus-causality-audit.jsonl"
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--corpus" || argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function classifyBranch(view) {
  const joined = `${view.hazard} ${view.controls.join(" ")}`;
  if (view.reviewRequired) return view.hazard.includes("화재·폭발") ? "fire-review" : "fail-closed-review";
  if (/턴테이블·붐·힌지 구조부/u.test(joined)) return "aerial-structure";
  if (/고소작업대 과다 탑승|아웃트리거/u.test(joined)) return "aerial-platform-rollover";
  if (/덤프트럭·건설기계|전도방호/u.test(joined)) return "vehicle-rollover";
  if (/지게차 운반·하역 중 무게중심|지게차 운전자 좌석 안전띠/u.test(joined)) return "forklift-rollover";
  if (/경사로 주·정차 차량|차량 제동 불량·밀림/u.test(joined)) return "vehicle-slope-rollback";
  if (/작업차량 이동·후진|후진 경보/u.test(joined)) return "vehicle-traffic";
  if (/정차 차량 적재함·운전석 승하차/u.test(joined)) return "vehicle-access-fall";
  if (/리프트·승강 운반구|엘리베이터·승강기|동력 승강·하강/u.test(joined)) return "powered-gravity";
  if (/동력설비·회전체|가동부·회전체 방호/u.test(joined)) return "powered-rotating";
  if (/인양·적재 중 부재·화물/u.test(joined)) return "suspended-load";
  if (/정적 적재·적층|지게차 운반·상하차 중 적재물/u.test(joined)) return "load";
  if (/상부 물체·부재·장비/u.test(joined)) return "falling-object";
  if (/기계설비.*추락|컨베이어 상부/u.test(joined)) return "machinery-mixed-fall";
  if (/고소·비계 작업|작업발판·단부|사다리/u.test(joined)) return "fall";
  if (/부재 사이 손 끼임점|취급 보조도구/u.test(joined)) return "manual-pinch";
  if (/구조물.*붕괴|굴착면.*붕괴|데크플레이트/u.test(joined)) return "structural-collapse";
  return "other";
}

let hasPoweredMachineryCausalSignal;

function findCausalityFlags(record) {
  const overview = record.overview;
  const flags = [];
  const vehicle = "(?:지게차|덤프트럭|굴절덤프|화물자동차|화물차량|화물차|셔틀차량|살수차|굴삭기|굴착기|천공기|건설기계|차량)";
  const worker = "(?:재해자|작업자|근로자|피재자)";
  if (record.branch === "fall" && new RegExp(`${vehicle}(?:가|이|는|은).{0,180}(?:추락|떨어|전도|전복|넘어가)`, "u").test(overview)) {
    flags.push("vehicle-subject-routed-to-worker-fall");
  }
  if (record.branch === "falling-object" && (
    new RegExp(`${worker}.{0,180}(?:적재함|톤백 위|트럭 위|화물자동차|화물트럭).{0,180}(?:몸의 중심|균형|차량이 출발|이동 중).{0,100}(?:추락|떨어)`, "u").test(overview) ||
    new RegExp(`${worker}.{0,120}(?:트럭 위|적재함 위|톤백 위).{0,100}(?:추락|떨어)`, "u").test(overview)
  )) {
    flags.push("worker-fall-routed-to-falling-object");
  }
  if (record.branch === "vehicle-traffic" && new RegExp(`${vehicle}(?:가|이|는|은).{0,160}(?:전도|전복|넘어가|굴러 떨어)`, "u").test(overview)) {
    flags.push("vehicle-rollover-routed-to-traffic");
  }
  if (record.branch === "powered-rotating" && /(?:전석|우수관|수로관|배관|판넬|화물|적재물|자재|부재)(?:이|가|은|는).{0,120}(?:낙하|떨어|회전|넘어|전도|이탈|빠지)/u.test(overview)) {
    flags.push("detached-object-routed-to-powered-equipment");
  }
  if (record.branch === "aerial-platform-rollover" && !/고소작업(?:대|차)(?:가|이|는|은).{0,120}(?:전도|전복|넘어|기울)/u.test(overview) && /(?:판넬|나무)(?:이|가|은|는).{0,100}(?:넘어|기울|추락|떨어)/u.test(overview)) {
    flags.push("non-platform-subject-routed-to-aerial-rollover");
  }
  if (record.branch === "manual-pinch" && /(?:버팀대|PC\s*기둥|몰드커버|금형).{0,140}(?:전도|낙하|떨어|넘어)/u.test(overview)) {
    flags.push("heavy-object-routed-to-manual-pinch");
  }
  if (record.branch === "fall" && /고소작업(?:대|차).{0,180}(?:턴테이블|붐|Boom|힌지|용접부).{0,100}(?:파단|꺾)/u.test(overview)) {
    flags.push("aerial-structure-failure-routed-to-generic-fall");
  }
  const conveyorWorkerAccessSignal = /(?:재해자|작업자|근로자|피재자|순찰원).{0,140}컨베이어(?:\s*벨트)?\s*(?:상부|위)(?:에|에서|로)?\s*(?:올라|이동|건너|통행|작업|확인)/u.test(overview);
  if (record.branch === "machinery-mixed-fall" && /컨베이어 상부 접근·통행/u.test(record.hazard) && !conveyorWorkerAccessSignal) {
    flags.push("incidental-conveyor-mention-routed-to-traversal-fall");
  }
  if (record.branch === "powered-rotating" && !hasPoweredMachineryCausalSignal(overview)) {
    flags.push("machinery-noun-only-routed-to-powered-control");
  }
  return flags;
}

const options = parseArguments(process.argv.slice(2));
const corpusPath = resolve(process.cwd(), options.corpus);
const outputPath = resolve(process.cwd(), options.output);
const moduleServer = await createServer({
  root: process.cwd(),
  appType: "custom",
  logLevel: "silent",
  resolve: { alias: { "@": process.cwd() } },
  server: { middlewareMode: true }
});
const safetyCatalog = await moduleServer.ssrLoadModule("/lib/safety-reference-catalog.ts");
const auditGate = await moduleServer.ssrLoadModule("/lib/sif-causality-audit-gate.ts");
await moduleServer.close();
const { deriveSafetyReferenceOperationalView, getSafetyReferenceOperationalIncidentOverview } = safetyCatalog;
const { listSifCausalityAuditGateFailures } = auditGate;
hasPoweredMachineryCausalSignal = auditGate.hasPoweredMachineryCausalSignal;

const rows = readFileSync(corpusPath, "utf8")
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function runAudit() {
  let mutationCount = 0;
  let rawControlAliasCount = 0;
  let sourceControlExactMatchCount = 0;
  let rawTagStandaloneLeakCount = 0;
  const records = rows.map((row) => {
    const item = {
      id: row.referenceItemId,
      source_id: "sif-embedding-corpus",
      item_type: row.itemType,
      category: row.category,
      subcategory: null,
      title: row.title,
      summary: row.embeddingText,
      body: row.embeddingText,
      keywords: [],
      risk_tags: [...row.riskTags],
      primary_documents: [...row.primaryDocuments],
      controls: [...row.controls],
      evidence_role: "supporting"
    };
    const before = JSON.stringify(item);
    const view = deriveSafetyReferenceOperationalView(item);
    if (JSON.stringify(item) !== before) mutationCount += 1;
    if (view.controls === item.controls) rawControlAliasCount += 1;
    if (view.controls.some((control) => item.controls.includes(control))) sourceControlExactMatchCount += 1;
    if (view.controls.some((control) => item.risk_tags.includes(control.trim()))) rawTagStandaloneLeakCount += 1;
    const record = {
      id: item.id,
      overview: getSafetyReferenceOperationalIncidentOverview(item),
      riskTags: row.riskTags,
      branch: classifyBranch(view),
      hazard: view.hazard,
      controls: view.controls,
      reviewRequired: view.reviewRequired
    };
    return { ...record, causalityFlags: findCausalityFlags(record) };
  });
  return {
    records,
    mutationCount,
    rawControlAliasCount,
    sourceControlExactMatchCount,
    rawTagStandaloneLeakCount
  };
}

const first = runAudit();
const second = runAudit();
const firstHash = hashJson(first.records);
const secondHash = hashJson(second.records);
const branchCounts = Object.fromEntries(
  [...first.records.reduce((counts, record) => counts.set(record.branch, (counts.get(record.branch) ?? 0) + 1), new Map())]
    .sort((left, right) => right[1] - left[1])
);
const flagged = first.records.filter((record) => record.causalityFlags.length > 0);
const corpusSha256 = createHash("sha256").update(readFileSync(corpusPath)).digest("hex");
const summary = {
  generatedAt: new Date().toISOString(),
  corpusPath,
  corpusSha256,
  expectedRows: EXPECTED_CORPUS_ROWS,
  expectedCorpusSha256: EXPECTED_CORPUS_SHA256,
  rows: rows.length,
  branchSum: Object.values(branchCounts).reduce((sum, count) => sum + count, 0),
  outputSha256Run1: firstHash,
  outputSha256Run2: secondHash,
  deterministic: firstHash === secondHash,
  mutationRun1: first.mutationCount,
  mutationRun2: second.mutationCount,
  reviewRequired: first.records.filter((record) => record.reviewRequired).length,
  rawControlAliasCount: first.rawControlAliasCount,
  sourceControlExactMatchCount: first.sourceControlExactMatchCount,
  rawTagStandaloneLeakCount: first.rawTagStandaloneLeakCount,
  causalityFlagCount: flagged.length,
  branchCounts
};
const gateFailures = listSifCausalityAuditGateFailures(summary, {
  rows: EXPECTED_CORPUS_ROWS,
  corpusSha256: EXPECTED_CORPUS_SHA256
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  [JSON.stringify({ type: "summary", ...summary }), ...first.records.map((record) => JSON.stringify({ type: "row", ...record }))].join("\n") + "\n",
  "utf8"
);
console.log(JSON.stringify({ ...summary, gateFailures, outputPath, flagged: flagged.slice(0, 50) }, null, 2));

if (gateFailures.length > 0) {
  process.exitCode = 1;
}
