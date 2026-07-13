import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/pdf/route";
import {
  SFNT_CHECKSUM_MAGIC,
  extractFinalFontFile2Streams,
  validateSfntChecksums
} from "@/tests/helpers/pdf-font-checksum";
import { measureRasterGeometry } from "@/tests/helpers/pdf-visual-geometry";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const gitignorePath = path.join(root, ".gitignore");
const routePath = path.join(root, "app/api/export/pdf/route.ts");
const evidencePath = path.join(root, "evaluation/release-pdf-render-remediation-2026-07-12");
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
  return createRequestForPayload(payload, format);
}

function createRequestForPayload(value: unknown, format?: "html"): NextRequest {
  const suffix = format ? `?format=${format}` : "";
  return new NextRequest(`http://localhost/api/export/pdf${suffix}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value)
  });
}

async function expectPayloadTooLarge(response: Response): Promise<void> {
  expect(response.status).toBe(413);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    ok: false,
    code: "PDF_EXPORT_LIMIT_EXCEEDED",
    message: "PDF 내보내기 요청이 허용된 크기 한도를 초과했습니다."
  });
}

describe("Korean PDF font integration", () => {
  it("keeps committed PDF evidence free of local absolute paths", () => {
    const evidenceFiles = fs.readdirSync(evidencePath, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name));
    const leakedPaths = evidenceFiles.flatMap((filePath) => {
      const content = fs.readFileSync(filePath).toString("latin1");
      const hasLocalPath = /\.(?:json|log|md)$/u.test(filePath)
        ? /(?:[A-Za-z]:[\\/]|[/\\]Users[/\\]|[/\\]home[/\\])/u.test(content)
        : /(?:[A-Za-z]:[\\/]Users[\\/]|[/\\](?:Users|home)[/\\]|[A-Za-z]:[\\/][^\r\n\0]{0,240}\.worktrees[\\/])/u.test(content);
      return hasLocalPath
        ? [path.relative(root, filePath).replaceAll("\\", "/")]
        : [];
    });

    expect(leakedPaths).toEqual([]);
  });

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

  it("paginates long content and preserves the final row and document footer", async () => {
    const sentinel = "마지막행보존확인";
    const longPayload = {
      ...payload,
      rows: Array.from({ length: 64 }, (_, index) => ({
        document: "위험성평가표",
        section: "전체 위험요인",
        item: `위험요인 ${index + 1}`,
        content: index === 63
          ? `${sentinel} 최종 감소대책을 현장에서 확인합니다.`
          : `작업 단계 ${index + 1}의 위험요인과 감소대책을 현장에서 확인합니다.`
      }))
    };
    const response = await POST(new NextRequest("http://localhost/api/export/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(longPayload)
    }));

    expect(response.status).toBe(200);
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await response.arrayBuffer())
    }).promise;
    expect(document.numPages).toBeGreaterThan(1);

    const extractedPages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      extractedPages.push(textContent.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
    }

    expect(extractedPages[0]).toContain("위험성평가표");
    expect(extractedPages.at(-1)).toContain(sentinel);
    expect(extractedPages.at(-1)).toContain("작성자");
    expect(extractedPages.at(-1)).toContain("승인");
    expect(extractedPages.at(-1)).toContain("본 출력물은 공식자료 기반 현장 검토용 초안입니다.");
    await document.destroy();
  });

  it("preserves TBM delivery rows alongside linked risk-assessment rows", async () => {
    const response = await POST(createRequestForPayload({
      ...payload,
      title: "TBM 일지",
      riskRows: [{
        document: "위험성평가표",
        section: "유해·위험요인",
        item: "추락",
        content: "추락위험근거행"
      }],
      rows: [{
        document: "TBM 일지",
        section: "전달사항",
        item: "작업중지 기준",
        content: "작업중지복창행"
      }]
    }));

    expect(response.status).toBe(200);
    Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(await response.arrayBuffer())
    }).promise;
    const extractedPages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      extractedPages.push(textContent.items.flatMap((item) => "str" in item ? [item.str] : []).join(" "));
    }
    const extracted = extractedPages.join(" ");

    expect(extracted).toContain("추락위험근거행");
    expect(extracted).toContain("작업중지복창행");
    expect(extracted).toContain("위험성평가표 → TBM");
    expect(extracted).toContain("TBM 전달사항");
    await document.destroy();
  });

  it("rejects request bodies above the byte budget instead of truncating them", async () => {
    const padding = Object.fromEntries(
      Array.from({ length: 70 }, (_, index) => [`padding${index}`, "x".repeat(4_000)])
    );

    await expectPayloadTooLarge(await POST(createRequestForPayload({ ...payload, padding })));
  });

  it("rejects row counts above the budget instead of dropping trailing rows", async () => {
    const oversizedRows = Array.from({ length: 129 }, (_, index) => ({
      document: "위험성평가표",
      section: "전체 위험요인",
      item: `위험요인 ${index + 1}`,
      content: `작업 단계 ${index + 1}의 감소대책을 확인합니다.`
    }));

    await expectPayloadTooLarge(await POST(createRequestForPayload({ ...payload, rows: oversizedRows })));
  });

  it("rejects fields above the character budget instead of shortening them", async () => {
    await expectPayloadTooLarge(await POST(createRequestForPayload({
      ...payload,
      title: "가".repeat(4_001)
    })));
  });

  it("rejects render workloads above the line or page budget instead of clipping output", async () => {
    const expensiveRows = Array.from({ length: 128 }, (_, index) => ({
      document: "위험성평가표",
      section: "전체 위험요인",
      item: `위험요인 ${index + 1}`,
      content: `${index + 1} ${"감소대책을확인합니다".repeat(20)}`
    }));

    await expectPayloadTooLarge(await POST(createRequestForPayload({ ...payload, rows: expensiveRows })));
  });

  it("embeds checksum-valid final FontFile2 subsets", async () => {
    const response = await POST(createRequest());
    const fonts = await extractFinalFontFile2Streams(new Uint8Array(await response.arrayBuffer()));

    expect(fonts).toHaveLength(2);
    for (const [index, font] of fonts.entries()) {
      const validation = validateSfntChecksums(font);
      const invalidTables = validation.tableChecksums.filter((table) => table.stored !== table.calculated);
      expect(invalidTables, `FontFile2 ${index + 1} table checksums`).toEqual([]);
      expect(validation.actualCheckSumAdjustment, `FontFile2 ${index + 1} checkSumAdjustment`)
        .toBe(validation.expectedCheckSumAdjustment);
      expect(validation.wholeFontChecksum, `FontFile2 ${index + 1} whole checksum`)
        .toBe(SFNT_CHECKSUM_MAGIC);
    }
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

  it("covers short regular and bold Korean labels and detects an erased-label mutation", async () => {
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
    const targets = [
      { label: "작성자", sourceText: "작성자:", role: "regular" },
      { label: "검토", sourceText: "검토:", role: "regular" },
      { label: "승인", sourceText: "승인:", role: "regular" },
      { label: "위험수준", sourceText: "위험수준:", role: "bold" },
      { label: "확인 항목", sourceText: "확인 항목", role: "bold" }
    ] as const;

    for (const target of targets) {
      const item = textContent.items.find((candidate) => "str" in candidate && candidate.str.includes(target.sourceText));
      expect(item, `${target.role} label ${target.label}`).toBeDefined();
      if (!item || !("str" in item)) continue;

      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      const x = Math.max(0, Math.floor(transform[4]));
      const fontHeight = Math.max(1, Math.ceil(Math.hypot(transform[2], transform[3])));
      const y = Math.max(0, Math.floor(transform[5] - fontHeight * 1.2));
      const itemWidth = Math.max(1, Math.ceil(item.width * scale));
      const labelWidth = Math.ceil(fontHeight * (Array.from(target.label).length + 0.75));
      const width = Math.min(itemWidth, labelWidth, canvas.width - x);
      const height = Math.min(Math.ceil(fontHeight * 1.5), canvas.height - y);
      const image = context.getImageData(x, y, width, height);
      const koreanCharacterCount = Array.from(target.label)
        .filter((character) => /[\u3131-\u318E\uAC00-\uD7A3]/u.test(character)).length;
      const geometry = measureRasterGeometry(image.data, width, height, koreanCharacterCount);

      expect(geometry.darkPixelsPerCharacter, target.label).toBeGreaterThan(60);
      expect(geometry.occupiedBucketRatio, target.label).toBeGreaterThanOrEqual(0.75);

      if (target.label === "승인") {
        const mutated = new Uint8ClampedArray(image.data);
        const erasedWidth = Math.ceil(width / 2);
        for (let pixelY = 0; pixelY < height; pixelY += 1) {
          for (let pixelX = 0; pixelX < erasedWidth; pixelX += 1) {
            const offset = (pixelY * width + pixelX) * 4;
            mutated[offset] = 255;
            mutated[offset + 1] = 255;
            mutated[offset + 2] = 255;
            mutated[offset + 3] = 255;
          }
        }
        const mutatedGeometry = measureRasterGeometry(mutated, width, height, koreanCharacterCount);
        expect(mutatedGeometry.occupiedBucketRatio).toBeLessThan(0.75);
      }
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
