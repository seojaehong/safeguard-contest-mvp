const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const OUTPUT_DIR = __dirname;
const TARGET = process.env.SAFECLAW_UX_TARGET || "https://www.safeclaw.kr";
const QUERY = [
  "세이프건설 서울 성수동 근린생활시설 외벽 도장 작업.",
  "이동식 비계 사용, 작업자 5명, 신규 투입자 1명, 오후 강풍 예보.",
  "추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM, 안전보건교육 기록을 만들어줘."
].join(" ");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function safeText(locator) {
  try {
    return (await locator.textContent({ timeout: 500 })).trim();
  } catch {
    return "";
  }
}

async function clickByText(page, text, options = {}) {
  const locator = page.getByText(text, { exact: options.exact ?? false }).first();
  await locator.click({ timeout: options.timeout ?? 5000 });
}

async function clickSelector(page, selector, options = {}) {
  const locator = page.locator(selector).first();
  await locator.click({ timeout: options.timeout ?? 5000 });
}

async function measurePage(page, label) {
  return page.evaluate((labelInPage) => {
    function rect(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return {
        x: Math.round(r.x * 100) / 100,
        y: Math.round(r.y * 100) / 100,
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        bottom: Math.round(r.bottom * 100) / 100
      };
    }
    function count(selector) {
      return document.querySelectorAll(selector).length;
    }
    function overflow(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        horizontalOverflow: element.scrollWidth > element.clientWidth + 1,
        verticalOverflow: element.scrollHeight > element.clientHeight + 1
      };
    }

    const doc = document.scrollingElement || document.documentElement;
    const visibleButtons = Array.from(document.querySelectorAll("button, a, summary, input, textarea, select"))
      .filter((element) => {
        const r = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      });
    const under44 = visibleButtons.filter((element) => {
      const r = element.getBoundingClientRect();
      return r.height < 44 || r.width < 44;
    }).length;

    return {
      label: labelInPage,
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: doc.scrollWidth,
        scrollHeight: doc.scrollHeight,
        scrollToViewportRatio: Math.round((doc.scrollHeight / window.innerHeight) * 100) / 100,
        pageHorizontalOverflow: doc.scrollWidth > document.documentElement.clientWidth + 1
      },
      rects: {
        shell: rect(".workspace-shell"),
        sideNav: rect(".workspace-side-nav"),
        commandMain: rect(".command-main"),
        documentPage: rect("#workspace-document-page"),
        documentWorkbench: rect(".document-workbench"),
        documentViewerShell: rect(".document-viewer-shell"),
        documentRail: rect(".workbench-document-rail"),
        documentPreview: rect(".document-preview-pane"),
        editorSurface: rect(".document-editor-surface"),
        fieldOpsWorkspace: rect(".field-ops-workspace"),
        workpackEditor: rect(".workpack-editor"),
        sharePage: rect("#workspace-share-page"),
        sharePanel: rect(".share-panel.workflow-panel"),
        shareFormShell: rect(".share-form-shell"),
        shareCard: rect(".share-form-card"),
        sharePreview: rect(".message-preview-panel"),
        shareCommand: rect(".share-panel.workflow-panel .command-actions")
      },
      overflow: {
        documentRail: overflow(".workbench-document-rail"),
        commandMain: overflow(".command-main"),
        sharePanel: overflow(".share-panel.workflow-panel")
      },
      counts: {
        visibleControls: visibleButtons.length,
        visibleControlsUnder44: under44,
        stickyLike: count("[style*='sticky'], .sticky, .workspace-topbar, .workspace-side-nav, .safeclaw-module-nav")
      }
    };
  }, label);
}

async function waitForGenerated(page) {
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return document.querySelector(".doc-card-actions button")
      || text.includes("12/12")
      || text.includes("안전 문서팩 3종 준비 완료")
      || text.includes("문서팩을 준비했습니다")
      || text.includes("문서 생성 완료");
  }, null, { timeout: 180000 });
  await page.waitForFunction(() => {
    const text = document.body.innerText || "";
    return document.querySelector(".doc-card-actions button")
      || text.includes("12/12")
      || text.includes("문서팩 준비됨");
  }, null, { timeout: 180000 });
}

async function inspectViewport(browser, viewportName, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: "ko-KR"
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(45000);

  const metrics = [];
  const targetUrl = `${TARGET}/workspace?q=${encodeURIComponent(QUERY)}&theme=day`;
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await waitForGenerated(page);
  await page.waitForTimeout(1000);

  metrics.push(await measurePage(page, `${viewportName}:document-review`));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewportName}-document-review.png`), fullPage: true });

  let editorTransition = "not_attempted";
  try {
    await clickSelector(page, ".doc-card-actions button", { timeout: 10000 });
    await page.waitForSelector(".document-editor-surface, .field-ops-workspace, .workpack-editor", { timeout: 8000 });
    editorTransition = "opened";
  } catch (error) {
    editorTransition = `failed:${error instanceof Error ? error.message : String(error)}`;
  }
  const editorMetrics = await measurePage(page, `${viewportName}:document-editor`);
  editorMetrics.editorTransition = editorTransition;
  metrics.push(editorMetrics);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewportName}-document-editor.png`), fullPage: true });

  if (editorTransition === "opened") {
    try {
      await clickSelector(page, ".document-editor-surface-head button", { timeout: 10000 });
      await page.waitForSelector(".document-workbench", { timeout: 10000 });
    } catch {
      // Keep measuring share from the active page if the return control changes.
    }
  }
  await clickSelector(page, ".document-next-button", { timeout: 10000 });
  await page.waitForTimeout(1200);
  metrics.push(await measurePage(page, `${viewportName}:share`));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewportName}-share.png`), fullPage: true });

  const finalText = await safeText(page.locator("body"));
  await context.close();
  return {
    viewportName,
    viewport,
    generated: true,
    bodyTextSample: finalText.slice(0, 500),
    metrics
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const buildInfo = await fetch(`${TARGET}/api/build-info`).then((response) => response.json());
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    ["desktop-1440x900", { width: 1440, height: 900 }],
    ["mobile-390x844", { width: 390, height: 844 }]
  ];
  const results = [];
  try {
    for (const [name, viewport] of viewports) {
      try {
        results.push(await inspectViewport(browser, name, viewport));
      } catch (error) {
        results.push({
          viewportName: name,
          viewport,
          generated: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    artifact: "workspace-ux-current-2026-07-19",
    generatedAt: new Date().toISOString(),
    target: TARGET,
    buildInfo,
    query: QUERY,
    mutationPerformed: false,
    results
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    buildInfo,
    viewports: results.map((result) => ({ viewportName: result.viewportName, generated: result.generated, error: result.error || null }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
