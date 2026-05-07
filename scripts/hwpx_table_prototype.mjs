#!/usr/bin/env node
import { initSync, HwpDocument } from "@rhwp/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

globalThis.measureTextWidth = (_font, text) => text.length * 12;

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wasmPath = path.join(repoRoot, "node_modules", "@rhwp", "core", "rhwp_bg.wasm");
const outDir = path.join(repoRoot, "evaluation", "2026-05-07-hwpx-table-prototype");
fs.mkdirSync(outDir, { recursive: true });

initSync({ module: fs.readFileSync(wasmPath) });

const cases = [
  {
    name: "risk-assessment",
    title: "위험성평가표",
    headerRow: ["단위공종", "유해·위험요인", "재해형태", "가능성", "중대성", "등급", "감소대책", "조치담당자", "확인"],
    bodyRows: [
      ["외벽 도장", "이동식 비계 추락", "추락", "3", "4", "상", "고정핀·바퀴잠금·작업발판 점검", "관리감독자", "□"],
      ["외벽 도장", "강풍 시 비계 전도", "전도/낙하", "3", "5", "상", "풍속 모니터링·즉시 작업중지", "작업반장", "□"],
      ["자재 상하차", "지게차 동선 충돌", "충돌", "2", "4", "중", "출입통제·신호수 배치", "신호수", "□"]
    ]
  },
  {
    name: "work-plan",
    title: "작업계획서",
    headerRow: ["순번", "작업개요", "장비·인원", "작업중지 기준", "비상대응", "확인"],
    bodyRows: [
      ["1", "이동식 비계 설치", "비계공 2명, 페인터 3명", "풍속 10m/s 초과", "119 신고·하강 대피", "□"],
      ["2", "외벽 도장", "페인터 5명, 도료 100L", "강풍·천둥 발생 시", "지상 대기·통제선 외 이동", "□"],
      ["3", "자재 상하차", "지게차 1대, 신호수 1명", "지게차 시야 차단", "비상 정지·관리감독자 호출", "□"]
    ]
  },
  {
    name: "permit-inspection",
    title: "작업허가·점검서",
    headerRow: ["허가번호", "작업시간", "신청자", "허가자", "확인"],
    bodyRows: [
      ["P-2026-0507-001", "08:00~12:00", "현장소장", "안전관리자", "□"],
      ["P-2026-0507-002", "13:00~17:00", "작업반장", "관리감독자", "□"]
    ]
  },
  {
    name: "tbm-log",
    title: "TBM 일지",
    headerRow: ["NO", "직종", "성명", "오전", "오후", "비고"],
    bodyRows: [
      ["1", "비계공", "홍길동", "○", "○", "신규 투입자"],
      ["2", "페인터", "김안전", "○", "○", ""],
      ["3", "페인터", "이도장", "○", "△", "오후 조퇴"],
      ["4", "신호수", "박신호", "○", "○", ""],
      ["5", "관리감독자", "최감독", "○", "○", ""]
    ]
  }
];

function buildTableHwpx(spec) {
  const document = HwpDocument.createEmpty();
  try {
    document.createBlankDocument();

    // Header text
    document.insertText(0, 0, 0, `${spec.title}(초안)\nSafeClaw 공식자료 기반 서식 · 현장 검토 후 사용\n\n`);

    const cols = spec.headerRow.length;
    const rows = spec.bodyRows.length + 1; // +1 header

    const tableJson = JSON.parse(document.createTable(0, 0, 0, rows, cols));
    if (!tableJson?.ok) {
      throw new Error("createTable failed: " + JSON.stringify(tableJson));
    }
    const { paraIdx, controlIdx = 0 } = tableJson;

    const allRows = [spec.headerRow, ...spec.bodyRows];
    allRows.forEach((row, rowIdx) => {
      row.forEach((value, colIdx) => {
        const cellIdx = rowIdx * cols + colIdx;
        document.insertTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, String(value));
      });
    });

    // Footer signature lines
    document.insertText(0, 0, 0, "\n\n[확인/서명]\n작성자: ____________________\n관리감독자: ____________________\n확인일시: ______년 ____월 ____일 ____시 ____분");

    const exported = document.exportHwpx();
    return Buffer.from(exported);
  } finally {
    document.free();
  }
}

const summary = [];
for (const spec of cases) {
  const buf = buildTableHwpx(spec);
  const outPath = path.join(outDir, `${spec.name}.hwpx`);
  fs.writeFileSync(outPath, buf);

  // Verify by unzipping and counting hp:tbl
  const tmpExtract = path.join(outDir, `_unpacked_${spec.name}`);
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  fs.mkdirSync(tmpExtract, { recursive: true });
  execFileSync("unzip", ["-q", outPath, "-d", tmpExtract]);
  const sectionXml = fs.readFileSync(path.join(tmpExtract, "Contents", "section0.xml"), "utf8");
  const tblCount = (sectionXml.match(/<hp:tbl[\s>]/g) || []).length;
  const trCount = (sectionXml.match(/<hp:tr[\s>]/g) || []).length;
  const tcCount = (sectionXml.match(/<hp:tc[\s>]/g) || []).length;
  const containsTitle = sectionXml.includes(spec.title);
  // Sample cell content presence check
  const sampleCells = [...spec.headerRow, ...spec.bodyRows[0]].slice(0, 4);
  const cellPresence = sampleCells.map(t => ({ text: t, present: sectionXml.includes(t) }));

  summary.push({
    name: spec.name,
    title: spec.title,
    bytes: buf.length,
    hp_tbl: tblCount,
    hp_tr: trCount,
    hp_tc: tcCount,
    expected_rows: rows_expected(spec),
    expected_cells: cells_expected(spec),
    contains_title: containsTitle,
    sample_cell_presence: cellPresence
  });
}

function rows_expected(spec) { return spec.bodyRows.length + 1; }
function cells_expected(spec) { return (spec.bodyRows.length + 1) * spec.headerRow.length; }

fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
