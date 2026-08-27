import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentExportLimitError } from "@/lib/document-export-budget";

const mocks = vi.hoisted(() => ({
  buildHwpxFromTemplate: vi.fn()
}));

vi.mock("@/lib/hwpx-template", () => ({
  buildHwpxFromTemplate: mocks.buildHwpxFromTemplate,
  isValidTemplateKind: (kind: string) => kind === "risk-assessment",
  listAvailableTemplates: () => [],
  TEMPLATE_LABELS: { "risk-assessment": "위험성평가표" }
}));

import { GET } from "@/app/api/export/hwpx-template/route";

function request(): NextRequest {
  return new NextRequest(
    "http://localhost/api/export/hwpx-template?kind=risk-assessment&companyName=SafeClaw",
    { headers: { "x-forwarded-for": "198.51.100.90" } }
  );
}

describe("HWPX template export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the bounded export response for template limit errors", async () => {
    mocks.buildHwpxFromTemplate.mockImplementationOnce(() => {
      throw new DocumentExportLimitError("hwpx_output_bytes");
    });

    const response = await GET(request());

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "DOCUMENT_EXPORT_LIMIT_EXCEEDED",
      message: "문서 내보내기 요청이 허용된 크기 한도를 초과했습니다."
    });
  });

  it("logs internal archive errors without reflecting details to the client", async () => {
    const error = new Error("invalid central directory at C:\\private\\templates\\risk.hwpx");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.buildHwpxFromTemplate.mockImplementationOnce(() => {
      throw error;
    });

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "HWPX 양식을 만들지 못했습니다."
    });
    expect(consoleError).toHaveBeenCalledWith("HWPX template export failed", error);
    consoleError.mockRestore();
  });
});
