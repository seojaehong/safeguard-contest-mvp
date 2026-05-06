import init, { HwpDocument } from "@rhwp/core";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(repoRoot, "evaluation", "2026-05-06-rhwp-rendering-grill");
const wasmPath = join(repoRoot, "public", "rhwp_bg.wasm");

function ensureCleanDir(path) {
  mkdirSync(path, { recursive: true });
}

function parseJsonResult(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid rhwp JSON result: ${raw}`);
  }
  return parsed;
}

function createSafetyTable(document) {
  document.insertText(0, 0, 0, "SafeClaw HWP table smoke\n위험성평가표 제출형 초안\n");

  const table = parseJsonResult(document.createTable(0, 0, 0, 4, 4));
  if (table.ok !== true || typeof table.paraIdx !== "number") {
    throw new Error(`Failed to create rhwp table: ${JSON.stringify(table)}`);
  }

  const controlIdx = typeof table.controlIdx === "number" ? table.controlIdx : 0;
  const values = [
    ["구분", "유해위험요인", "감소대책", "확인"],
    ["Man", "2인 1조 천장 누수 보수", "감시자 지정 / 작업 전 역할 확인", "□"],
    ["Machine", "전동공구·전기설비 감전", "전원 차단 / 검전 / 누전차단 확인", "□"],
    ["Media", "젖은 바닥 미끄러짐", "출입통제 / 미끄럼 방지 / 배수 확인", "□"]
  ];

  values.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cellIdx = rowIndex * 4 + colIndex;
      document.insertTextInCell(0, table.paraIdx, controlIdx, cellIdx, 0, 0, value);
    });
  });

  return { paraIdx: table.paraIdx, controlIdx };
}

function unzipHwpx(hwpxPath, targetDir) {
  execFileSync("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${hwpxPath.replaceAll("'", "''")}' -DestinationPath '${targetDir.replaceAll("'", "''")}' -Force`
  ], { stdio: "ignore" });
}

async function main() {
  ensureCleanDir(outputDir);

  const wasm = readFileSync(wasmPath);
  await init({ module_or_path: wasm });

  const hwpDocument = HwpDocument.createEmpty();
  let hwpBytes;
  let hwpVerify;
  let tableHtml;
  try {
    hwpDocument.createBlankDocument();
    const table = createSafetyTable(hwpDocument);
    tableHtml = hwpDocument.exportControlHtml(0, table.paraIdx, table.controlIdx);
    hwpVerify = parseJsonResult(hwpDocument.exportHwpVerify());
    hwpBytes = hwpDocument.exportHwp();
  } finally {
    hwpDocument.free();
  }

  const hwpxDocument = HwpDocument.createEmpty();
  let hwpxBytes;
  try {
    hwpxDocument.createBlankDocument();
    hwpxDocument.insertText(0, 0, 0, [
      "SafeClaw HWPX 제출형 초안",
      "위험성평가표",
      "작업 전 유해위험요인, 감소대책, 확인/서명란을 현장 검토 후 사용합니다.",
      "작성자: ____________________",
      "관리감독자: ____________________"
    ].join("\n"));
    hwpxBytes = hwpxDocument.exportHwpx();
  } finally {
    hwpxDocument.free();
  }

  const hwpPath = join(outputDir, "rhwp-structured-table.hwp");
  const hwpxPath = join(outputDir, "rhwp-text-submit-draft.hwpx");
  const tableHtmlPath = join(outputDir, "rhwp-table-preview.html");
  const unzipDir = mkdtempSync(join(tmpdir(), "safeclaw-rhwp-"));

  writeFileSync(hwpPath, hwpBytes);
  writeFileSync(hwpxPath, hwpxBytes);
  writeFileSync(tableHtmlPath, tableHtml);
  unzipHwpx(hwpxPath, unzipDir);

  const sectionXml = readFileSync(join(unzipDir, "Contents", "section0.xml"), "utf8");
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    rhwpPackage: "@rhwp/core",
    outputs: {
      hwp: {
        path: "evaluation/2026-05-06-rhwp-rendering-grill/rhwp-structured-table.hwp",
        bytes: hwpBytes.length,
        verify: hwpVerify,
        tablePreviewHtml: "evaluation/2026-05-06-rhwp-rendering-grill/rhwp-table-preview.html",
        proves: [
          "rhwp can create an editable HWP document from code.",
          "rhwp can create a table control and populate Korean text inside cells.",
          "rhwp can export the table control to HTML for preview or QA."
        ]
      },
      hwpx: {
        path: "evaluation/2026-05-06-rhwp-rendering-grill/rhwp-text-submit-draft.hwpx",
        bytes: hwpxBytes.length,
        hasKoreanText: sectionXml.includes("위험성평가표"),
        hasSignatureFields: sectionXml.includes("관리감독자"),
        proves: [
          "rhwp can export a valid HWPX package with Korean text.",
          "The current SafeClaw-safe path should use HWPX as a structured submission draft, not a cell-perfect template clone."
        ]
      }
    },
    limitation: {
      currentHwpExportStrength: "Best for showing table/cell based Hangul rendering capability.",
      currentHwpxExportStrength: "Best for valid Korean text HWPX draft output.",
      notYetClaimed: "Original public-institution HWPX cell-by-cell reproduction requires template mapping and separate compatibility QA."
    },
    recommendedSafeClawUse: [
      "Keep rhwp as the HWP/HWPX engine.",
      "Expose HWPX as submission draft and HWP/table preview as Hangul rendering capability evidence.",
      "Build customer-template mapping before claiming exact original-form reproduction."
    ]
  };

  writeFileSync(join(outputDir, "rhwp-rendering-capability-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, outputDir, hwpBytes: hwpBytes.length, hwpxBytes: hwpxBytes.length }));
}

await main();
