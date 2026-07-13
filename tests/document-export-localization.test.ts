import path from "node:path";
import AdmZip from "adm-zip";
import { HwpDocument } from "@rhwp/core";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { POST as exportPdf } from "@/app/api/export/pdf/route";
import {
  buildHwpxFromTemplate,
  localizeHwpxPlainText,
  localizeHwpxXmlText
} from "@/lib/hwpx-template";

const root = process.cwd();

function firstLocalZipEntry(buffer: Buffer) {
  expect(buffer.readUInt32LE(0)).toBe(0x04034b50);
  const compressionMethod = buffer.readUInt16LE(8);
  const fileNameLength = buffer.readUInt16LE(26);
  const fileName = buffer.subarray(30, 30 + fileNameLength).toString("utf8");
  return { compressionMethod, fileName };
}

function readableEntries(zip: AdmZip) {
  return zip.getEntries().filter((entry) => !entry.isDirectory && /\.(xml|hpf|rdf|txt)$/iu.test(entry.entryName));
}

function readXmlText(xml: string): string {
  return xml
    .replace(/<[^>]+>/gu, "")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;|&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

function getHwpCellText(document: HwpDocument, paraIdx: number, controlIdx: number, cellIdx: number) {
  const length = document.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
  return document.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length);
}

function listHwpTables(document: HwpDocument) {
  const tables: Array<{ paraIdx: number; controlIdx: number }> = [];
  for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
    const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
    if (!Array.isArray(positions)) continue;
    positions.forEach((_position, controlIdx) => {
      try {
        const dimensions = JSON.parse(document.getTableDimensions(0, paraIdx, controlIdx)) as unknown;
        if (dimensions && typeof dimensions === "object") tables.push({ paraIdx, controlIdx });
      } catch {
        // Non-table controls are intentionally ignored while enumerating the document.
      }
    });
  }
  return tables;
}

describe("localized editable document exports", () => {
  it("keeps HWPX mimetype first and stored while localizing only intended XML text", () => {
    const sourcePath = path.join(root, "templates", "hwpx", "tbm-log.hwpx");
    const sourceZip = new AdmZip(sourcePath);
    const output = buildHwpxFromTemplate("tbm-log", "");
    const outputZip = new AdmZip(output);

    expect(firstLocalZipEntry(output)).toEqual({ fileName: "mimetype", compressionMethod: 0 });
    expect(outputZip.getEntries().map((entry) => entry.entryName))
      .toEqual(sourceZip.getEntries().map((entry) => entry.entryName));

    const outputText = readableEntries(outputZip).map((entry) => entry.getData().toString("utf8")).join("\n");
    expect(outputText).toContain("사업장명 입력");
    expect(outputText).not.toContain("__COMPANY__");
    expect(outputText).not.toMatch(/>\s*(?:NO|No\.)\s*</u);
    expect(outputText).toContain("연번");
    const preview = outputZip.getEntry("Preview/PrvText.txt")?.getData().toString("utf8") ?? "";
    expect(preview).not.toContain("<NO><");
    expect(preview).toContain("<연번><");

    for (const sourceEntry of sourceZip.getEntries()) {
      if (sourceEntry.isDirectory || /\.(xml|hpf|rdf|txt)$/iu.test(sourceEntry.entryName)) continue;
      expect(outputZip.getEntry(sourceEntry.entryName)?.getData())
        .toEqual(sourceEntry.getData());
    }
  });

  it("keeps arbitrary HWPX free text containing NO while translating exact header tokens", () => {
    const localized = localizeHwpxXmlText(
      "<hp:t>NO</hp:t><hp:t>No.</hp:t><hp:t>SNS 알림</hp:t><hp:t>NO 작업 금지</hp:t>",
      "테스트 건설"
    );

    expect(localized).toBe(
      "<hp:t>연번</hp:t><hp:t>연번</hp:t><hp:t>SNS 알림</hp:t><hp:t>NO 작업 금지</hp:t>"
    );

    expect(localizeHwpxPlainText("<NO><직종><No.><비고><NO 작업 금지>", "테스트 건설")).toBe(
      "<연번><직종><연번><비고><NO 작업 금지>"
    );
  });

  it("XML-escapes substituted HWPX company names while preserving rendered text", () => {
    const companyName = 'A&B 건설 "동부" <1공구>';
    const output = buildHwpxFromTemplate("risk-assessment", companyName);
    const zip = new AdmZip(output);
    const textEntries = readableEntries(zip);
    const matchingEntry = textEntries.find((entry) => entry.getData().toString("utf8").includes("A&amp;B"));

    expect(matchingEntry).toBeDefined();
    const xml = matchingEntry?.getData().toString("utf8") ?? "";
    expect(xml).toContain("A&amp;B 건설 &quot;동부&quot; &lt;1공구&gt;");
    expect(readXmlText(xml)).toContain(companyName);
    expect(firstLocalZipEntry(output)).toEqual({ fileName: "mimetype", compressionMethod: 0 });
  });

  it("uses entry-aware HWPX substitution for XML and plain-text previews", () => {
    const companyName = 'A&B 건설 "동부" <1공구>';
    const output = buildHwpxFromTemplate("emergency-response", companyName);
    const zip = new AdmZip(output);
    const preview = zip.getEntry("Preview/PrvText.txt")?.getData().toString("utf8") ?? "";
    const xmlEntry = readableEntries(zip).find((entry) => (
      entry.entryName !== "Preview/PrvText.txt"
      && entry.getData().toString("utf8").includes("A&amp;B")
    ));

    expect(preview).toContain(companyName);
    expect(preview).not.toContain("A&amp;B");
    expect(preview).not.toContain("A&amp;amp;B");
    expect(xmlEntry).toBeDefined();
    const xml = xmlEntry?.getData().toString("utf8") ?? "";
    expect(xml).toContain("A&amp;B 건설 &quot;동부&quot; &lt;1공구&gt;");
    expect(xml).not.toContain("A&amp;amp;B");
    expect(readXmlText(xml)).toContain(companyName);
    expect(firstLocalZipEntry(output)).toEqual({ fileName: "mimetype", compressionMethod: 0 });
  });

  it("uses Korean row headings and a table-based approval area in HWP", async () => {
    const response = await exportHwp(new NextRequest("http://localhost/api/export/hwp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "안전보건교육일지",
        profile: { layout: "education" },
        scenario: { companyName: "테스트 건설", siteName: "제1현장", workSummary: "안전교육", workerCount: 3 },
        rows: [{ document: "안전보건교육일지", section: "교육", item: "추락 예방", content: "안전대 사용" }]
      })
    }));

    expect(response.status).toBe(200);
    const binary = Buffer.from(await response.arrayBuffer());
    expect(binary.subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1");
    expect(binary.length).toBeGreaterThan(1_000);

    const reloaded = new HwpDocument(new Uint8Array(binary));
    try {
      const tables = listHwpTables(reloaded);
      expect(tables).toHaveLength(3);
      expect(tables.map((table) => table.paraIdx)).toEqual([...tables.map((table) => table.paraIdx)].sort((a, b) => a - b));
      expect(tables[0].paraIdx).toBeLessThan(tables[1].paraIdx);
      expect(tables[1].paraIdx).toBeLessThan(tables[2].paraIdx);
      expect(getHwpCellText(reloaded, tables[0].paraIdx, tables[0].controlIdx, 0)).toContain("사업장");
      expect(getHwpCellText(reloaded, tables[0].paraIdx, tables[0].controlIdx, 1)).toContain("테스트 건설");
      expect(getHwpCellText(reloaded, tables[1].paraIdx, tables[1].controlIdx, 0)).toContain("연번");
      expect(getHwpCellText(reloaded, tables[1].paraIdx, tables[1].controlIdx, 1)).toContain("항목");
      expect(getHwpCellText(reloaded, tables[1].paraIdx, tables[1].controlIdx, 4)).toBe("1");
      expect(getHwpCellText(reloaded, tables[2].paraIdx, tables[2].controlIdx, 0)).toContain("작성자");
      expect(getHwpCellText(reloaded, tables[2].paraIdx, tables[2].controlIdx, 1)).toContain("관리감독자");

      const approvalLabelPara = tables[2].paraIdx - 1;
      const approvalLabelLength = reloaded.getParagraphLength(0, approvalLabelPara);
      expect(reloaded.getTextRange(0, approvalLabelPara, 0, approvalLabelLength)).toContain("확인 및 서명");
    } finally {
      reloaded.free();
    }
  });

  it("localizes structured risk and verification enums in a reloaded HWP", async () => {
    const response = await exportHwp(new NextRequest("http://localhost/api/export/hwp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "위험성평가표",
        profile: { layout: "risk" },
        scenario: { companyName: "테스트 건설", siteName: "제1현장", workSummary: "비계 작업", workerCount: 4 },
        structuredRiskRows: [
          {
            unitTask: "비계 조립",
            hazard: "추락",
            currentControls: "KOSHA 자료: 연결됨",
            riskLevel: "high",
            additionalControls: "조치가 연결됨 / 배관이 연결됨",
            status: "planned"
          },
          { unitTask: "전기 점검", hazard: "감전", riskLevel: "medium", additionalControls: "잠금 표지", status: "done" },
          { unitTask: "자재 정리", hazard: "전도", riskLevel: "low", additionalControls: "통로 확보", status: "needsReview" }
        ]
      })
    }));

    expect(response.status).toBe(200);
    const reloaded = new HwpDocument(new Uint8Array(await response.arrayBuffer()));
    try {
      const bodyTable = listHwpTables(reloaded)[1];
      const dimensions = JSON.parse(reloaded.getTableDimensions(0, bodyTable.paraIdx, bodyTable.controlIdx)) as {
        colCount: number;
        rowCount: number;
      };
      const header = Array.from({ length: dimensions.colCount }, (_, cellIdx) => (
        getHwpCellText(reloaded, bodyTable.paraIdx, bodyTable.controlIdx, cellIdx)
      )).join(" ");
      const values = Array.from({ length: (dimensions.rowCount - 1) * dimensions.colCount }, (_, offset) => (
        getHwpCellText(reloaded, bodyTable.paraIdx, bodyTable.controlIdx, dimensions.colCount + offset)
      )).join(" ");

      expect(header).toContain("상태");
      for (const localized of ["상", "중", "하", "조치 예정", "조치 완료", "검토 필요"]) {
        expect(values).toContain(localized);
      }
      expect(values).not.toMatch(/\b(?:high|medium|low|planned|done|needsReview)\b/u);
      expect(values).not.toContain("KOSHA 자료: 연결됨");
      expect(values).not.toContain("조치가 연결됨");
      expect(values).toContain("배관이 연결됨");
    } finally {
      reloaded.free();
    }
  });

  it("localizes HTML PDF table headers and typed 4M values", async () => {
    const response = await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "위험성평가표",
        scenario: { companyName: "테스트 건설", siteName: "제1현장", workSummary: "비계 작업", workerCount: 4 },
        rows: [{ document: "위험성평가표", section: "위험", item: "추락", content: "비계 작업 중 추락" }]
      })
    }));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<th class=\"no\">연번</th>");
    expect(html).toContain("인적 요인/기계·설비 요인/작업환경 요인/관리 요인");
    expect(html).not.toContain(">No.<");
    expect(html).not.toContain("Man/Machine/Media/Management");
  });

  it("localizes structured PDF risk and verification enums in HTML", async () => {
    const response = await exportPdf(new NextRequest("http://localhost/api/export/pdf?format=html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "위험성평가표",
        riskLevel: "low",
        scenario: { companyName: "테스트 건설", siteName: "제1현장", workSummary: "비계 작업", workerCount: 4 },
        structuredRiskRows: [
          {
            unitTask: "비계 조립",
            hazard: "추락",
            currentControls: "KOSHA 자료: 연결됨",
            riskLevel: "high",
            additionalControls: "조치가 연결됨 / 배관이 연결됨",
            status: "planned"
          },
          { unitTask: "전기 점검", hazard: "감전", riskLevel: "medium", additionalControls: "잠금 표지", status: "done" },
          { unitTask: "자재 정리", hazard: "전도", riskLevel: "low", additionalControls: "통로 확보", status: "needsReview" }
        ]
      })
    }));

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("위험수준 하");
    for (const localized of ["상", "중", "하", "조치 예정", "조치 완료", "검토 필요"]) {
      expect(html).toContain(`>${localized}</td>`);
    }
    expect(html).not.toMatch(/>\s*(?:high|medium|low|planned|done|needsReview)\s*</u);
    expect(html).not.toContain("KOSHA 자료: 연결됨");
    expect(html).not.toContain("조치가 연결됨");
    expect(html).toContain("배관이 연결됨");
  });
});
