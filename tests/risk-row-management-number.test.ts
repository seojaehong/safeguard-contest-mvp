// RA-10/COPY — 위험성평가 「관리번호」 칸의 영문 내부 코드(RA-press-1 등) 제거.
// 고정 자료: 운영 template 응답 4건(2026-10-25, 프레스·정화조·굴착·폭염)의
// deliverables.riskAssessmentDraft 와 structured.riskAssessmentRows
// (tests/fixtures/ops-template-risk-rows-2026-10-25.json). 교정 전 판본에서 15행이 그대로 나갔다
// (#107 출력 게이트·#109 정본 직렬화 모두 통과).
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { POST as exportPdf } from "@/app/api/export/pdf/route";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import { riskManagementNumber, riskManagementNumberLabel } from "@/lib/document-display-labels";
import { buildMockAskResponse } from "@/lib/mock-data";
import {
  findUserOutputLeaks,
  gateAskResponseUserOutput,
  gateExportPayload,
  gateUserOutputText
} from "@/lib/user-output-gate";
import type { RiskAssessmentRow } from "@/lib/risk-assessment-schema";
import { buildPublicShareDocuments } from "@/lib/workpack-commercial-store";

type OpsCase = {
  question: string;
  deliverables: { riskAssessmentDraft: string };
  structured: { riskAssessmentRows: RiskAssessmentRow[] };
};

const ops = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ops-template-risk-rows-2026-10-25.json"), "utf8")
) as Record<string, OpsCase>;
const CASES = Object.keys(ops);

/** 운영에서 노출된 꼴: RA-<taskId>-<순번>. */
const RA_CODE = /\bRA-[a-z]+(?:-[a-z]+)*-\d+\b/u;
const RA_CODE_ALL = /\bRA-[a-z]+(?:-[a-z]+)*-\d+\b/gu;
/** 관리번호 칸에 허용하는 값: 한글·숫자·붙임표만. */
const KOREAN_DIGITS_ONLY = /^[가-힣0-9-]+$/u;
const MANAGEMENT_NUMBER = /^위험성평가-\d{2}$/u;
const RULE = "위험성평가 관리번호 코드";

function managementNumberLines(text: string): string[] {
  return text.split("\n").filter((line) => line.startsWith("관리번호:")).map((line) => line.slice("관리번호:".length).trim());
}

function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function hwpAllText(document: HwpDocument): string {
  const texts: string[] = [];
  for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
    texts.push(document.getTextRange(0, paraIdx, 0, document.getParagraphLength(0, paraIdx)));
    const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
    if (!Array.isArray(positions)) continue;
    positions.forEach((_position, controlIdx) => {
      let dims: { rowCount: number; colCount: number } | null = null;
      try {
        dims = JSON.parse(document.getTableDimensions(0, paraIdx, controlIdx)) as { rowCount: number; colCount: number };
      } catch {
        dims = null;
      }
      if (!dims) return;
      for (let cellIdx = 0; cellIdx < dims.rowCount * dims.colCount; cellIdx += 1) {
        const length = document.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
        texts.push(document.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length));
      }
    });
  }
  return texts.join("\n");
}

describe("고정 자료 자체 확인(교정 전 운영 응답)", () => {
  it("4건 합계 15행의 관리번호가 RA- 영문 코드다", () => {
    const draftCodes = CASES.flatMap((id) => ops[id].deliverables.riskAssessmentDraft.match(RA_CODE_ALL) || []);
    const rowCodes = CASES.flatMap((id) => ops[id].structured.riskAssessmentRows.map((row) => row.controlId || ""));
    expect(draftCodes).toHaveLength(15);
    expect(rowCodes).toHaveLength(15);
    for (const code of rowCodes) expect(code).toMatch(RA_CODE);
    expect(new Set(rowCodes.map((code) => code.replace(/-\d+$/u, "")))).toEqual(
      new Set(["RA-press", "RA-confined-space", "RA-construction-excavation", "RA-warehouse-heat"])
    );
  });
});

describe("표시 이름 사전 — 관리번호", () => {
  it("순번으로 「위험성평가-NN」을 만든다", () => {
    expect(riskManagementNumber(0)).toBe("위험성평가-01");
    expect(riskManagementNumber(9)).toBe("위험성평가-10");
    expect(riskManagementNumber(99)).toBe("위험성평가-100");
  });

  it("RA- 코드만 바꾸고 다른 값은 그대로 둔다", () => {
    expect(riskManagementNumberLabel("RA-press-3", 0)).toBe("위험성평가-01");
    expect(riskManagementNumberLabel("RA-confined-space-1", 2)).toBe("위험성평가-03");
    expect(riskManagementNumberLabel("위험성평가-07", 0)).toBe("위험성평가-07");
    expect(riskManagementNumberLabel("ABC", 0)).toBe("ABC");
    expect(riskManagementNumberLabel("fall-work-platform", 0)).toBe("fall-work-platform");
    expect(riskManagementNumberLabel("", 4)).toBe("");
    expect(riskManagementNumberLabel(undefined, 4)).toBe("");
  });
});

describe("#107 출력 게이트 — 관리번호 코드", () => {
  for (const id of CASES) {
    it(`${id}: 교정 전 초안에서 「${RULE}」 누출을 잡는다`, () => {
      const leaks = findUserOutputLeaks(ops[id].deliverables.riskAssessmentDraft);
      expect(leaks.map((leak) => leak.rule)).toContain(RULE);
    });

    it(`${id}: 본문 게이트가 관리번호 줄을 「위험성평가-NN」으로 바꾼다`, () => {
      const gated = gateUserOutputText(ops[id].deliverables.riskAssessmentDraft);
      expect(gated).not.toMatch(RA_CODE);
      const numbers = managementNumberLines(gated);
      expect(numbers).toHaveLength(ops[id].structured.riskAssessmentRows.length);
      expect(numbers[0]).toBe("위험성평가-01");
      for (const number of numbers) expect(number).toMatch(MANAGEMENT_NUMBER);
      expect(findUserOutputLeaks(gated).map((leak) => leak.rule)).not.toContain(RULE);
      // 같은 입력에 두 번 돌려도 결과가 같다.
      expect(gateUserOutputText(gated)).toBe(gated);
    });

    it(`${id}: 응답 게이트가 구조화 행의 controlId 와 초안을 같은 값으로 맞춘다`, () => {
      const base = buildMockAskResponse(ops[id].question, [], "mock", "fixture");
      const gated = gateAskResponseUserOutput({
        ...base,
        deliverables: { ...base.deliverables, riskAssessmentDraft: ops[id].deliverables.riskAssessmentDraft },
        structured: { riskAssessmentRows: ops[id].structured.riskAssessmentRows, riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] } }
      });
      const rows = gated.structured?.riskAssessmentRows || [];
      expect(rows).toHaveLength(ops[id].structured.riskAssessmentRows.length);
      const ids = rows.map((row) => row.controlId || "");
      for (const controlId of ids) expect(controlId).toMatch(MANAGEMENT_NUMBER);
      expect(ids).toEqual(rows.map((_row, index) => riskManagementNumber(index)));
      expect(managementNumberLines(gated.deliverables.riskAssessmentDraft)).toEqual(ids);
      expect(serializeRiskAssessmentRowsToDraft(rows)).not.toMatch(RA_CODE);
    });
  }

  it("내보내기 요청 본문의 글 칸도 같은 규칙으로 바꾼다", () => {
    const payload = gateExportPayload({
      rows: [{ document: "위험성평가표", section: "1", item: "관리번호", content: "관리번호: RA-warehouse-heat-2" }],
      body: "위험성평가표(구조화 편집본)\n\n[1. 상하차]\n관리번호: RA-press-1\n작업장소: 창고"
    });
    expect(payload.rows[0].content).toBe("관리번호: 위험성평가-02");
    expect(payload.body).toContain("관리번호: 위험성평가-01");
    expect(JSON.stringify(payload)).not.toMatch(RA_CODE);
  });
});

describe("#109 정본 직렬화 — 옛 저장본 호환", () => {
  for (const id of CASES) {
    it(`${id}: RA- 코드가 든 행을 직렬화하면 관리번호가 「위험성평가-NN」이다`, () => {
      const text = serializeRiskAssessmentRowsToDraft(ops[id].structured.riskAssessmentRows);
      expect(text).not.toMatch(RA_CODE);
      const numbers = managementNumberLines(text);
      expect(numbers).toEqual(ops[id].structured.riskAssessmentRows.map((_row, index) => riskManagementNumber(index)));
    });
  }

  it("관리번호가 비면 「-」, 사람이 적은 한글·숫자 값은 그대로 둔다", () => {
    const [first, second] = ops["mfg-press"].structured.riskAssessmentRows;
    const text = serializeRiskAssessmentRowsToDraft([
      { ...first, controlId: undefined },
      { ...second, controlId: "현장-07" }
    ]);
    expect(managementNumberLines(text)).toEqual(["-", "현장-07"]);
  });
});

describe("기본 틀 생성 — 새 응답의 관리번호", () => {
  for (const id of CASES) {
    it(`${id}: template 응답의 controlId·초안 관리번호가 한글·숫자만이다`, () => {
      const response = buildMockAskResponse(ops[id].question, [], "mock", "fixture");
      const rows = response.structured?.riskAssessmentRows || [];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.controlId, `${id} controlId`).toMatch(KOREAN_DIGITS_ONLY);
        expect(row.controlId).toMatch(MANAGEMENT_NUMBER);
      }
      const numbers = managementNumberLines(response.deliverables.riskAssessmentDraft);
      expect(numbers).toEqual(rows.map((row) => row.controlId));
      expect(JSON.stringify(response.deliverables)).not.toMatch(RA_CODE);
    });
  }
});

describe("공유본 읽기 — 옛 저장본의 초안 글", () => {
  for (const id of CASES) {
    it(`${id}: 공유 세션 문서의 위험성평가 본문에 RA- 코드가 없다`, () => {
      const documents = buildPublicShareDocuments({
        riskAssessmentDraft: ops[id].deliverables.riskAssessmentDraft,
        tbmBriefing: "오늘 작업 확인",
        tbmLogDraft: ""
      });
      const risk = documents.find((document) => document.key === "riskAssessmentDraft");
      expect(risk).toBeDefined();
      expect(risk!.body).not.toMatch(RA_CODE);
      expect(managementNumberLines(risk!.body)[0]).toBe("위험성평가-01");
      expect(documents.map((document) => document.key)).toEqual(["riskAssessmentDraft", "tbmBriefing"]);
    });
  }
});

describe("서식 출력(xlsx·pdf·hwp) — 옛 RA- 코드가 든 행", () => {
  const id = "mfg-press";
  const rows = () => ops[id].structured.riskAssessmentRows;
  const scenario = () => buildMockAskResponse(ops[id].question, [], "mock", "fixture").scenario;

  it("xlsx 셀 어디에도 RA- 코드가 없다", async () => {
    const response = await exportXlsx(request("http://localhost/api/export/xlsx", {
      mode: "single",
      title: "위험성평가표",
      scenario: scenario(),
      profile: { code: "risk", subtitle: "위험성평가", layout: "risk", primaryColumn: "유해·위험요인", actionColumn: "감소대책", confirmationRows: [], approvalLabels: ["작성", "검토", "승인"] },
      rows: [],
      riskAssessmentRows: rows(),
      riskReviewItems: []
    }));
    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
    const texts: string[] = [];
    workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell({ includeEmpty: false }, (cell) => texts.push(cell.text))));
    expect(texts.join("\n")).not.toMatch(RA_CODE);
  });

  it("pdf(html) 본문 어디에도 RA- 코드가 없다", async () => {
    const response = await exportPdf(request("http://localhost/api/export/pdf?format=html", {
      title: "위험성평가표",
      scenario: scenario(),
      riskLevel: "상",
      riskAssessmentRows: rows(),
      riskReviewItems: [],
      documentText: serializeRiskAssessmentRowsToDraft(rows())
    }));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toMatch(RA_CODE);
  });

  it("hwp 본문·표 어디에도 RA- 코드가 없다", async () => {
    const response = await exportHwp(request("http://localhost/api/export/hwp", {
      title: "위험성평가표",
      profile: { layout: "risk" },
      scenario: scenario(),
      rows: [],
      riskAssessmentRows: rows(),
      riskReviewItems: []
    }));
    expect(response.status).toBe(200);
    const document = new HwpDocument(new Uint8Array(await response.arrayBuffer()));
    try {
      expect(hwpAllText(document)).not.toMatch(RA_CODE);
    } finally {
      document.free();
    }
  });
});
