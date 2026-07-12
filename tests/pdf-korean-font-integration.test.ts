import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/pdf/route";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const gitignorePath = path.join(root, ".gitignore");
const routePath = path.join(root, "app/api/export/pdf/route.ts");
const fontPaths = [
  path.join(root, "public/fonts/NotoSansKR-Regular.ttf"),
  path.join(root, "public/fonts/NotoSansKR-Bold.ttf")
] as const;
const licensePath = path.join(root, "public/fonts/NotoSansKR-OFL.txt");

const payload = {
  title: "위험성평가표",
  scenario: {
    companyName: "가온테크",
    siteName: "1차 작업장",
    workSummary: "천장 배관 점검",
    workerCount: 4,
    weatherNote: "맑음"
  },
  riskLevel: "상",
  topRisk: "고소 작업 중 추락 위험",
  rows: [
    {
      document: "위험성평가표",
      section: "유해·위험요인",
      item: "추락",
      content: "안전대를 체결하고 작업발판을 점검합니다."
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

describe("Korean PDF font integration", () => {
  it("declares deterministic PDF dependencies and tracks the generated lock", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies?.["@pdf-lib/fontkit"]).toBe("^1.1.1");
    expect(packageJson.dependencies?.["pdf-lib"]).toBe("^1.17.1");
    expect(packageJson.devDependencies?.["@napi-rs/canvas"]).toBe("^1.0.2");
    expect(packageJson.devDependencies?.["pdfjs-dist"]).toBe("^5.4.624");

    const gitignore = fs.readFileSync(gitignorePath, "utf8");
    expect(gitignore.split(/\r?\n/u)).not.toContain("package-lock.json");
    expect(fs.existsSync(packageLockPath)).toBe(true);
  });

  it("ships the licensed Korean Regular and Bold TrueType assets", () => {
    const expectedMetadata = [
      { path: fontPaths[0], postscriptName: "NotoSansKR-Regular", subfamilyName: "Regular" },
      { path: fontPaths[1], postscriptName: "NotoSansKR-Bold", subfamilyName: "Bold" }
    ];
    for (const expected of expectedMetadata) {
      const fontPath = expected.path;
      expect(fs.existsSync(fontPath)).toBe(true);
      if (!fs.existsSync(fontPath)) continue;
      const font = fs.readFileSync(fontPath);
      expect(font.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x01, 0x00, 0x00]));
      expect(font.length).toBeGreaterThan(1_000_000);
      const parsed = fontkit.create(font);
      expect(parsed.familyName).toBe("Noto Sans KR");
      expect(parsed.postscriptName).toBe(expected.postscriptName);
      expect(parsed.subfamilyName).toBe(expected.subfamilyName);
    }
    expect(fs.existsSync(licensePath)).toBe(true);
    if (!fs.existsSync(licensePath)) return;
    expect(fs.readFileSync(licensePath, "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("uses literal Vercel trace paths and a controlled font failure contract", () => {
    const source = fs.readFileSync(routePath, "utf8");
    for (const asset of [
      "public/fonts/NotoSansKR-Regular.ttf",
      "public/fonts/NotoSansKR-Bold.ttf",
      "public/fonts/NotoSansKR-OFL.txt"
    ]) {
      expect(source).toContain(`path.join(process.cwd(), "${asset}")`);
    }
    expect(source).toContain("class PdfFontAssetError extends Error");
    expect(source).toContain('console.error("PDF export font assets are unavailable or invalid", error.source)');
    expect(source).toContain('console.error("PDF export failed", error)');
    expect(source).toContain('error: "PDF_FONT_ASSET_UNAVAILABLE"');
  });

  it("maps title, section, body, table, and note roles to Regular and Bold subsets", () => {
    const source = fs.readFileSync(routePath, "utf8");
    for (const role of ["title", "section", "body", "table", "note"]) {
      expect(source).toContain(`role: "${role}"`);
    }
    expect(source).toContain('title: { font: "F2", size: 20, leading: 24, tracking: -0.4 }');
    expect(source).toContain('section: { font: "F2", size: 14, leading: 18, tracking: -0.14 }');
    expect(source).toContain('body: { font: "F1", size: 10, leading: 15, tracking: 0 }');
    expect(source).toContain('table: { font: "F1", size: 8.5, leading: 12, tracking: 0 }');
    expect(source).toContain('note: { font: "F1", size: 8, leading: 11, tracking: 0 }');
    expect(source).toContain("embedFont(fonts.regular, { subset: true })");
    expect(source).toContain("embedFont(fonts.bold, { subset: true })");
  });

  it("renders bounded subset PDF with extractable Korean text and a nonblank first page", async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="safeclaw-document.pdf"; filename*=UTF-8''${encodeURIComponent("가온테크-위험성평가표.pdf")}`
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    const binary = Buffer.from(await response.arrayBuffer());
    expect(binary.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(binary.length).toBeLessThan(1_048_576);
    const source = binary.toString("binary");
    expect(source).toContain("/Subtype /CIDFontType2");
    expect(source).toContain("/FontFile2");
    expect(source).toContain("/ToUnicode");
    expect(source).toMatch(/\/BaseFont \/NotoSansKR-Regular-[A-Z0-9]+/u);
    expect(source).toMatch(/\/BaseFont \/NotoSansKR-Bold-[A-Z0-9]+/u);
    expect(source).not.toContain("HYSMyeongJo");
    expect(source).not.toContain("UniKS-UCS2-H");
    expect(source).not.toContain("/Subtype /CIDFontType0");

    const smallestSourceFont = Math.min(...fontPaths.map((fontPath) => fs.statSync(fontPath).size));
    expect(binary.length).toBeLessThan(smallestSourceFont / 4);

    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: new Uint8Array(binary) }).promise;
    expect(document.numPages).toBe(1);
    const page = await document.getPage(1);
    const textContent = await page.getTextContent();
    const extracted = textContent.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ");
    for (const value of [
      "위험성평가표",
      "가온테크",
      "1차 작업장",
      "천장 배관 점검",
      "고소 작업 중 추락 위험",
      "작성자",
      "승인"
    ]) {
      expect(extracted).toContain(value);
    }
    expect(extracted).not.toContain("�");

    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as never,
      canvasContext: context as never,
      viewport
    }).promise;
    const titleRegion = context.getImageData(30, 28, Math.min(520, canvas.width - 30), 90);
    let opaqueDarkPixels = 0;
    for (let index = 0; index < titleRegion.data.length; index += 4) {
      const alpha = titleRegion.data[index + 3];
      if (
        alpha > 0
        && (titleRegion.data[index] < 220 || titleRegion.data[index + 1] < 220 || titleRegion.data[index + 2] < 220)
      ) {
        opaqueDarkPixels += 1;
      }
    }
    expect(opaqueDarkPixels).toBeGreaterThan(100);
    await document.destroy();
  });

  it("renders readable Korean line geometry across each extracted line", async () => {
    const response = await POST(createRequest());
    const binary = Buffer.from(await response.arrayBuffer());

    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: new Uint8Array(binary) }).promise;
    const page = await document.getPage(1);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as never,
      canvasContext: context as never,
      viewport
    }).promise;
    const textContent = await page.getTextContent();
    const metrics: Array<{
      text: string;
      darkPixelsPerCharacter: number;
      occupiedBucketRatio: number;
    }> = [];

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const characters = Array.from(item.str);
      const koreanCharacterCount = characters.filter((character) => /[\u3131-\u318E\uAC00-\uD7A3]/u.test(character)).length;
      const nonWhitespaceCharacterCount = characters.filter((character) => !/\s/u.test(character)).length;
      if (koreanCharacterCount < 4 || nonWhitespaceCharacterCount === 0) continue;

      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      const x = Math.max(0, Math.floor(transform[4]));
      const fontHeight = Math.max(1, Math.ceil(Math.hypot(transform[2], transform[3])));
      const y = Math.max(0, Math.floor(transform[5] - fontHeight * 1.2));
      const width = Math.min(Math.max(1, Math.ceil(item.width * scale)), canvas.width - x);
      const height = Math.min(Math.ceil(fontHeight * 1.5), canvas.height - y);
      const pixels = context.getImageData(x, y, width, height).data;
      const bucketCount = Math.min(nonWhitespaceCharacterCount, 32);
      const bucketDarkPixels = Array.from({ length: bucketCount }, () => 0);
      let darkPixels = 0;

      for (let pixelY = 0; pixelY < height; pixelY += 1) {
        for (let pixelX = 0; pixelX < width; pixelX += 1) {
          const offset = (pixelY * width + pixelX) * 4;
          if (
            pixels[offset + 3] > 0
            && (pixels[offset] < 200 || pixels[offset + 1] < 200 || pixels[offset + 2] < 200)
          ) {
            darkPixels += 1;
            const bucket = Math.min(bucketCount - 1, Math.floor(pixelX * bucketCount / width));
            bucketDarkPixels[bucket] += 1;
          }
        }
      }

      metrics.push({
        text: item.str,
        darkPixelsPerCharacter: darkPixels / nonWhitespaceCharacterCount,
        occupiedBucketRatio: bucketDarkPixels.filter((count) => count >= 3).length / bucketCount
      });
    }

    expect(metrics.length).toBeGreaterThanOrEqual(10);
    for (const metric of metrics) {
      expect(metric.darkPixelsPerCharacter, metric.text).toBeGreaterThan(45);
      expect(metric.occupiedBucketRatio, metric.text).toBeGreaterThanOrEqual(0.75);
    }
    await document.destroy();
  });

  it("preserves canonical structured risk rows in extracted binary PDF text", async () => {
    const structuredPayload = {
      ...payload,
      rows: [],
      structuredRiskRows: [
        {
          id: "R-01",
          process: "배관 공정",
          unitTask: "천장 배관 점검",
          hazard: "누전으로 인한 감전",
          currentControls: "분전반 전원 차단",
          riskLevel: "상",
          additionalControls: "잠금표지 후 검전",
          owner: "작업반장",
          dueDate: "작업 전",
          status: "조치예정"
        }
      ]
    };
    const response = await POST(new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(structuredPayload)
    }));

    expect(response.status).toBe(200);
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await response.arrayBuffer())
    }).promise;
    const page = await document.getPage(1);
    const textContent = await page.getTextContent();
    const extracted = textContent.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ");
    for (const value of [
      "배관 공정",
      "천장 배관 점검",
      "누전으로 인한 감전",
      "분전반 전원 차단",
      "잠금표지 후 검전",
      "작업반장",
      "작업 전"
    ]) {
      expect(extracted).toContain(value);
    }
    await document.destroy();
  });

  it("keeps the HTML export contract available independently", async () => {
    const response = await POST(createRequest("html"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="safeclaw-pdf-ready.html"; filename*=UTF-8''${encodeURIComponent("가온테크-위험성평가표.html")}`
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    for (const value of ["위험성평가표", "가온테크", "1차 작업장", "천장 배관 점검"]) {
      expect(html).toContain(value);
    }
  });
});
