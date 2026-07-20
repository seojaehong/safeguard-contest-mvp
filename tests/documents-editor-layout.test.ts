import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Download, Page } from "playwright";
import { buildStoredCurrentWorkpack, CURRENT_WORKPACK_STORAGE_KEY } from "@/lib/current-workpack";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import { serializeRiskAssessmentRowsToDraft } from "@/components/workpack-editor-structure";
import {
  startIsolatedNextBrowserHarness,
  type IsolatedNextBrowserHarness
} from "./helpers/isolated-next-browser-harness";

let baseUrl = "";
let browser: Browser | null = null;
let harness: IsolatedNextBrowserHarness | null = null;
const DEFAULT_VISIBLE_OPERATIONAL_LABELS = /\b(?:Markdown|Supabase|API|JSON)\b|Operation Ontology|Operation Graph|DB 하네스|품질 계약/u;

type XlsxLoadBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

async function loadDownloadedWorkbook(download: Download) {
  const path = await download.path();
  if (!path) throw new Error("Downloaded XLSX path is unavailable");

  const workbook = new ExcelJS.Workbook();
  const buffer = await readFile(path);
  await workbook.xlsx.load(buffer as unknown as XlsxLoadBuffer);
  return workbook;
}

function readWorkbookText(workbook: ExcelJS.Workbook) {
  const cells: string[] = [];
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (typeof cell.value === "string") cells.push(cell.value);
        if (typeof cell.value === "number") cells.push(String(cell.value));
      });
    });
  });
  return cells.join("\n");
}

function computedContrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const channels = color.match(/[\d.]+/gu)?.slice(0, 3).map((channel) => {
      const normalized = Number(channel) / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

async function exportSelectedXlsx(page: Page) {
  const exportPanel = page.getByTestId("editor-export-panel");
  if (!await exportPanel.evaluate((element) => (element as HTMLDetailsElement).open)) {
    await exportPanel.locator(":scope > summary").click();
  }

  const [request, download] = await Promise.all([
    page.waitForRequest((candidate) => (
      candidate.method() === "POST" && new URL(candidate.url()).pathname === "/api/export/xlsx"
    )),
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel 표 양식(.xlsx)" }).click()
  ]);

  return {
    payload: request.postDataJSON() as Record<string, unknown>,
    workbook: await loadDownloadedWorkbook(download)
  };
}

describe("documents editor layout", () => {
  beforeAll(async () => {
    harness = await startIsolatedNextBrowserHarness({
      slug: "documents-editor-layout",
      initialPath: "/documents",
      portSalt: 3228
    });
    baseUrl = harness.baseUrl;
    browser = harness.browser;
  }, 90_000);

  afterAll(async () => {
    await harness?.stop();
  }, 90_000);

  afterEach(async () => {
    if (!browser) return;
    await Promise.all(browser.contexts().map((context) => context.close()));
  }, 30_000);

  it("keeps operational format labels out of the default rendered document surface", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });

    const visibleText = await page.locator("body").innerText();
    expect("DB 하네스 · 품질 계약").toMatch(DEFAULT_VISIBLE_OPERATIONAL_LABELS);
    expect(visibleText).not.toMatch(DEFAULT_VISIBLE_OPERATIONAL_LABELS);
  }, 90_000);

  it("bounds the default documents route editor as a viewport-first cockpit", async () => {
    if (!browser) throw new Error("Browser was not started");

    const cases = [
      { width: 1440, height: 723, maxRatio: 1.5 }
    ] as const;

    for (const viewport of cases) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });

      const metrics = await page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing documents cockpit selector: ${selector}`);
          const bounds = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            top: Math.round(bounds.top),
            bottom: Math.round(bounds.bottom),
            height: Math.round(bounds.height),
            overflowY: style.overflowY
          };
        };

        return {
          viewportHeight: window.innerHeight,
          bodyHeight: document.documentElement.scrollHeight,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          workpackShell: rect(".workpack-shell"),
          documentEditor: rect(".document-editor"),
          mobileCoreLauncher: rect('[data-testid="mobile-core-document-launcher"]')
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.bodyHeight / metrics.viewportHeight).toBeLessThanOrEqual(viewport.maxRatio);
      expect(metrics.workpackShell.overflowY).toBe("auto");
      expect(metrics.workpackShell.top).toBeLessThanOrEqual(360);
      expect(metrics.documentEditor.top).toBeLessThanOrEqual(360);
      expect(metrics.workpackShell.height).toBeGreaterThanOrEqual(360);
      expect(metrics.workpackShell.bottom).toBeLessThanOrEqual(metrics.viewportHeight);

      await page.close();
    }
  }, 90_000);

  it("renders actual message samples and an empty permit with document-specific structured sections", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 391, height: 844 } });
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = "";
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });

    const cases = [
      {
        key: "foreignWorkerTransmission",
        labels: ["공지 기본 정보", "쉬운 한국어", "다국어 안내", "관리자 확인"]
      },
      {
        key: "kakaoMessage",
        labels: ["현장·작업", "핵심 위험", "필수 조치", "시작 전 확인"]
      },
      {
        key: "workPermitDraft",
        labels: ["허가 기본 정보", "작업 전 허가조건", "격리·보호구 확인", "작업 종료 확인"]
      }
    ];

    for (const documentCase of cases) {
      await page.locator('select[aria-label="편집 문서 선택"]').selectOption(documentCase.key);
      const editor = page.getByTestId("document-structured-editor");
      await editor.waitFor({ state: "visible" });
      await expect.poll(() => editor.locator('[data-section-kind="body"] summary strong').allTextContents())
        .toEqual(documentCase.labels);
      expect(await editor.locator(".document-section-textarea").count()).toBe(documentCase.labels.length);
    }
  }, 90_000);

  it("round-trips a structured editor change into canonical XLSX rows without stale payload or truncation", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    sample.deliverables.workPlanStructured = {
      workOverview: {
        workName: "STALE_BROWSER_STRUCTURED_WORK_NAME",
        description: "STALE_BROWSER_STRUCTURED_DESCRIPTION",
        workerCount: sample.scenario.workerCount,
        location: sample.scenario.siteName,
        condition: sample.scenario.weatherNote,
        equipment: []
      },
      workSteps: [],
      stopCriteria: [],
      emergencyResponse: { contacts: [], evacRoute: "현장 확인", firstAid: "현장 확인" },
      approvers: { author: "작성자", reviewer: "검토자", approver: "승인자" }
    };
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /작업계획서/u }).click();
    const editedLines = Array.from({ length: 27 }, (_, index) => `- UI_CANONICAL_ROW_${index}`).join("\n");
    await page.getByTestId("document-structured-editor").locator(".document-section-textarea").first().fill(editedLines);

    const { payload, workbook } = await exportSelectedXlsx(page);
    const workbookText = readWorkbookText(workbook);

    expect(payload).toMatchObject({ mode: "workPlanStructured", edited: true });
    expect(workbookText).toContain("UI_CANONICAL_ROW_0");
    expect(workbookText).toContain("UI_CANONICAL_ROW_26");
    expect(workbookText).not.toContain("STALE_BROWSER_STRUCTURED_WORK_NAME");
    expect(workbookText).not.toContain("STALE_BROWSER_STRUCTURED_DESCRIPTION");
    expect(workbookText).not.toContain("사용자 편집 반영");
  }, 90_000);

  it("edits canonical risk rows and drops them from export after freeform prose diverges", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    const canonicalRow = {
      controlId: "CTRL-UI-001",
      location: sample.scenario.siteName,
      process: "외벽 도장",
      task: "이동식 비계 작업",
      equipment: "이동식 비계",
      hazard: "STALE_CANONICAL_UI_HAZARD",
      fourM: "Machine" as const,
      accidentType: "fall" as const,
      currentControls: "안전난간 설치 상태 확인",
      likelihood: 3,
      severity: 4,
      riskLevel: "high" as const,
      additionalControls: "강풍 시 작업중지",
      owner: "관리감독자",
      due: "현장 확인",
      verification: "작업 전 사진 확인",
      verificationStatus: "planned" as const,
      verificationDate: "현장 확인",
      verificationChecker: "안전관리자",
      whyLikelihood: "반복 노출",
      whySeverity: "추락 시 중상 가능",
      evidenceRefs: ["현장 작업계획"]
    };
    sample.structured = {
      riskAssessmentRows: [canonicalRow],
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    };
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /위험성평가표/u }).click();
    await page.getByRole("button", { name: "구조 편집으로 전환" }).click();
    const hazardInput = page.getByRole("textbox", { name: "행 1 유해·위험요인" });
    await hazardInput.fill("CANONICAL_UI_EDITED_HAZARD");

    const canonicalExport = await exportSelectedXlsx(page);
    expect(canonicalExport.payload).toMatchObject({
      mode: "single",
      edited: false,
      riskAssessmentRows: [{ hazard: "CANONICAL_UI_EDITED_HAZARD" }]
    });
    expect(readWorkbookText(canonicalExport.workbook)).toContain("CANONICAL_UI_EDITED_HAZARD");
    expect(readWorkbookText(canonicalExport.workbook)).not.toContain("STALE_CANONICAL_UI_HAZARD");

    await page.getByRole("button", { name: "원문" }).click();
    const source = page.getByRole("textbox", { name: "위험성평가표 전체 원문 편집" });
    await source.fill(`${await source.inputValue()}\nFREEFORM_PROSE_DIVERGENCE`);

    const freeformExport = await exportSelectedXlsx(page);
    expect(freeformExport.payload).toMatchObject({ mode: "single", edited: true });
    expect(freeformExport.payload).not.toHaveProperty("riskAssessmentRows");
  }, 90_000);

  it("persists an incomplete new risk row across reload while excluding invalid canonical export", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const sample = buildSampleWorkpack();
    const canonicalRow = {
      location: sample.scenario.siteName,
      process: "외벽 도장",
      task: "이동식 비계 작업",
      equipment: "이동식 비계",
      hazard: "RELOAD_BASE_HAZARD",
      fourM: "Machine" as const,
      accidentType: "fall" as const,
      currentControls: "안전난간 확인",
      likelihood: 3,
      severity: 4,
      riskLevel: "high" as const,
      additionalControls: "RELOAD_BASE_CONTROL",
      owner: "관리감독자",
      due: "현장 확인",
      verification: "사진 확인",
      verificationStatus: "planned" as const,
      verificationDate: "현장 확인",
      verificationChecker: "안전관리자",
      whyLikelihood: "반복 노출",
      whySeverity: "중상 가능",
      evidenceRefs: ["현장 작업계획"]
    };
    sample.deliverables.riskAssessmentDraft = serializeRiskAssessmentRowsToDraft([canonicalRow]);
    sample.structured = {
      riskAssessmentRows: [canonicalRow],
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    };
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "편집 문서 선택" }).selectOption("riskAssessmentDraft");
    await page.getByRole("button", { name: "위험 항목" }).click();
    await page.getByRole("textbox", { name: "행 2 세부작업" }).fill("RELOAD_INCOMPLETE_TASK");
    await expect.poll(() => page.getByRole("textbox", { name: "행 2 유해·위험요인" }).getAttribute("aria-invalid"))
      .toBe("true");
    const describedBy = await page.getByRole("textbox", { name: "행 2 유해·위험요인" }).getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(await page.locator(`#${describedBy}`).isVisible()).toBe(true);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "편집 문서 선택" }).selectOption("riskAssessmentDraft");
    await expect.poll(() => page.getByRole("textbox", { name: "행 2 세부작업" }).inputValue())
      .toBe("RELOAD_INCOMPLETE_TASK");

    const { payload } = await exportSelectedXlsx(page);
    expect(payload).toMatchObject({ mode: "single", edited: true });
    expect(payload).not.toHaveProperty("riskAssessmentRows");
  }, 90_000);

  it("locks structured editing when synchronized canonical text has an appended freeform marker", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const sample = buildSampleWorkpack();
    const appendedMarker = "APPENDED_FREEFORM_MARKER_DO_NOT_OVERWRITE";
    const canonicalRow = {
      location: sample.scenario.siteName,
      process: "외벽 도장",
      task: "이동식 비계 작업",
      equipment: "이동식 비계",
      hazard: "DIVERGENT_STRUCTURED_HAZARD",
      fourM: "Machine" as const,
      accidentType: "fall" as const,
      currentControls: "안전난간 확인",
      likelihood: 3,
      severity: 4,
      riskLevel: "high" as const,
      additionalControls: "DIVERGENT_STRUCTURED_CONTROL",
      owner: "관리감독자",
      due: "현장 확인",
      verification: "사진 확인",
      verificationStatus: "planned" as const,
      verificationDate: "현장 확인",
      verificationChecker: "안전관리자",
      whyLikelihood: "반복 노출",
      whySeverity: "중상 가능",
      evidenceRefs: ["현장 작업계획"]
    };
    const canonicalText = serializeRiskAssessmentRowsToDraft([canonicalRow]);
    sample.deliverables.riskAssessmentDraft = `${canonicalText}\n${appendedMarker}`;
    sample.structured = {
      riskAssessmentRows: [canonicalRow],
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    };
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents?theme=night`, { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "편집 문서 선택" }).selectOption("riskAssessmentDraft");
    const hazard = page.getByRole("textbox", { name: "행 1 유해·위험요인" });
    await expect.poll(() => hazard.isDisabled()).toBe(true);
    await expect.poll(() => page.getByRole("button", { name: "구조 편집으로 전환" }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "원문" }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "위험성평가표 전체 원문 편집" }).inputValue()).toContain(appendedMarker);

    await page.getByRole("button", { name: "구조화" }).click();
    await expect.poll(() => hazard.inputValue()).toBe(canonicalRow.hazard);
    await page.getByRole("button", { name: "구조 편집으로 전환" }).click();
    await expect.poll(() => hazard.isEnabled()).toBe(true);
    await page.getByRole("button", { name: "원문" }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "위험성평가표 전체 원문 편집" }).inputValue()).not.toContain(appendedMarker);
  }, 90_000);

  it("keeps row identity, focus, details state, and values stable while controlId changes", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const sample = buildSampleWorkpack();
    const canonicalRow = {
      controlId: "",
      location: sample.scenario.siteName,
      process: "외벽 도장",
      task: "이동식 비계 작업",
      equipment: "이동식 비계",
      hazard: "IDENTITY_HAZARD",
      fourM: "Machine" as const,
      accidentType: "fall" as const,
      currentControls: "안전난간 확인",
      likelihood: 3,
      severity: 4,
      riskLevel: "high" as const,
      additionalControls: "IDENTITY_CONTROL",
      owner: "관리감독자",
      due: "현장 확인",
      verification: "사진 확인",
      verificationStatus: "planned" as const,
      verificationDate: "현장 확인",
      verificationChecker: "안전관리자",
      whyLikelihood: "반복 노출",
      whySeverity: "중상 가능",
      evidenceRefs: ["현장 작업계획"]
    };
    sample.deliverables.riskAssessmentDraft = serializeRiskAssessmentRowsToDraft([canonicalRow]);
    sample.structured = {
      riskAssessmentRows: [canonicalRow],
      riskAssessmentValidation: { ok: true, issueCount: 0, issues: [] }
    };
    const stored = buildStoredCurrentWorkpack(sample);
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    await page.getByRole("combobox", { name: "편집 문서 선택" }).selectOption("riskAssessmentDraft");
    const details = page.getByText("공정·조치·확인 세부", { exact: true }).locator("..");
    await details.locator("summary").click();
    const controlId = page.getByRole("textbox", { name: "행 1 관리번호" });
    await controlId.pressSequentially("ABC", { delay: 30 });

    await expect.poll(() => controlId.inputValue()).toBe("ABC");
    expect(await controlId.evaluate((element) => document.activeElement === element)).toBe(true);
    expect(await details.evaluate((element) => (element as HTMLDetailsElement).open)).toBe(true);
  }, 90_000);

  it("keeps the document editor in the same light workbench system", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      function readRect(selector: string) {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderRadius: Number.parseFloat(style.borderRadius),
          borderTopWidth: Number.parseFloat(style.borderTopWidth),
          overflowX: style.overflowX,
          lineHeight: Number.parseFloat(style.lineHeight),
          fontSize: Number.parseFloat(style.fontSize)
        };
      }

      const shell = readRect(".workpack-shell");
      const sidebar = readRect(".workpack-sidebar");
      const editor = readRect(".document-editor");
      const textarea = readRect(".document-textarea");
      const activeTab = readRect(".doc-tab.active");
      const sheetExportPanel = readRect(".sheet-export-panel");
      const previewPanel = readRect(".submission-preview-panel");
      const preview = document.querySelector(".submission-preview-panel .safety-form-preview");
      const previewDisplay = preview ? getComputedStyle(preview).display : "not-mounted";

      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        shell,
        sidebar,
        editor,
        textarea,
        activeTab,
        sheetExportPanel,
        previewPanel,
        previewDisplay
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.shell.display).toBe("grid");
    expect(metrics.shell.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.sidebar.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.editor.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.sidebar.right).toBeLessThanOrEqual(metrics.editor.left - 12);
    expect(metrics.editor.borderRadius).toBeGreaterThanOrEqual(6);
    expect(metrics.editor.borderRadius).toBeLessThanOrEqual(8);
    expect(metrics.textarea.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.textarea.borderTopWidth).toBeGreaterThanOrEqual(1);
    expect(metrics.textarea.lineHeight / metrics.textarea.fontSize).toBeGreaterThanOrEqual(1.68);
    expect(metrics.activeTab.backgroundColor).not.toBe("rgb(108, 111, 247)");
    expect(metrics.activeTab.color).not.toBe("rgb(255, 255, 255)");
    expect(metrics.sheetExportPanel.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(metrics.sheetExportPanel.borderRadius).toBeLessThanOrEqual(8);
    expect(metrics.sheetExportPanel.color).not.toBe("rgb(246, 245, 239)");
    expect(metrics.previewPanel.backgroundColor).not.toBe("rgba(14, 14, 18, 0.78)");
    expect(["none", "not-mounted"]).toContain(metrics.previewDisplay);
  }, 90_000);

  it("keeps the desktop documents surface compact with one launch-document count", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });

    const contract = await page.evaluate(() => {
      const cockpit = document.querySelector(".safeclaw-document-cockpit");
      const index = document.querySelector(".safeclaw-doc-index");
      const primary = document.querySelector(".safeclaw-doc-primary");
      const exportPanel = document.querySelector(".safeclaw-doc-export");
      const compactLauncher = document.querySelector("[data-testid='mobile-core-document-launcher']");
      const coreList = document.querySelector(".safeclaw-mobile-core-list");
      const details = document.querySelector<HTMLDetailsElement>(".safeclaw-mobile-document-details");
      const banner = document.querySelector(".safeclaw-current-workpack");
      const editorWorkspace = document.querySelector('[data-testid="workpack-editor-workspace"]');
      if (!cockpit || !index || !primary || !exportPanel || !compactLauncher || !coreList || !details || !banner || !editorWorkspace) {
        throw new Error("Missing desktop document cockpit target");
      }

      const cockpitStyle = getComputedStyle(cockpit);
      const launcherStyle = getComputedStyle(compactLauncher);
      const indexRect = index.getBoundingClientRect();
      const primaryRect = primary.getBoundingClientRect();
      const exportRect = exportPanel.getBoundingClientRect();
      const launcherRect = compactLauncher.getBoundingClientRect();
      const coreRect = coreList.getBoundingClientRect();
      const detailsRect = details.getBoundingClientRect();
      const editorRect = editorWorkspace.getBoundingClientRect();
      return {
        cockpitDisplay: cockpitStyle.display,
        launcherDisplay: launcherStyle.display,
        cockpitText: cockpit.textContent || "",
        compactHeading: compactLauncher.querySelector("h2")?.textContent,
        detailsOpen: details.open,
        indexLeft: Math.round(indexRect.left),
        indexRight: Math.round(indexRect.right),
        primaryLeft: Math.round(primaryRect.left),
        primaryRight: Math.round(primaryRect.right),
        exportLeft: Math.round(exportRect.left),
        indexDisplay: getComputedStyle(index).display,
        primaryDisplay: getComputedStyle(primary).display,
        exportDisplay: getComputedStyle(exportPanel).display,
        launcherTop: Math.round(launcherRect.top),
        launcherBottom: Math.round(launcherRect.bottom),
        coreRight: Math.round(coreRect.right),
        detailsLeft: Math.round(detailsRect.left),
        editorTop: Math.round(editorRect.top),
        coreButtons: coreList.querySelectorAll("button").length,
        detailFacts: compactLauncher.querySelectorAll("[data-testid='mobile-submission-facts'] dd").length,
        bannerWorkspaceCtas: banner.querySelectorAll('a[href="/workspace"]').length
      };
    });

    expect(contract.cockpitDisplay).toBe("block");
    expect(contract.launcherDisplay).toBe("grid");
    expect(contract.indexDisplay).toBe("none");
    expect(contract.primaryDisplay).toBe("none");
    expect(contract.exportDisplay).toBe("none");
    expect(contract.coreButtons).toBe(3);
    expect(contract.detailFacts).toBe(3);
    expect(contract.compactHeading).toBe("핵심 3종");
    expect(contract.detailsOpen).toBe(false);
    expect(contract.coreRight).toBeLessThanOrEqual(contract.detailsLeft);
    expect(contract.editorTop).toBeGreaterThan(contract.launcherBottom);
    expect(contract.editorTop - contract.launcherBottom).toBeLessThanOrEqual(48);
    expect(contract.cockpitText).not.toMatch(/(?:11|12)종/u);
    expect(contract.bannerWorkspaceCtas).toBe(0);
  }, 90_000);

  it("counts only non-empty launch documents as written", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const stored = buildStoredCurrentWorkpack(buildSampleWorkpack());
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    await page.locator(".safeclaw-current-workpack.live").waitFor({ state: "visible" });

    const writtenCount = page.getByTestId("mobile-submission-facts").locator("dd").first();
    await expect.poll(() => writtenCount.textContent()).toBe("9/9종");

    await page.getByTestId("mobile-core-document-launcher").getByRole("button", { name: "위험성평가표" }).click();
    await page.getByRole("button", { name: "원문" }).click();
    await page.getByRole("textbox", { name: "위험성평가표 전체 원문 편집" }).fill("");

    await expect.poll(() => writtenCount.textContent()).toBe("8/9종");
  }, 90_000);

  it("keeps sample display counts aligned without promoting the sample to a current workpack", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });
    await page.locator(".safeclaw-current-workpack.sample").waitFor({ state: "visible" });

    const writtenCount = page.getByTestId("mobile-submission-facts").locator("dd").first();
    await expect.poll(() => writtenCount.textContent()).toBe("9/9종");

    await page.getByTestId("mobile-core-document-launcher").getByRole("button", { name: "위험성평가표" }).click();
    await page.getByRole("button", { name: "원문" }).click();
    const editor = page.getByRole("textbox", { name: "위험성평가표 전체 원문 편집" });
    await editor.fill("");

    await expect.poll(() => writtenCount.textContent()).toBe("8/9종");
    expect(await page.locator(".safeclaw-current-workpack.sample").count()).toBe(1);
    expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), CURRENT_WORKPACK_STORAGE_KEY)).toBeNull();

    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".safeclaw-current-workpack.sample").waitFor({ state: "visible" });
    await expect.poll(() => page.getByTestId("mobile-submission-facts").locator("dd").first().textContent()).toBe("8/9종");
    await page.getByTestId("mobile-core-document-launcher").getByRole("button", { name: "위험성평가표" }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "위험성평가표 편집" }).inputValue()).toBe("");
    expect(await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), CURRENT_WORKPACK_STORAGE_KEY)).toBeNull();
  }, 90_000);

  it("opens a requested document in an editor-first workspace with secondary tools collapsed", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });

    await page.getByTestId("mobile-core-document-launcher").getByRole("button", { name: "위험성평가표" }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "위험성평가표 편집");

    const contract = await page.evaluate(() => {
      const shell = document.querySelector('[data-testid="workpack-editor-workspace"]');
      const documentBody = document.querySelector('[data-testid="editor-document-body"]');
      const secondaryTools = document.querySelector('[data-testid="editor-secondary-tools"]');
      const textarea = document.querySelector<HTMLTextAreaElement>('.document-textarea[aria-label="위험성평가표 편집"]');
      const provenanceDrawer = document.querySelector<HTMLDetailsElement>('[data-testid="editor-provenance-drawer"]');
      const evidencePanel = document.querySelector<HTMLElement>('[data-testid="editor-evidence-panel"]');
      const qualityPanel = document.querySelector<HTMLElement>('[data-testid="editor-quality-panel"]');
      const graphPanel = document.querySelector<HTMLElement>('[data-testid="editor-graph-panel"]');
      const exportPanel = document.querySelector<HTMLDetailsElement>('[data-testid="editor-export-panel"]');
      const previewPanel = document.querySelector<HTMLDetailsElement>('.submission-preview-panel');
      const documentSelect = document.querySelector<HTMLSelectElement>('select[aria-label="편집 문서 선택"]');
      const topbar = document.querySelector(".safeclaw-module-nav");
      if (!shell || !documentBody || !secondaryTools || !textarea || !provenanceDrawer || !evidencePanel || !qualityPanel || !graphPanel || !exportPanel || !previewPanel || !documentSelect || !topbar) {
        throw new Error("Missing editor-first workspace contract target");
      }

      const bodyRect = documentBody.getBoundingClientRect();
      const toolsRect = secondaryTools.getBoundingClientRect();
      const topbarRect = topbar.getBoundingClientRect();
      return {
        activeLabel: document.activeElement?.getAttribute("aria-label"),
        bodyBeforeTools: Boolean(documentBody.compareDocumentPosition(secondaryTools) & Node.DOCUMENT_POSITION_FOLLOWING),
        bodyTop: Math.round(bodyRect.top),
        topbarBottom: Math.round(topbarRect.bottom),
        toolsTop: Math.round(toolsRect.top),
        textareaLength: textarea.value.length,
        selectedDocument: documentSelect.value,
        documentCount: documentSelect.options.length,
        provenanceOpen: provenanceDrawer.open,
        provenanceSummary: provenanceDrawer.querySelector(":scope > summary")?.textContent?.trim(),
        evidenceTag: evidencePanel.tagName,
        qualityTag: qualityPanel.tagName,
        graphTag: graphPanel.tagName,
        evidenceOwned: provenanceDrawer.contains(evidencePanel),
        qualityOwned: provenanceDrawer.contains(qualityPanel),
        graphOwned: provenanceDrawer.contains(graphPanel),
        exportOpen: exportPanel.open,
        previewOpen: previewPanel.open
      };
    });

    expect(contract.activeLabel).toBe("위험성평가표 편집");
    expect(contract.selectedDocument).toBe("riskAssessmentDraft");
    expect(contract.documentCount).toBe(12);
    expect(contract.textareaLength).toBeGreaterThan(100);
    expect(contract.bodyBeforeTools).toBe(true);
    expect(contract.bodyTop).toBeGreaterThanOrEqual(contract.topbarBottom + 8);
    expect(contract.bodyTop).toBeLessThanOrEqual(contract.topbarBottom + 96);
    expect(contract.bodyTop).toBeLessThan(contract.toolsTop);
    expect(contract.provenanceOpen).toBe(false);
    expect(contract.provenanceSummary).toMatch(/^근거 \d+건 · 확인 필요 \d+건$/u);
    expect([contract.evidenceTag, contract.qualityTag, contract.graphTag]).toEqual(["SECTION", "SECTION", "SECTION"]);
    expect([contract.evidenceOwned, contract.qualityOwned, contract.graphOwned]).toEqual([true, true, true]);
    expect(contract.exportOpen).toBe(false);
    expect(contract.previewOpen).toBe(false);
  }, 90_000);

  it("does not enter a maximum update-depth loop for a real current workpack", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const stored = buildStoredCurrentWorkpack(buildSampleWorkpack());
    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
      const target = window as typeof window & { __safeclawCurrentWorkpackWrites?: number };
      target.__safeclawCurrentWorkpackWrites = 0;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (key === storageKey) {
          target.__safeclawCurrentWorkpackWrites = (target.__safeclawCurrentWorkpackWrites || 0) + 1;
        }
        return originalSetItem.call(this, key, value);
      };
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });
    const runtimeErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("textbox", { name: "점검결과 요약 편집" }).waitFor({ state: "visible" });
    await page.waitForTimeout(750);
    const writeCount = await page.evaluate(() => (
      (window as typeof window & { __safeclawCurrentWorkpackWrites?: number }).__safeclawCurrentWorkpackWrites || 0
    ));

    expect(runtimeErrors.join("\n")).not.toMatch(/maximum update depth|too many re-renders/i);
    expect(writeCount).toBeLessThanOrEqual(4);
  }, 90_000);

  it("restores an edited browser draft after a full reload with the same draft key", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sentinel = "SAFECLAW_RELOAD_DRAFT_PRESERVED";

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /위험성평가표/ }).click();
    const editor = page.getByRole("textbox", { name: "위험성평가표 편집" });
    const editedValue = `${await editor.inputValue()}\n${sentinel}`;
    await editor.fill(editedValue);
    await expect.poll(async () => page.evaluate((marker) => (
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("safeclaw-workpack:"))
        .some((key) => window.localStorage.getItem(key)?.includes(marker))
    ), sentinel)).toBe(true);
    const keysBeforeReload = await page.evaluate(() => (
      Object.keys(window.localStorage).filter((key) => key.startsWith("safeclaw-workpack:")).sort()
    ));

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /위험성평가표/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "위험성평가표 편집" }).inputValue()).toBe(editedValue);
    const keysAfterReload = await page.evaluate(() => (
      Object.keys(window.localStorage).filter((key) => key.startsWith("safeclaw-workpack:")).sort()
    ));

    expect(keysAfterReload).toEqual(keysBeforeReload);
  }, 90_000);

  it("restores workPermitDraft from the canonical current-workpack snapshot across surfaces and reload", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sentinel = "SAFECLAW_WORK_PERMIT_CURRENT_SNAPSHOT";
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = [
      "[1. 허가 기본정보]",
      `허가대상 작업: ${sentinel}`,
      "작업현장: 세이프건설"
    ].join("\n");
    const stored = buildStoredCurrentWorkpack(sample);

    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "문서팩 다시 열기" }).click();
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toContain(sentinel);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toContain(sentinel);
  }, 90_000);

  it("keeps an explicitly empty workPermitDraft empty across current-workpack reopen and reload", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = "";
    const stored = buildStoredCurrentWorkpack(sample);

    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/home`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "문서팩 다시 열기" }).click();
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toBe("");

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toBe("");
  }, 90_000);

  it("exports an explicitly empty workPermitDraft without regenerating structured permit content", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = "";
    const stored = buildStoredCurrentWorkpack(sample);

    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toBe("");

    const { payload, workbook } = await exportSelectedXlsx(page);

    expect(payload).toMatchObject({ mode: "single", edited: true, rows: [] });
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["안전작업허가 확인서"]);
    const workbookText = readWorkbookText(workbook);
    expect(workbookText).not.toContain("허가 기본정보");
    expect(workbookText).not.toContain("작업 전 허가조건");
  }, 90_000);

  it("keeps a nonempty structured work permit on the schema-first XLSX export path", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sentinel = "SAFECLAW_STRUCTURED_PERMIT_EXPORT";
    const sample = buildSampleWorkpack();
    sample.deliverables.workPermitDraft = `허가대상 작업: ${sentinel}`;
    sample.deliverables.permitInspectionStructured = {
      basicInfo: {
        permitNo: "SC-PTW-TEST",
        permitType: "고소작업",
        workName: sentinel,
        location: sample.scenario.siteName,
        workDate: "2026-07-11",
        workerCount: sample.scenario.workerCount,
        requester: "작업반장",
        approver: "관리감독자"
      },
      conditions: [{
        category: "추락·낙하",
        requirement: "작업발판과 안전대 확인",
        action: "작업 전 이중 확인",
        owner: "작업반장",
        status: "적합"
      }],
      attachments: [],
      completionChecks: [],
      approvers: {
        requester: "작업반장",
        safetyManager: "안전관리자",
        siteManager: "현장소장",
        completionChecker: "종료 확인자"
      }
    };
    const stored = buildStoredCurrentWorkpack(sample);

    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    const { payload, workbook } = await exportSelectedXlsx(page);

    expect(payload).toMatchObject({ mode: "permitInspectionStructured", edited: false });
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["작업허가 확인"]);
    const workbookText = readWorkbookText(workbook);
    expect(workbookText).toContain("허가 기본정보");
    expect(workbookText).toContain(sentinel);
  }, 90_000);

  it("uses generated permit fallback when legacy data has no workPermitDraft field", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sample = buildSampleWorkpack();
    delete sample.deliverables.workPermitDraft;
    delete sample.deliverables.permitInspectionStructured;
    const stored = buildStoredCurrentWorkpack(sample);

    await page.addInitScript(({ storageKey, serialized }) => {
      window.localStorage.setItem(storageKey, serialized);
    }, { storageKey: CURRENT_WORKPACK_STORAGE_KEY, serialized: JSON.stringify(stored) });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /안전작업허가 확인서/ }).click();
    await expect.poll(() => page.getByRole("textbox", { name: "안전작업허가 확인서 편집" }).inputValue())
      .toContain("허가대상 작업:");

    const { payload, workbook } = await exportSelectedXlsx(page);

    expect(payload).toMatchObject({ mode: "permitInspectionStructured", edited: false });
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["작업허가 확인"]);
    const workbookText = readWorkbookText(workbook);
    expect(workbookText).toContain("허가 기본정보");
    expect(workbookText).toContain("작업 전 허가조건");
    expect(workbookText).toContain(sample.scenario.workSummary);
  }, 90_000);

  it("announces meaningful save state without live-reading every keystroke", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const sentinel = "SAFECLAW_SAVE_STATUS_SENTINEL";

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    const editor = page.getByRole("textbox", { name: "점검결과 요약 편집" });
    const meta = page.locator(".editor-document-meta");

    expect(await meta.getAttribute("aria-live")).toBeNull();
    expect(await editor.getAttribute("aria-label")).toBe("점검결과 요약 편집");

    await editor.fill(`${await editor.inputValue()}\n${sentinel}`);

    const saveStatus = page.getByTestId("editor-save-status");
    await expect.poll(() => saveStatus.textContent()).toContain("저장됨");
    expect(await saveStatus.getAttribute("role")).toBe("status");
    expect(await saveStatus.getAttribute("aria-live")).toBe("polite");

    const focusMessage = page.locator(".editor-focus-message");
    if (await focusMessage.count()) {
      expect(await focusMessage.first().getAttribute("aria-live")).toBeNull();
    }
  }, 90_000);

  it("keeps every Day document metadata label at AA text contrast", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents?theme=day`, { waitUntil: "networkidle" });

    const metadataLabels = page.locator(".document-toolbar > div:last-child > span");
    await expect.poll(() => metadataLabels.count()).toBeGreaterThanOrEqual(2);

    const ratios = await metadataLabels.evaluateAll((elements) => {
      const channels = (value: string) => {
        const matches = value.match(/[\d.]+/g);
        if (!matches || matches.length < 3) throw new Error(`Unsupported color: ${value}`);
        return matches.slice(0, 3).map((channel) => {
          const normalized = Number(channel) / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
      };
      const luminance = (value: string) => {
        const [red, green, blue] = channels(value);
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      return elements.map((element) => {
        const style = getComputedStyle(element);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return {
          text: element.textContent?.trim() || "",
          ratio: (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
        };
      });
    });

    expect(ratios.length).toBeGreaterThanOrEqual(2);
    ratios.forEach(({ text, ratio }) => expect(ratio, text).toBeGreaterThanOrEqual(4.5));
  }, 90_000);

  it.each(["day", "night"] as const)(
    "keeps the primary %s document export action at AA text contrast",
    async (theme) => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(`${baseUrl}/documents?theme=${theme}`, { waitUntil: "networkidle" });

      const colors = await page.locator(".safeclaw-doc-export a:first-of-type").evaluate((element) => {
        const style = getComputedStyle(element);
        return { foreground: style.color, background: style.backgroundColor };
      });

      expect(computedContrastRatio(colors.foreground, colors.background), theme).toBeGreaterThanOrEqual(4.5);
    },
    90_000,
  );

  it("renders every landing light-grid label at AA text contrast", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });

    const grids = [
      [".safeclaw-pipeline-grid", 5],
      [".safeclaw-proof-matrix", 6],
      [".safeclaw-language-matrix", 10],
      [".safeclaw-module-map", 8],
    ] as const;

    for (const [selector, expectedLabels] of grids) {
      const labels = page.locator(`${selector} > * > span`);
      await expect.poll(() => labels.count(), { message: selector }).toBe(expectedLabels);
      const colors = await labels.evaluateAll((elements) => elements.map((element) => {
        const foreground = getComputedStyle(element).color;
        let surface: Element | null = element.parentElement;
        let background = "";
        while (surface) {
          const candidate = getComputedStyle(surface).backgroundColor;
          const channels = candidate.match(/[\d.]+/gu)?.map(Number) ?? [];
          const alpha = channels.length >= 4 ? channels[3] : 1;
          if (alpha === 1) {
            background = candidate;
            break;
          }
          surface = surface.parentElement;
        }
        if (!background) throw new Error(`Missing painted background for ${element.textContent ?? "landing label"}`);
        return { foreground, background, text: element.textContent?.trim() || "" };
      }));

      colors.forEach(({ foreground, background, text }) => {
        expect(computedContrastRatio(foreground, background), `${selector} ${text}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }, 90_000);

  it("supports roving keyboard navigation across document tabs", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="workpack-editor-workspace"]').scrollIntoViewIfNeeded();

    const tabs = page.getByRole("tab");
    expect(await tabs.count()).toBe(12);
    expect(await tabs.evaluateAll((items) => items.map((item) => item.tabIndex))).toEqual([
      0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
    ]);

    const summaryTab = page.getByRole("tab", { name: /점검결과 요약/ });
    const riskTab = page.getByRole("tab", { name: /위험성평가표/ });
    const workPlanTab = page.getByRole("tab", { name: /작업계획서/ });
    const messageTab = page.getByRole("tab", { name: /현장 공유 메시지/ });
    const documentSelect = page.locator('select[aria-label="편집 문서 선택"]');
    const panel = page.locator('[data-testid="editor-document-body"]');

    await summaryTab.focus();
    await summaryTab.press("End");
    expect(await documentSelect.inputValue()).toBe("kakaoMessage");
    expect(await messageTab.evaluate((element) => document.activeElement === element)).toBe(true);

    await messageTab.press("Home");
    expect(await documentSelect.inputValue()).toBe("workpackSummaryDraft");
    expect(await summaryTab.evaluate((element) => document.activeElement === element)).toBe(true);

    await summaryTab.press("ArrowRight");
    expect(await documentSelect.inputValue()).toBe("riskAssessmentDraft");
    await riskTab.press("ArrowDown");
    expect(await documentSelect.inputValue()).toBe("workPlanDraft");
    await workPlanTab.press("ArrowLeft");
    expect(await documentSelect.inputValue()).toBe("riskAssessmentDraft");
    await riskTab.press("ArrowUp");
    expect(await documentSelect.inputValue()).toBe("workpackSummaryDraft");

    expect(await panel.getAttribute("aria-labelledby")).toBe("workpack-document-tab-workpackSummaryDraft");
    expect(await tabs.evaluateAll((items) => items.map((item) => item.tabIndex))).toEqual([
      0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
    ]);
  }, 90_000);

  it.each(["day", "night"] as const)(
    "puts the core launcher before the mobile editor in %s mode",
    async (theme) => {
      if (!browser) throw new Error("Browser was not started");
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${baseUrl}/documents?theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForFunction((expectedTheme) => {
        const shell = document.querySelector(".safeclaw-module-shell");
        return shell?.getAttribute("data-ready") === "true" && shell.getAttribute("data-theme") === expectedTheme;
      }, theme);

      const initialEditorTop = await page.locator('[data-testid="workpack-editor-workspace"]').evaluate((element) => {
        return Math.round(element.getBoundingClientRect().top + window.scrollY);
      });
      expect(initialEditorTop).toBeLessThan(1200);

      const launcher = page.getByTestId("mobile-core-document-launcher");
      const details = page.getByTestId("mobile-document-details");
      const initial = await page.evaluate(() => {
        const launcherElement = document.querySelector('[data-testid="mobile-core-document-launcher"]');
        const launcherList = document.querySelector(".safeclaw-mobile-core-list");
        const detailsElement = document.querySelector<HTMLDetailsElement>('[data-testid="mobile-document-details"]');
        const cockpit = document.querySelector(".safeclaw-document-cockpit");
        const editor = document.querySelector('[data-testid="workpack-editor-workspace"]');
        const desktopPanels = [
          document.querySelector(".safeclaw-doc-index"),
          document.querySelector(".safeclaw-doc-primary"),
          document.querySelector(".safeclaw-doc-export")
        ];
        if (!launcherElement || !launcherList || !detailsElement || !cockpit || !editor || desktopPanels.some((panel) => !panel)) {
          throw new Error("Missing mobile document-priority target");
        }

        const launcherRect = launcherElement.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        return {
          theme: document.querySelector(".safeclaw-module-shell")?.getAttribute("data-theme"),
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          launcherDisplay: getComputedStyle(launcherElement).display,
          launcherTop: Math.round(launcherRect.top + window.scrollY),
          editorTop: Math.round(editorRect.top + window.scrollY),
          coreGap: Number.parseFloat(getComputedStyle(launcherList).rowGap),
          coreLabels: Array.from(launcherList.querySelectorAll("button"), (button) => button.textContent?.trim()),
          coreHeights: Array.from(launcherList.querySelectorAll("button"), (button) => Math.round(button.getBoundingClientRect().height)),
          detailsOpen: detailsElement.open,
          detailsCount: document.querySelectorAll('[data-testid="mobile-document-details"]').length,
          detailsLabel: detailsElement.querySelector(":scope > summary")?.textContent?.replace(/\s+/gu, " ").trim(),
          desktopPanelDisplays: desktopPanels.map((panel) => getComputedStyle(panel as Element).display),
          cockpitText: cockpit.textContent || "",
          bannerWorkspaceCtas: document.querySelectorAll('.safeclaw-current-workpack a[href="/workspace"]').length
        };
      });

      expect(initial.theme).toBe(theme);
      expect(initial.scrollWidth).toBeLessThanOrEqual(initial.viewportWidth + 1);
      expect(initial.launcherDisplay).not.toBe("none");
      expect(initial.launcherTop).toBeLessThan(initial.editorTop);
      expect(initial.coreGap).toBe(8);
      expect(initial.coreLabels).toEqual(["위험성평가표", "TBM 브리핑", "TBM 기록"]);
      expect(initial.coreHeights.every((height) => height >= 44)).toBe(true);
      expect(initial.detailsOpen).toBe(false);
      expect(initial.detailsCount).toBe(1);
      expect(initial.detailsLabel).toBe("문서 9종 · 제출 정보");
      expect(initial.desktopPanelDisplays).toEqual(["none", "none", "none"]);
      expect(initial.cockpitText).not.toMatch(/(?:11|12)종/u);
      expect(initial.cockpitText).toContain("오늘 문서");
      expect(initial.cockpitText).toContain("핵심 3종");
      expect(initial.bannerWorkspaceCtas).toBe(0);

      await launcher.getByRole("button", { name: "TBM 기록" }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "TBM 기록 편집");
      const selected = await page.evaluate(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('.document-textarea[aria-label="TBM 기록 편집"]');
        const documentBody = document.querySelector('[data-testid="editor-document-body"]');
        const documentSelect = document.querySelector<HTMLSelectElement>('select[aria-label="편집 문서 선택"]');
        const selectedLauncher = document.querySelector<HTMLButtonElement>(
          '[data-testid="mobile-core-document-launcher"] button[data-document-key="tbmLogDraft"]'
        );
        if (!textarea || !documentBody || !documentSelect || !selectedLauncher) {
          throw new Error("Missing selected mobile editor target");
        }
        const textareaRect = textarea.getBoundingClientRect();
        const bodyRect = documentBody.getBoundingClientRect();
        return {
          activeLabel: document.activeElement?.getAttribute("aria-label"),
          selectedDocument: documentSelect.value,
          selectedPressed: selectedLauncher.getAttribute("aria-pressed"),
          textareaTop: Math.round(textareaRect.top),
          textareaBottom: Math.round(textareaRect.bottom),
          bodyTop: Math.round(bodyRect.top),
          scrollY: Math.round(window.scrollY)
        };
      });

      expect(selected.activeLabel).toBe("TBM 기록 편집");
      expect(selected.selectedDocument).toBe("tbmLogDraft");
      expect(selected.selectedPressed).toBe("true");
      expect(selected.scrollY).toBeGreaterThan(0);
      expect(selected.bodyTop).toBeGreaterThanOrEqual(0);
      expect(selected.bodyTop).toBeLessThanOrEqual(96);
      expect(selected.textareaTop).toBeGreaterThanOrEqual(0);
      expect(selected.textareaTop).toBeLessThan(844);
      expect(selected.textareaBottom).toBeGreaterThan(selected.textareaTop);

      await page.locator('select[aria-label="편집 문서 선택"]').selectOption("riskAssessmentDraft");
      await expect.poll(async () => {
        const riskAssessmentPressed = await launcher.getByRole("button", { name: "위험성평가표" }).getAttribute("aria-pressed");
        const tbmLogPressed = await launcher.getByRole("button", { name: "TBM 기록" }).getAttribute("aria-pressed");
        return [riskAssessmentPressed, tbmLogPressed];
      }).toEqual(["true", "false"]);

      await details.locator(":scope > summary").click();
      const expanded = await page.evaluate(() => {
        const detailsElement = document.querySelector<HTMLDetailsElement>('[data-testid="mobile-document-details"]');
        const remainingList = document.querySelector(".safeclaw-mobile-remaining-list");
        const actionList = document.querySelector(".safeclaw-mobile-detail-actions");
        if (!detailsElement || !remainingList || !actionList) {
          throw new Error("Missing expanded mobile document detail target");
        }
        const controls = detailsElement.querySelectorAll(":scope > summary, button, a");
        const allLaunchKeys = Array.from(
          document.querySelectorAll<HTMLElement>('.safeclaw-document-cockpit [data-document-key]'),
          (element) => element.dataset.documentKey
        );
        return {
          open: detailsElement.open,
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          remainingGap: Number.parseFloat(getComputedStyle(remainingList).rowGap),
          actionGap: Number.parseFloat(getComputedStyle(actionList).rowGap),
          remainingLabels: Array.from(remainingList.querySelectorAll("button"), (button) => button.querySelector("strong")?.textContent),
          controlHeights: Array.from(controls, (control) => Math.round(control.getBoundingClientRect().height)),
          uniqueLaunchKeys: Array.from(new Set(allLaunchKeys)),
          previewCount: detailsElement.querySelectorAll('[data-testid="mobile-primary-preview"] > div').length,
          factCount: detailsElement.querySelectorAll('[data-testid="mobile-submission-facts"] > div').length,
          actionCount: actionList.querySelectorAll("a").length,
          nestedDetails: detailsElement.querySelectorAll("details").length,
          nestedCards: detailsElement.querySelectorAll(".card").length
        };
      });

      expect(expanded.open).toBe(true);
      expect(expanded.scrollWidth).toBeLessThanOrEqual(expanded.viewportWidth + 1);
      expect(expanded.remainingGap).toBe(8);
      expect(expanded.actionGap).toBe(8);
      expect(expanded.remainingLabels).toEqual([
        "외국인 전송본",
        "작업계획서",
        "안전보건교육 기록",
        "점검결과 요약",
        "비상대응 절차",
        "사진·증빙"
      ]);
      expect(expanded.controlHeights.every((height) => height >= 44)).toBe(true);
      expect(expanded.uniqueLaunchKeys).toHaveLength(9);
      expect(expanded.previewCount).toBe(3);
      expect(expanded.factCount).toBe(3);
      expect(expanded.actionCount).toBe(2);
      expect(expanded.nestedDetails).toBe(0);
      expect(expanded.nestedCards).toBe(0);
    },
    90_000
  );

  it("keeps the editor workspace and expanded tools contained at 390px", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="workpack-editor-workspace"]').scrollIntoViewIfNeeded();

    const documentSelect = page.locator('select[aria-label="편집 문서 선택"]');
    await documentSelect.selectOption("tbmBriefing");
    await page.locator('[data-testid="editor-provenance-drawer"] > summary').click();
    await page.locator('[data-testid="editor-export-panel"] > summary').click();

    const metrics = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const selectors = [
        '[data-testid="workpack-editor-workspace"]',
        '[data-testid="editor-document-body"]',
        '[data-testid="editor-secondary-tools"]',
        'select[aria-label="편집 문서 선택"]',
        ".document-textarea",
        '[data-testid="editor-evidence-panel"]',
        '[data-testid="editor-quality-panel"]',
        '[data-testid="editor-graph-panel"]',
        '[data-testid="editor-export-panel"]'
      ];
      const bounds = selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing mobile layout target: ${selector}`);
        const rect = element.getBoundingClientRect();
        return { selector, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      });
      const desktopTabs = document.querySelector(".doc-tab-list");
      const mobileSelect = document.querySelector('select[aria-label="편집 문서 선택"]');
      if (!desktopTabs || !mobileSelect) throw new Error("Missing responsive document navigation");
      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bounds,
        desktopTabsDisplay: getComputedStyle(desktopTabs).display,
        mobileSelectDisplay: getComputedStyle(mobileSelect).display,
        textareaLabel: document.querySelector(".document-textarea")?.getAttribute("aria-label")
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.desktopTabsDisplay).toBe("none");
    expect(metrics.mobileSelectDisplay).not.toBe("none");
    expect(metrics.textareaLabel).toBe("TBM/작업 전 안전점검회의 편집");
    metrics.bounds.forEach((rect) => {
      expect(rect.left, rect.selector).toBeGreaterThanOrEqual(0);
      expect(rect.right, rect.selector).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(rect.width, rect.selector).toBeGreaterThan(0);
    });
  }, 90_000);

  it("keeps the opened submission preview contained", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1180, height: 860 } });
    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();
    await page.locator(".submission-preview-panel summary").click();
    await page.locator(".submission-preview-panel .safety-form-preview").waitFor({ state: "visible" });

    const metrics = await page.evaluate(() => {
      const editor = document.querySelector(".document-editor");
      const preview = document.querySelector(".submission-preview-panel .safety-form-preview");
      const tableWrap = document.querySelector(".submission-preview-panel .safety-form-table-wrap");
      const documentTitle = document.querySelector(".submission-preview-panel .safety-form-preview-head strong");
      const sectionTitle = document.querySelector(".submission-preview-panel .safety-form-section-stack h3");
      const firstHeader = document.querySelector(".submission-preview-panel .safety-form-preview th");
      if (!editor || !preview || !tableWrap || !documentTitle || !sectionTitle || !firstHeader) throw new Error("Missing submission preview targets");
      const editorRect = editor.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const previewStyle = getComputedStyle(preview);
      const tableWrapStyle = getComputedStyle(tableWrap);
      const documentTitleStyle = getComputedStyle(documentTitle);
      const sectionTitleStyle = getComputedStyle(sectionTitle);
      const firstHeaderStyle = getComputedStyle(firstHeader);
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        editorLeft: Math.round(editorRect.left),
        editorRight: Math.round(editorRect.right),
        previewLeft: Math.round(previewRect.left),
        previewRight: Math.round(previewRect.right),
        previewOverflowX: previewStyle.overflowX,
        previewBackground: previewStyle.backgroundColor,
        previewColor: previewStyle.color,
        tableWrapBorderRadius: Number.parseFloat(tableWrapStyle.borderRadius),
        tableWrapBorderColor: tableWrapStyle.borderTopColor,
        documentTitleLetterSpacing: documentTitleStyle.letterSpacing === "normal" ? 0 : Number.parseFloat(documentTitleStyle.letterSpacing),
        sectionTitleLetterSpacing: sectionTitleStyle.letterSpacing === "normal" ? 0 : Number.parseFloat(sectionTitleStyle.letterSpacing),
        sectionTitleBackground: sectionTitleStyle.backgroundColor,
        sectionTitleColor: sectionTitleStyle.color,
        sectionTitleBorderRadius: Number.parseFloat(sectionTitleStyle.borderRadius),
        firstHeaderBackground: firstHeaderStyle.backgroundColor,
        firstHeaderColor: firstHeaderStyle.color,
        firstHeaderBorderColor: firstHeaderStyle.borderBottomColor
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.previewLeft).toBeGreaterThanOrEqual(metrics.editorLeft);
    expect(metrics.previewRight).toBeLessThanOrEqual(metrics.editorRight);
    expect(metrics.previewOverflowX).toBe("auto");
    expect(metrics.previewBackground).toBe("rgb(255, 255, 255)");
    expect(metrics.previewColor).not.toBe("rgb(246, 245, 239)");
    expect(metrics.tableWrapBorderRadius).toBeGreaterThanOrEqual(8);
    expect(metrics.tableWrapBorderRadius).toBeLessThanOrEqual(8);
    expect(metrics.tableWrapBorderColor).toBe("rgb(231, 234, 238)");
    expect({
      title: metrics.documentTitleLetterSpacing,
      section: metrics.sectionTitleLetterSpacing
    }).toEqual({
      title: expect.closeTo(-0.533334, 5),
      section: expect.closeTo(-0.186667, 5)
    });
    expect(metrics.sectionTitleBackground).toBe("rgb(244, 245, 247)");
    expect(metrics.sectionTitleColor).toBe("rgb(23, 25, 29)");
    expect(metrics.sectionTitleBorderRadius).toBeGreaterThanOrEqual(6);
    expect(metrics.firstHeaderBackground).toBe("rgb(244, 245, 247)");
    expect(metrics.firstHeaderColor).toBe("rgb(23, 25, 29)");
    expect(metrics.firstHeaderBorderColor).toBe("rgb(231, 234, 238)");
  }, 90_000);

  it("keeps exported HTML document styling aligned with the workspace system", async () => {
    if (!browser) throw new Error("Browser was not started");
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      type CapturedDownload = { type: string; text: string };
      const captureTarget = window as unknown as { __safeclawDownloads: CapturedDownload[] };
      captureTarget.__safeclawDownloads = [];
      const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object: Blob | MediaSource) => {
        if (object instanceof Blob && /html|text|msword|excel/.test(object.type)) {
          void object.text().then((text) => {
            captureTarget.__safeclawDownloads.push({ type: object.type, text });
          });
        }
        return originalCreateObjectUrl(object);
      };
    });

    await page.goto(`${baseUrl}/documents`, { waitUntil: "networkidle" });
    await page.locator(".workpack-shell").scrollIntoViewIfNeeded();
    await page.locator('[data-testid="editor-export-panel"] > summary').click();
    await page.locator(".download-bar details summary", { hasText: "베타 형식" }).click();
    await page.locator(".advanced-download-grid button", { hasText: "HTML" }).click();
    await page.waitForFunction(() => {
      const captureTarget = window as unknown as { __safeclawDownloads?: Array<{ text: string }> };
      return Boolean(captureTarget.__safeclawDownloads?.some((item) => item.text.includes("safety-form-page")));
    });

    const html = await page.evaluate(() => {
      const captureTarget = window as unknown as { __safeclawDownloads?: Array<{ text: string }> };
      return captureTarget.__safeclawDownloads?.find((item) => item.text.includes("safety-form-page"))?.text || "";
    });

    expect(html).toContain("#fafafb");
    expect(html).toContain("#e6e8eb");
    expect(html).toContain("border-radius: 12px");
    expect(html).not.toContain("#ece7dc");
    expect(html).not.toContain("#f2ead9");
    expect(html).not.toContain("background: #161b22");
    expect(html).not.toContain("background: #285f45");
    expect(html).not.toContain("border: 2px solid #161b22");
  }, 90_000);
});
