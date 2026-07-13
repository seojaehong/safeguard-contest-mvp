import fs, { type PathOrFileDescriptor } from "node:fs";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildXlsxForDocument: vi.fn(),
}));

vi.mock("@/lib/xlsx-builder", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/xlsx-builder")>();
  return {
    ...original,
    buildXlsxForDocument: mocks.buildXlsxForDocument,
  };
});

function request(pathname: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectSafeExportFailure(
  response: Response,
  code: string,
  message: string,
  forbidden: readonly string[],
): Promise<void> {
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const text = await response.text();
  expect(JSON.parse(text)).toEqual({ ok: false, code, message });
  forbidden.forEach((value) => expect(text).not.toContain(value));
}

describe.sequential("export API safe error contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.buildXlsxForDocument.mockReset();
  });

  it("keeps HWP candidate paths and internal messages out of its public error and log", async () => {
    const leakedPath = "C:\\Users\\private\\node_modules\\@rhwp\\core\\rhwp_bg.wasm";
    const secret = "hwp-internal-secret";
    const originalReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file: PathOrFileDescriptor, ...args: unknown[]) => {
      if (String(file).endsWith("rhwp_bg.wasm")) throw new Error(`${leakedPath} ${secret}`);
      return Reflect.apply(originalReadFileSync, fs, [file, ...args]);
    }) as typeof fs.readFileSync);
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/export/hwp/route");

    const response = await POST(request("/api/export/hwp", {
      title: "위험성평가표",
      rows: [{ item: "추락", content: "안전대 확인" }],
    }));

    await expectSafeExportFailure(
      response,
      "HWP_EXPORT_FAILED",
      "HWP 문서를 만들지 못했습니다.",
      [leakedPath, secret, "rhwp WASM not found"],
    );
    const logged = logger.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain('"errorType":"Error"');
    expect(logged).toContain('"errorCode":"HWP_EXPORT_FAILED"');
    expect(logged).not.toContain(leakedPath);
    expect(logged).not.toContain(secret);
  });

  it("keeps XLSX builder paths and internal messages out of its public error and log", async () => {
    const leakedPath = "C:\\internal\\xlsx\\template.xlsx";
    const secret = "xlsx-private-token";
    mocks.buildXlsxForDocument.mockRejectedValueOnce(new Error(`${leakedPath} ${secret}`));
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/export/xlsx/route");

    const response = await POST(request("/api/export/xlsx", {
      mode: "single",
      title: "작업계획서",
      rows: [{ item: "순서", content: "작업 전 확인" }],
    }));

    await expectSafeExportFailure(
      response,
      "XLSX_EXPORT_FAILED",
      "XLSX 문서를 만들지 못했습니다.",
      [leakedPath, secret],
    );
    const logged = logger.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain('"errorType":"Error"');
    expect(logged).toContain('"errorCode":"XLSX_EXPORT_FAILED"');
    expect(logged).not.toContain(leakedPath);
    expect(logged).not.toContain(secret);
  });

  it("does not echo an invalid HWPX kind containing an internal-looking path", async () => {
    const leakedKind = "..%2F..%2FC:%5Cprivate%5Ctemplate.hwpx";
    const { GET } = await import("@/app/api/export/hwpx-template/route");
    const response = await GET(new NextRequest(
      `http://localhost/api/export/hwpx-template?kind=${leakedKind}`,
    ));
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(text)).toMatchObject({
      ok: false,
      code: "HWPX_TEMPLATE_KIND_INVALID",
      message: "지원하지 않는 HWPX 양식 종류입니다.",
    });
    expect(text).not.toContain("private");
    expect(text).not.toContain("template.hwpx");
  });
});
