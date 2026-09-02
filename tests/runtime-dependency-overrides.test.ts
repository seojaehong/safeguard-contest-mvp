import ExcelJS from "exceljs";
import { Gaxios, type GaxiosOptions, type GaxiosResponse } from "gaxios";
import { describe, expect, it } from "vitest";

import packageJson from "@/package.json";

type XlsxLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

describe("runtime dependency overrides", () => {
  it("pins the reviewed patched transitive versions", () => {
    expect(packageJson.overrides).toMatchObject({
      "@hono/node-server": "2.0.12",
      "archiver": "8.0.0",
      "fast-uri": "3.1.6",
      "postcss": "8.5.23",
      "sharp": "0.35.3",
      "unzipper": "0.12.1",
      "uuid": "11.1.1"
    });
  });

  it("keeps the ExcelJS CommonJS UUID path working for extended conditional formatting", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Risk");
    worksheet.addRows([[1], [2], [3]]);
    worksheet.addConditionalFormatting({
      ref: "A1:A3",
      rules: [{
        type: "dataBar",
        priority: 1,
        cfvo: [
          { type: "min" },
          { type: "max" }
        ]
      }]
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer as XlsxLoadBuffer);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(reloaded.getWorksheet("Risk")?.getCell("A3").value).toBe(3);
  });

  it("keeps the gaxios multipart UUID boundary path working", async () => {
    let preparedOptions: GaxiosOptions | undefined;
    const client = new Gaxios();

    const response = await client.request<null>({
      url: "https://example.invalid/upload",
      method: "POST",
      multipart: [{
        headers: { "Content-Type": "application/json" },
        content: JSON.stringify({ ready: true })
      }],
      adapter: async <T>(options: GaxiosOptions): Promise<GaxiosResponse<T>> => {
        preparedOptions = options;
        return {
          config: options,
          data: null as T,
          status: 200,
          statusText: "OK",
          headers: {},
          request: { responseURL: options.url?.toString() ?? "" }
        };
      }
    });

    const contentType = preparedOptions?.headers?.["Content-Type"];
    expect(response.status).toBe(200);
    expect(contentType).toMatch(
      /^multipart\/related; boundary=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
