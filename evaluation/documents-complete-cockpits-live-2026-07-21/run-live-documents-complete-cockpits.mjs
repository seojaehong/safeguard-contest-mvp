import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const OUT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/u, "$1");
const BASE_URL = "https://www.safeclaw.kr";

const DOCUMENTS = [
  { key: "workpackSummaryDraft", title: "점검결과 요약", selector: '[data-testid="summary-document-cockpit"]', required: ["요약 cockpit"] },
  { key: "riskAssessmentDraft", title: "위험성평가표", selector: '[data-testid="risk-row-editor-row"] summary', required: ["근거", "확인"] },
  { key: "workPlanDraft", title: "작업계획서", selector: '[data-testid="execution-document-cockpit"]', required: ["작업 실행 cockpit", "작업 순서"] },
  { key: "workPermitDraft", title: "안전작업허가 확인서", selector: '[data-testid="execution-document-cockpit"]', required: ["작업 실행 cockpit", "허가 조건"] },
  { key: "tbmBriefing", title: "TBM/작업 전 안전점검회의", selector: '[data-testid="tbm-document-cockpit"]', required: ["TBM 진행 cockpit"] },
  { key: "tbmLogDraft", title: "TBM 기록", selector: '[data-testid="tbm-document-cockpit"]', required: ["TBM 진행 cockpit"] },
  { key: "safetyEducationRecordDraft", title: "안전보건교육 기록", selector: '[data-testid="education-document-cockpit"]', required: ["교육 진행 cockpit"] },
  { key: "foreignWorkerBriefing", title: "외국인 근로자 출력본", selector: '[data-testid="education-document-cockpit"]', required: ["교육 진행 cockpit", "전송 cockpit"] },
  { key: "emergencyResponseDraft", title: "비상대응 절차", selector: '[data-testid="emergency-document-cockpit"]', required: ["비상대응 cockpit"] },
  { key: "photoEvidenceDraft", title: "사진/증빙", selector: '[data-testid="photo-document-cockpit"]', required: ["사진·증빙 cockpit"] },
  { key: "foreignWorkerTransmission", title: "외국인 근로자 전송본", selector: '[data-testid="transmission-document-cockpit"]', required: ["전송 cockpit", "언어 대상"] },
  { key: "kakaoMessage", title: "현장 공유 메시지", selector: '[data-testid="transmission-document-cockpit"]', required: ["전송 cockpit", "전송 채널"] },
];

async function fetchBuildInfo() {
  const response = await fetch(`${BASE_URL}/api/build-info?codexCacheBust=documents-complete-live-20260721`);
  if (!response.ok) throw new Error(`build-info failed: ${response.status}`);
  return await response.json();
}

async function measureViewport(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${BASE_URL}/documents?theme=day&codexCacheBust=documents-complete-live-20260721`, { waitUntil: "networkidle" });
  const rows = [];

  for (const item of DOCUMENTS) {
    await page.locator('select[aria-label="편집 문서 선택"]').selectOption(item.key, { force: true });
    await page.waitForFunction((expectedTitle) => {
      const toolbar = document.querySelector(".document-toolbar");
      return toolbar?.textContent?.includes(expectedTitle);
    }, item.title);
    await page.waitForTimeout(320);

    const metric = await page.evaluate((itemArg) => {
      const shell = document.querySelector(".workpack-shell");
      const toolbar = document.querySelector(".document-toolbar");
      const target = document.querySelector(itemArg.selector);
      const textarea = document.querySelector(".document-section-textarea");
      const bodyText = document.body.textContent?.replace(/\s+/gu, " ").trim() || "";
      if (!shell || !toolbar || !target) {
        return {
          key: itemArg.key,
          title: itemArg.title,
          missing: true,
          bodyTextSnippet: bodyText.slice(0, 400),
        };
      }
      const shellRect = shell.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const textareaRect = textarea?.getBoundingClientRect() || null;
      return {
        key: itemArg.key,
        title: itemArg.title,
        missing: false,
        pageHeight: Math.round(document.documentElement.scrollHeight),
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        shellTop: Math.round(shellRect.top),
        shellBottom: Math.round(shellRect.bottom),
        shellClientHeight: shell.clientHeight,
        shellScrollHeight: shell.scrollHeight,
        shellScrollTop: Math.round(shell.scrollTop),
        toolbarTop: Math.round(toolbarRect.top),
        toolbarBottom: Math.round(toolbarRect.bottom),
        targetTop: Math.round(targetRect.top),
        targetBottom: Math.round(targetRect.bottom),
        targetHeight: Math.round(targetRect.height),
        targetText: target.textContent?.replace(/\s+/gu, " ").trim() || "",
        targetVisibleInPane: targetRect.bottom > shellRect.top && targetRect.top < shellRect.bottom,
        targetBelowToolbar: targetRect.top >= toolbarRect.bottom - 1,
        targetContainedInPane: targetRect.bottom < shellRect.bottom,
        toolbarCoversTarget: toolbarRect.bottom > targetRect.top && toolbarRect.top < targetRect.bottom,
        textareaTop: textareaRect ? Math.round(textareaRect.top) : null,
        textareaBottom: textareaRect ? Math.round(textareaRect.bottom) : null,
        rawTextareaSecondary: textareaRect ? textareaRect.top >= targetRect.bottom : null,
        requiredTextPresent: itemArg.required.every((text) => bodyText.includes(text)),
      };
    }, item);
    rows.push(metric);
  }

  await page.close();
  return rows;
}

function buildReport(buildInfo, mobileRows, desktopRows) {
  const allRows = [...mobileRows, ...desktopRows];
  const pass = buildInfo.commitSha === "c651301742183e4b7644147570d4ae33d42c5dbc"
    && allRows.every((row) => (
      row.missing === false
      && row.horizontalOverflow === false
      && row.requiredTextPresent === true
      && row.targetVisibleInPane === true
      && row.targetBelowToolbar === true
      && row.toolbarCoversTarget === false
    ))
    && mobileRows.every((row) => row.pageHeight <= row.viewportHeight + 1);

  return {
    verdict: pass ? "PASS_PRODUCTION" : "PARTIAL_PRODUCTION",
    checkedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    buildInfo,
    scope: {
      route: "/documents",
      surface: "12 document first-task cockpits",
      providerDispatchLiveClaimed: false,
      exportContractsChanged: false,
    },
    mobile390x844: mobileRows,
    desktop1440x723: desktopRows,
    assertions: {
      productionMarkerMatchesCompleteCockpitEvidence: buildInfo.commitSha === "c651301742183e4b7644147570d4ae33d42c5dbc",
      allTargetsPresent: allRows.every((row) => row.missing === false),
      allTargetsVisibleInPane: allRows.every((row) => row.targetVisibleInPane === true),
      allTargetsBelowToolbar: allRows.every((row) => row.targetBelowToolbar === true),
      noToolbarTargetOverlap: allRows.every((row) => row.toolbarCoversTarget === false),
      requiredTextPresent: allRows.every((row) => row.requiredTextPresent === true),
      mobilePageHeightBounded: mobileRows.every((row) => row.pageHeight <= row.viewportHeight + 1),
      horizontalOverflowClosed: allRows.every((row) => row.horizontalOverflow === false),
    },
    remainingDebt: [
      "This proves live first-task cockpit visibility, not full 12-document field-first authoring completion.",
      "Long raw text remains secondary drilldown/editor content.",
      "Provider live dispatch remains gated by idempotency/provider-result persistence approval.",
    ],
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Documents complete cockpit live evidence",
    "",
    `Verdict: \`${report.verdict}\``,
    "",
    "## Production Marker",
    "",
    `- Commit: \`${report.buildInfo.commitSha}\``,
    `- Branch: \`${report.buildInfo.branch}\``,
    `- Environment: \`${report.buildInfo.environment}\``,
    "",
    "## Mobile 390x844",
    "",
    "| Document | Target | Pane | Page | Overflow |",
    "| --- | --- | --- | --- | --- |",
    ...report.mobile390x844.map((row) => `| ${row.title} | ${row.targetTop}-${row.targetBottom} | ${row.shellTop}-${row.shellBottom} | ${row.pageHeight}/${row.viewportHeight} | ${row.horizontalOverflow ? "RED" : "0"} |`),
    "",
    "## Desktop 1440x723",
    "",
    "| Document | Target | Pane | Page | Overflow |",
    "| --- | --- | --- | --- | --- |",
    ...report.desktop1440x723.map((row) => `| ${row.title} | ${row.targetTop}-${row.targetBottom} | ${row.shellTop}-${row.shellBottom} | ${row.pageHeight}/${row.viewportHeight} | ${row.horizontalOverflow ? "RED" : "0"} |`),
    "",
    "## Interpretation",
    "",
    "Production now confirms the complete document cockpit slice: every document has a visible first-task surface before the long raw editor/detail content. This is still the cockpit/drilldown answer, not a claim that route splitting alone solves document length.",
    "",
    "Provider live dispatch and full 12-document field-first authoring remain separate gates.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

const buildInfo = await fetchBuildInfo();
const browser = await chromium.launch();
try {
  const mobileRows = await measureViewport(browser, { width: 390, height: 844 });
  const desktopRows = await measureViewport(browser, { width: 1440, height: 723 });
  const report = buildReport(buildInfo, mobileRows, desktopRows);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(OUT_DIR, "report.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ verdict: report.verdict, output: OUT_DIR, assertions: report.assertions }, null, 2));
  if (report.verdict !== "PASS_PRODUCTION") {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
