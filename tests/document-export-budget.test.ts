import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as exportHwp } from "@/app/api/export/hwp/route";
import { POST as exportXlsx } from "@/app/api/export/xlsx/route";
import { DOCUMENT_EXPORT_BUDGETS } from "@/lib/document-export-budget";

const scenario = {
  companyName: "가온테크",
  siteName: "1공구",
  workSummary: "배관 점검",
  workerCount: 4,
  weatherNote: "맑음"
};

const baseRow = {
  document: "위험성평가표",
  section: "유해·위험요인",
  item: "추락",
  content: "안전대를 체결하고 작업발판을 점검합니다."
};

function request(pathname: "hwp" | "xlsx", body: unknown, headers?: HeadersInit): NextRequest {
  return new NextRequest(`http://localhost/api/export/${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

async function expectDocumentPayloadTooLarge(response: Response): Promise<void> {
  expect(response.status).toBe(413);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    ok: false,
    code: "DOCUMENT_EXPORT_LIMIT_EXCEEDED",
    message: "문서 내보내기 요청이 허용된 크기 한도를 초과했습니다."
  });
}

describe("document export resource budgets", () => {
  it("rejects XLSX request bodies above the byte budget before workbook allocation", async () => {
    const response = await exportXlsx(request("xlsx", {
      mode: "single",
      scenario,
      title: "위험성평가표",
      rows: [baseRow]
    }, { "content-length": String(DOCUMENT_EXPORT_BUDGETS.requestBytes + 1) }));

    await expectDocumentPayloadTooLarge(response);
  });

  it.each([
    "single",
    "workPlanStructured",
    "permitInspectionStructured",
    "tbmBriefingStructured",
    "tbmLogStructured",
    "educationRecordStructured"
  ])("rejects XLSX %s row counts above the document budget", async (mode) => {
    const rows = Array.from({ length: DOCUMENT_EXPORT_BUDGETS.rows + 1 }, (_, index) => ({
      ...baseRow,
      item: `위험요인 ${index + 1}`
    }));
    const payload = mode === "single"
      ? { mode, scenario, title: "위험성평가표", rows }
      : { mode, scenario, edited: true, structured: { title: mode }, rows };

    await expectDocumentPayloadTooLarge(await exportXlsx(request("xlsx", payload)));
  });

  it("rejects XLSX workpacks above the document budget", async () => {
    const documents = Array.from({ length: DOCUMENT_EXPORT_BUDGETS.documents + 1 }, (_, index) => ({
      title: `문서 ${index + 1}`,
      rows: [baseRow]
    }));

    await expectDocumentPayloadTooLarge(await exportXlsx(request("xlsx", {
      mode: "workpack",
      scenario,
      documents
    })));
  });

  it("rejects HWP row counts above the document budget before HWP allocation", async () => {
    const rows = Array.from({ length: DOCUMENT_EXPORT_BUDGETS.rows + 1 }, (_, index) => ({
      ...baseRow,
      item: `위험요인 ${index + 1}`
    }));

    await expectDocumentPayloadTooLarge(await exportHwp(request("hwp", {
      scenario,
      title: "위험성평가표",
      rows
    })));
  });

  it("rejects HWP fields above the character budget instead of shortening them", async () => {
    await expectDocumentPayloadTooLarge(await exportHwp(request("hwp", {
      scenario,
      title: "가".repeat(DOCUMENT_EXPORT_BUDGETS.fieldCharacters + 1),
      rows: [baseRow]
    })));
  });

  it("preserves valid bounded XLSX and HWP exports", async () => {
    const payload = {
      scenario,
      title: "위험성평가표",
      rows: [baseRow]
    };
    const xlsxResponse = await exportXlsx(request("xlsx", { ...payload, mode: "single" }));
    const hwpResponse = await exportHwp(request("hwp", payload));

    expect(xlsxResponse.status).toBe(200);
    expect(xlsxResponse.headers.get("content-type")).toContain("spreadsheetml");
    expect(Buffer.from(await xlsxResponse.arrayBuffer()).length).toBeGreaterThan(1_000);

    expect(hwpResponse.status).toBe(200);
    expect(hwpResponse.headers.get("content-type")).toBe("application/x-hwp");
    expect(Buffer.from(await hwpResponse.arrayBuffer()).subarray(0, 8).toString("hex")).toBe("d0cf11e0a1b11ae1");
  });
});
