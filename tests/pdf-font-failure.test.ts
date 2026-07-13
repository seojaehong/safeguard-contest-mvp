import fs, { type PathOrFileDescriptor } from "node:fs";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/export/pdf/route";

const payload = {
  title: "위험성평가표",
  scenario: {
    companyName: "가온테크",
    siteName: "1차 작업장",
    workSummary: "천장 배관 점검",
    workerCount: 4,
    weatherNote: "맑음"
  },
  rows: [
    {
      document: "위험성평가표",
      section: "유해·위험요인",
      item: "추락",
      content: "안전대를 체결합니다."
    }
  ]
};

function createRequest(format?: "html"): NextRequest {
  const suffix = format ? `?format=${format}` : "";
  return new NextRequest(`http://localhost/api/export/pdf${suffix}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function expectControlledFontFailure(response: Response): Promise<void> {
  expect(response.status).toBe(500);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    ok: false,
    code: "PDF_FONT_ASSET_UNAVAILABLE",
    message: "PDF 글꼴 자산을 확인하지 못해 문서를 만들지 못했습니다."
  });
}

describe.sequential("PDF font asset failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs and returns controlled JSON 500 when a traced font is missing", async () => {
    const originalReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file: PathOrFileDescriptor) => {
      if (String(file).includes("NotoSansKR-Regular.ttf")) {
        const error = new Error(`ENOENT: no such file or directory, open '${String(file)}'`);
        Object.assign(error, { code: "ENOENT" });
        throw error;
      }
      return originalReadFileSync(file);
    }) as typeof fs.readFileSync);
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expectControlledFontFailure(await POST(createRequest()));
    const logged = logger.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain('"errorType":"PdfFontAssetError"');
    expect(logged).toContain('"errorCode":"PDF_FONT_ASSET_UNAVAILABLE"');
    expect(logged).not.toContain("NotoSansKR-Regular.ttf");
  });

  it("logs and returns controlled JSON 500 when a traced font is invalid", async () => {
    const originalReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file: PathOrFileDescriptor) => {
      if (String(file).includes("NotoSansKR-")) return Buffer.from("not-a-valid-ttf");
      return originalReadFileSync(file);
    }) as typeof fs.readFileSync);
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expectControlledFontFailure(await POST(createRequest()));
    const logged = logger.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain('"errorType":"PdfFontAssetError"');
    expect(logged).toContain('"errorCode":"PDF_FONT_ASSET_UNAVAILABLE"');
    expect(logged).not.toContain("not-a-valid-ttf");
  });

  it("logs and rethrows non-font create, page, and save failures", async () => {
    const cases: Array<{
      label: string;
      install: (failure: Error) => void;
    }> = [
      {
        label: "create",
        install: (failure) => {
          vi.spyOn(PDFDocument, "create").mockRejectedValueOnce(failure);
        },
      },
      {
        label: "page",
        install: (failure) => {
          vi.spyOn(PDFDocument.prototype, "addPage").mockImplementationOnce(() => {
            throw failure;
          });
        },
      },
      {
        label: "save",
        install: (failure) => {
          vi.spyOn(PDFDocument.prototype, "save").mockRejectedValueOnce(failure);
        },
      },
    ];

    for (const testCase of cases) {
      const failure = new Error(`C:\\private\\pdf-${testCase.label} secret-pdf-token`);
      testCase.install(failure);
      const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(POST(createRequest())).rejects.toBe(failure);
      const logged = logger.mock.calls.flat().map(String).join("\n");
      expect(logged).toContain('"errorType":"Error"');
      expect(logged).toContain('"errorCode":"PDF_EXPORT_FAILED"');
      expect(logged).not.toContain("private");
      expect(logged).not.toContain("secret-pdf-token");
      vi.restoreAllMocks();
    }
  });

  it("maps a typed font embed failure to the controlled font response", async () => {
    const embedFailure = new Error("C:\\private\\font-reference secret-font-token");
    vi.spyOn(PDFDocument.prototype, "embedFont").mockRejectedValueOnce(embedFailure);
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expectControlledFontFailure(await POST(createRequest()));
    const logged = logger.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain('"errorType":"PdfFontAssetError"');
    expect(logged).toContain('"errorCode":"PDF_FONT_ASSET_UNAVAILABLE"');
    expect(logged).not.toContain("private");
    expect(logged).not.toContain("secret-font-token");
  });

  it("keeps HTML export available when binary font assets are unavailable", async () => {
    vi.spyOn(fs, "accessSync").mockImplementation(() => {
      throw new Error("font unavailable");
    });

    const response = await POST(createRequest("html"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain("가온테크");
  });
});
