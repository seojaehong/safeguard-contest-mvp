import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/pdf/route";

const scenario = {
  companyName: "세이프건설",
  siteName: "서울 성수동 근린생활시설 현장",
  workSummary: "정화조 내부 청소 작업",
  workerCount: 4,
  weatherNote: "맑음"
};

function riskRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    document: "위험성평가표",
    section: "위험요인",
    item: `위험요인 ${index + 1}`,
    content: `정화조 질식 위험 ${index + 1}: 산소 농도 측정 후 환기`
  }));
}

function tbmRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    document: "TBM/작업 전 안전점검회의",
    section: "전달사항",
    item: `전달 ${index + 1}`,
    content: `작업 전 확인 ${index + 1}`
  }));
}

function pdfRequest(body: Record<string, unknown>, format?: "html") {
  const suffix = format ? `?format=${format}` : "";
  return new NextRequest(`http://localhost/api/export/pdf${suffix}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("/api/export/pdf realistic row budget", () => {
  it("accepts a risk assessment whose rows are also sent as linked riskRows (70 + 70)", async () => {
    const rows = riskRows(70);
    const response = await POST(pdfRequest({
      title: "위험성평가표",
      scenario,
      rows,
      riskRows: rows.map((row) => ({ ...row })),
      riskLevel: "high",
      topRisk: "정화조 질식"
    }, "html"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("정화조 질식 위험");
  });

  it("accepts a TBM document with 70 delivery rows and 70 linked risk rows", async () => {
    const response = await POST(pdfRequest({
      title: "TBM/작업 전 안전점검회의",
      scenario,
      rows: tbmRows(70),
      riskRows: riskRows(70)
    }, "html"));

    expect(response.status).toBe(200);
  });

  it("ignores an oversized documentText when explicit rows are present", async () => {
    const response = await POST(pdfRequest({
      title: "외국인 근로자 출력본",
      scenario,
      rows: tbmRows(10).map((row) => ({ ...row, document: "외국인 근로자 출력본" })),
      documentText: "본문 ".repeat(2_000)
    }, "html"));

    expect(response.status).toBe(200);
  });

  it("still rejects a single row array above the per-array budget", async () => {
    const response = await POST(pdfRequest({
      title: "위험성평가표",
      scenario,
      rows: riskRows(129)
    }, "html"));

    expect(response.status).toBe(413);
  });
});

describe("/api/export/pdf binary realistic row budget", () => {
  it("renders the 70 + 70 risk assessment request as binary PDF", async () => {
    const rows = riskRows(70);
    const response = await POST(pdfRequest({
      title: "위험성평가표",
      scenario,
      rows,
      riskRows: rows.map((row) => ({ ...row }))
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
  }, 60_000);
});
