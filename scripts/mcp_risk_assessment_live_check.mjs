// 로컬 next 인스턴스에 실제 MCP 클라이언트(@modelcontextprotocol/sdk streamable-http)로 붙어
// generate_risk_assessment 를 부르고, 받은 서식 파일을 웹 내보내기 라우트(/api/export/{xlsx,hwp})에
// 편집기와 같은 모양의 본문(이 스크립트가 따로 적는다)을 보내 받은 파일과 대조한다.
//
// 사용: node scripts/mcp_risk_assessment_live_check.mjs <repoRoot> <baseUrl> <outDir> [tokenFile]
// 토큰은 tokenFile(한 줄) 또는 환경변수 MCP_TEST_TOKEN 에서만 읽고 출력하지 않는다. 가상 작업 설명만 쓴다.
// 서버는 같은 토큰을 SAFECLAW_MCP_TOKENS 로 준 로컬 next dev 다(.claude/skills/verify-safeclaw/features/mcp-risk-assessment.md).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync as readTokenFile, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [worktree, baseUrl, outDir, tokenFile] = process.argv.slice(2);
const token = tokenFile ? readTokenFile(tokenFile, "utf8").trim() : process.env.MCP_TEST_TOKEN;
if (!worktree || !baseUrl || !outDir || !token) {
  console.error("usage: node scripts/mcp_risk_assessment_live_check.mjs <repoRoot> <baseUrl> <outDir> [tokenFile]");
  process.exit(2);
}
const require = createRequire(path.join(worktree, "package.json"));
const load = async (specifier) => import(pathToFileURL(require.resolve(specifier)).href);
const { Client } = await load("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = await load("@modelcontextprotocol/sdk/client/streamableHttp.js");
const ExcelJS = (await load("exceljs")).default;
const { HwpDocument, initSync } = await load("@rhwp/core");
const { readFileSync } = await import("node:fs");
globalThis.measureTextWidth = (_font, text) => text.length * 12;
initSync({ module: readFileSync(path.join(worktree, "public", "rhwp_bg.wasm")) });

// 편집기 getSafetyFormProfile("riskAssessmentDraft") 원문 값.
const EDITOR_RISK_PROFILE = {
  code: "SC-RISK-01",
  subtitle: "위험성평가 및 감소대책 확인서",
  layout: "risk",
  primaryColumn: "위험요인",
  actionColumn: "감소대책 / 잔여위험",
  confirmationRows: ["위험요인 확인", "감소대책 담당 지정", "작업 전 공유", "잔여위험 승인"],
  approvalLabels: ["작성", "검토", "승인"]
};

const SCENARIOS = [
  { id: "S1-sif", label: "SIF 있는 작업(밀폐공간)", question: "가상 사업장 한빛정화 오수처리장 맨홀 내부 슬러지 제거 작업 3명, 밀폐공간 산소결핍·황화수소 우려, 주간", mode: "enhanced" },
  { id: "S2-template", label: "SIF 없는 작업(template, DB 조회 없음)", question: "가상 사업장 누리물류 경기 화성 물류창고 지게차 상하차 작업 4명, 비 예보, 야간", mode: "template" },
  { id: "S3-review", label: "확인 필요 행 생기는 작업(화재·폭발)", question: "가상 사업장 미래화학 도장공장 배기덕트 내부 용접 보수 작업 2명, 인화성 증기 잔류 가능, 화재감시자 배치", mode: "enhanced" },
  { id: "S4-no-rows", label: "작업 유형을 판정하지 못하는 설명(행 0)", question: "내일 오전에 사무실에서 할 일 정리", mode: "enhanced", formats: ["xlsx"] }
];

function editorBody(result, format) {
  const review = result.reviewItems.structuredRows;
  return {
    ...(format === "xlsx" ? { mode: "single" } : {}),
    edited: false,
    title: "위험성평가표",
    rows: [],
    profile: EDITOR_RISK_PROFILE,
    scenario: result.scenario,
    riskAssessmentRows: result.riskAssessment.structuredRows,
    ...(review.length ? { riskReviewItems: review } : {})
  };
}

async function workbookSnapshot(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets.map((sheet) => {
    const cells = [];
    sheet.eachRow({ includeEmpty: true }, (row) => row.eachCell({ includeEmpty: false }, (cell) => cells.push([cell.address, cell.text, JSON.stringify(cell.style)])));
    return { name: sheet.name, cells, merges: [...(sheet.model.merges ?? [])].sort(), widths: sheet.columns.map((c) => c.width), pageSetup: { ...sheet.pageSetup } };
  });
}

function hwpText(buffer) {
  const document = new HwpDocument(new Uint8Array(buffer));
  const texts = [];
  try {
    for (let p = 0; p < document.getParagraphCount(0); p += 1) {
      texts.push(document.getTextRange(0, p, 0, document.getParagraphLength(0, p)));
      const positions = JSON.parse(document.getControlTextPositions(0, p));
      if (!Array.isArray(positions)) continue;
      positions.forEach((_x, c) => {
        let dims = null;
        try { dims = JSON.parse(document.getTableDimensions(0, p, c)); } catch { dims = null; }
        if (!dims) return;
        for (let i = 0; i < dims.rowCount * dims.colCount; i += 1) {
          const len = document.getCellParagraphLength(0, p, c, i, 0);
          texts.push(document.getTextInCell(0, p, c, i, 0, 0, len));
        }
      });
    }
  } finally {
    document.free();
  }
  return texts.join("\n");
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

mkdirSync(outDir, { recursive: true });
const transport = new StreamableHTTPClientTransport(new URL("/api/mcp/mcp", baseUrl), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } }
});
const client = new Client({ name: "sc-mcp-ra-live-check", version: "0.0.1" });
await client.connect(transport);
const tools = await client.listTools();
const listed = tools.tools.find((tool) => tool.name === "generate_risk_assessment");
const summary = { baseUrl, toolListed: Boolean(listed), toolCount: tools.tools.length, scenarios: [] };
writeFileSync(path.join(outDir, "tools-list.json"), JSON.stringify(tools.tools.map((t) => ({ name: t.name, title: t.title, inputSchema: t.inputSchema })), null, 2));

for (const scenario of SCENARIOS) {
  for (const format of scenario.formats ?? ["xlsx", "hwp"]) {
    const started = Date.now();
    const call = await client.callTool({ name: "generate_risk_assessment", arguments: { question: scenario.question, mode: scenario.mode, format } }, undefined, { timeout: 280_000 });
    const elapsedMs = Date.now() - started;
    const text = call.content?.[0]?.text ?? "";
    const responseBytes = Buffer.byteLength(JSON.stringify(call), "utf8");
    const dir = path.join(outDir, scenario.id);
    mkdirSync(dir, { recursive: true });
    if (call.isError) {
      writeFileSync(path.join(dir, `${format}-error.json`), text);
      summary.scenarios.push({ id: scenario.id, format, error: text.slice(0, 400), elapsedMs });
      continue;
    }
    const result = JSON.parse(text);
    const { base64, ...fileMeta } = result.file ?? {};
    writeFileSync(path.join(dir, `${format}-result.json`), JSON.stringify({ ...result, file: result.file ? { ...fileMeta, base64: `<${(base64 ?? "").length} chars>` } : null }, null, 2));
    const row = {
      id: scenario.id,
      label: scenario.label,
      mode: result.mode,
      format,
      status: result.status,
      rowCount: result.riskAssessment.rowCount,
      reviewCount: result.reviewItems.count,
      sifCount: result.sif.count,
      sifSources: [...new Set(result.sif.cases.map((c) => `${c.source.id} · ${c.source.agency ?? "출처 미상"} · 기준 ${c.source.publishedAt ?? "미상"}`))],
      sifTitles: result.sif.cases.map((c) => c.title),
      sifReason: result.sif.reason ?? null,
      sifRetrievedCount: result.sif.retrievedCount ?? 0,
      sifKept: result.sif.cases.map((c) => ({ title: c.title, matchedWork: c.relevance?.matchedWork ?? [], matchedAccidentTypes: c.relevance?.matchedAccidentTypes ?? [], score: c.relevance?.score ?? null })),
      sifExcluded: (result.sif.excluded ?? []).map((c) => ({ title: c.title, reason: c.reason })),
      recordItems: Object.fromEntries(result.recordItemsCheck.items.map((entry) => [entry.item, entry.status])),
      responsibilityNote: result.responsibilityNote,
      approvalLabels: result.riskAssessment.approvalLabels,
      responseBytes,
      elapsedMs
    };
    if (!result.file) {
      row.fileUnavailableReason = result.fileUnavailableReason;
      summary.scenarios.push(row);
      continue;
    }
    const mcpBuffer = Buffer.from(base64, "base64");
    const mcpPath = path.join(dir, `mcp-${result.file.fileName}`);
    writeFileSync(mcpPath, mcpBuffer);
    row.fileName = result.file.fileName;
    row.fileBytes = mcpBuffer.byteLength;
    row.sha256Matches = sha(mcpBuffer) === result.file.sha256;
    row.magic = format === "xlsx" ? mcpBuffer.subarray(0, 2).toString("latin1") : mcpBuffer.subarray(0, 4).toString("hex");

    const web = await fetch(new URL(`/api/export/${format}`, baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editorBody(result, format))
    });
    row.webStatus = web.status;
    const webBuffer = Buffer.from(await web.arrayBuffer());
    writeFileSync(path.join(dir, `web-${result.file.fileName}`), webBuffer);
    if (format === "xlsx") {
      const [a, b] = [await workbookSnapshot(mcpBuffer), await workbookSnapshot(webBuffer)];
      row.cellParity = JSON.stringify(a) === JSON.stringify(b);
      row.cellCount = a[0]?.cells.length ?? 0;
      const texts = a[0]?.cells.map((c) => c[1]) ?? [];
      row.headersPresent = ["유해·위험요인", "가능성", "중대성", "위험성", "감소대책", "확인 및 결재"].every((label) => texts.includes(label));
      row.approvalPresent = ["작성", "검토", "승인"].every((label) => texts.some((t) => t === label || t.startsWith(label)));
      row.reviewListPresent = result.reviewItems.count === 0 || texts.some((t) => t.includes("확인 필요 목록"));
    } else {
      row.bytesIdentical = mcpBuffer.equals(webBuffer);
      const [a, b] = [hwpText(mcpBuffer), hwpText(webBuffer)];
      row.textParity = a === b;
      row.approvalPresent = ["작성", "검토", "승인"].every((label) => a.includes(label));
      row.reviewListPresent = result.reviewItems.count === 0 || a.includes("확인 필요 목록");
    }
    summary.scenarios.push(row);
    console.log(`${scenario.id} ${format}: status=${row.status} rows=${row.rowCount} review=${row.reviewCount} sif=${row.sifCount} ${elapsedMs}ms`);
  }
}
await client.close();
writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log("done");
