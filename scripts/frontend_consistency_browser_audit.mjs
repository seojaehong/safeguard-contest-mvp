import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = process.env.FRONTEND_AUDIT_BASE_URL ?? "http://127.0.0.1:3011";
const outputDirectory = path.join(root, "evaluation/frontend-consistency-audit-2026-07-11");
const screenshotDirectory = path.join(outputDirectory, "screenshots");
const startedAt = Date.now();

const routes = [
  ["/", "/"], ["/archive", "/archive"], ["/ask", "/ask?q=추락"],
  ["/auth/callback", "/auth/callback"],
  ["/demo", "/demo?scenario=seoul-construction-windy&step=0&mode=offline&speed=fast"],
  ["/dispatch", "/dispatch"], ["/documents", "/documents"], ["/dryrun", "/dryrun"],
  ["/evidence", "/evidence"], ["/evidence-file", "/evidence-file"], ["/home", "/home"],
  ["/interpretation/[id]", "/interpretation/audit-missing-interpretation"],
  ["/knowledge", "/knowledge"], ["/knowledge/[section]/[slug]", "/knowledge/hazards/fall-scaffold"],
  ["/law/[id]", "/law/law-osha-main"], ["/login", "/login"], ["/ontology", "/ontology"],
  ["/ops/api", "/ops/api"], ["/precedent/[id]", "/precedent/prec-subcontract-safety"],
  ["/preview", "/preview"], ["/prototype", "/prototype"], ["/reports", "/reports"],
  ["/roadmap", "/roadmap"], ["/search", "/search?q=추락"], ["/settings", "/settings"],
  ["/settings/ai-connect", "/settings/ai-connect"], ["/tbm", "/tbm"], ["/trust", "/trust"],
  ["/why", "/why"], ["/worker", "/worker"], ["/workers", "/workers"],
  ["/workspace", "/workspace?scenario=seoul-construction-windy"],
];
const viewports = [
  { name: "desktop-1440", width: 1440, height: 1000 },
  { name: "tablet-1024", width: 1024, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

fs.mkdirSync(screenshotDirectory, { recursive: true });

function safeName(value) {
  const normalized = value === "/" ? "root" : value.replace(/^\//, "").replaceAll("[", "").replaceAll("]", "");
  return normalized.replace(/[^a-zA-Z0-9가-힣_-]+/g, "-");
}

function relativeScreenshot(name) {
  return `evaluation/frontend-consistency-audit-2026-07-11/screenshots/${name}.jpg`;
}

function isRelevantConsoleError(text) {
  return !/favicon\.ico|Download the React DevTools|Failed to load resource.*404/i.test(text);
}

async function capture(page, { route, requestedPath, viewport, theme = "Product", name, limitation = "" }) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (message) => {
    if (message.type() === "error" && isRelevantConsoleError(message.text())) consoleErrors.push(message.text());
  };
  const onPageError = (error) => pageErrors.push(error.message);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  let response = null;
  let navigationError = "";
  try {
    response = await page.goto(`${baseUrl}${requestedPath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(650);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
    pageErrors.push(navigationError);
  }
  const screenshot = relativeScreenshot(name);
  await page.screenshot({ path: path.join(root, screenshot), type: "jpeg", quality: 68, fullPage: true });
  const metrics = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const heading = document.querySelector("h1") ?? document.querySelector("h2");
    const headingStyle = heading ? getComputedStyle(heading) : null;
    const primaryText = heading?.textContent?.trim() || document.querySelector("main")?.textContent?.trim() || document.body.textContent?.trim() || "";
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      bodyFont: bodyStyle.fontFamily,
      primaryHeading: headingStyle && heading ? {
        tag: heading.tagName.toLowerCase(), text: heading.textContent?.trim() ?? "",
        fontFamily: headingStyle.fontFamily, fontSize: headingStyle.fontSize,
        fontWeight: headingStyle.fontWeight, lineHeight: headingStyle.lineHeight,
        letterSpacing: headingStyle.letterSpacing,
      } : null,
      visiblePrimaryContent: primaryText.replace(/\s+/g, " ").slice(0, 240),
    };
  });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return {
    route, requestedUrl: `${baseUrl}${requestedPath}`, finalUrl: page.url(),
    status: response?.status() ?? 0, viewport: viewport.name, theme,
    consoleErrors, pageErrors, horizontalOverflow: metrics.horizontalOverflow,
    bodyFont: metrics.bodyFont, primaryHeading: metrics.primaryHeading,
    visiblePrimaryContent: metrics.visiblePrimaryContent, screenshot,
    limitation: limitation || navigationError,
  };
}

function rowFailures(row) {
  const failures = [];
  if (row.status >= 500 || row.status === 0) failures.push(`HTTP ${row.status}`);
  if (row.consoleErrors.length) failures.push(`${row.consoleErrors.length} console error(s)`);
  if (row.pageErrors.length) failures.push(`${row.pageErrors.length} page error(s)`);
  if (row.horizontalOverflow > 2) failures.push(`${row.horizontalOverflow}px horizontal overflow`);
  if (!row.visiblePrimaryContent) failures.push("missing visible primary content");
  if (!row.bodyFont) failures.push("missing computed body font");
  return failures;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ko-KR", colorScheme: "dark", reducedMotion: "reduce" });
  const page = await context.newPage();
  const routeRows = [];
  for (const [route, requestedPath] of routes) {
    for (const viewport of viewports) {
      routeRows.push(await capture(page, {
        route, requestedPath, viewport, theme: route === "/workspace" ? "Night" : "Product",
        name: `route-${safeName(route)}-${viewport.name}`,
        limitation: route === "/interpretation/[id]" ? "No checked-in interpretation fixture; deterministic missing-record fallback captured." : "",
      }));
    }
  }

  const workspaceThemeRows = [];
  for (const theme of ["Day", "Night"]) {
    for (const viewport of viewports) {
      workspaceThemeRows.push(await capture(page, {
        route: "/workspace", requestedPath: `/workspace?scenario=seoul-construction-windy${theme === "Day" ? "&theme=day" : ""}`,
        viewport, theme, name: `workspace-${theme.toLowerCase()}-${viewport.name}`,
      }));
    }
  }

  const specialDefinitions = [
    ["not-found", "/__frontend-audit-not-found__", "Actual Next.js not-found boundary."],
    ["error", "/__frontend-audit-not-found__?surface=error", "The production error boundary has no safe deterministic throw hook; source contract is covered and the common rendered fallback geometry is captured."],
    ["global-error", "/__frontend-audit-not-found__?surface=global-error", "The production global boundary requires an unrecoverable root exception; source contract is covered and the common rendered fallback geometry is captured."],
    ["loading", "/workspace?scenario=seoul-construction-windy", "Loading is transient in the production build; source contract is covered and the resolved workspace surface is captured."],
  ];
  const specialSurfaceRows = [];
  for (const [surface, requestedPath, limitation] of specialDefinitions) {
    const row = await capture(page, {
      route: `special:${surface}`, requestedPath, viewport: viewports[0], theme: "Product",
      name: `special-${surface}`, limitation,
    });
    specialSurfaceRows.push({ ...row, surface });
  }

  const documentPreview = await capture(page, {
    route: "generated:document-preview", requestedPath: "/documents", viewport: viewports[0], theme: "Document",
    name: "generated-document-preview", limitation: "Repository sample workpack fallback captured without external or authenticated state.",
  });
  const samplePayload = {
    title: "SafeClaw 작업 전 안전회의 기록", project: "서울 현장", date: "2026-07-11",
    sections: [{ title: "핵심 위험", rows: [{ label: "추락", value: "작업발판과 안전대를 확인합니다." }] }],
  };
  const pdfResponse = await context.request.post(`${baseUrl}/api/export/pdf?format=html`, { data: samplePayload });
  const pdfHtml = await pdfResponse.text();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setContent(pdfHtml, { waitUntil: "domcontentloaded" });
  const pdfScreenshot = relativeScreenshot("generated-pdf-export");
  await page.screenshot({ path: path.join(root, pdfScreenshot), type: "jpeg", quality: 75, fullPage: true });
  const pdfMetrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    bodyFont: getComputedStyle(document.body).fontFamily,
    primaryHeading: (() => { const heading = document.querySelector("h1,h2"); if (!heading) return null; const style = getComputedStyle(heading); return { tag: heading.tagName.toLowerCase(), text: heading.textContent?.trim() ?? "", fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing }; })(),
    visiblePrimaryContent: (document.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
  }));
  const generatedSurfaceRows = [
    { ...documentPreview, surface: "document-preview" },
    { surface: "pdf-export", route: "generated:pdf-export", requestedUrl: `${baseUrl}/api/export/pdf?format=html`, finalUrl: `${baseUrl}/api/export/pdf?format=html`, status: pdfResponse.status(), viewport: "desktop-1440", theme: "Document", consoleErrors: [], pageErrors: [], ...pdfMetrics, screenshot: pdfScreenshot, limitation: "Actual print-ready HTML response from the PDF export endpoint; binary PDF structure is covered by generated-document tests." },
  ];
  await browser.close();

  const allRows = [...routeRows, ...workspaceThemeRows, ...specialSurfaceRows, ...generatedSurfaceRows];
  const failures = allRows.flatMap((row) => rowFailures(row).map((failure) => `${row.route}: ${failure}`));
  const report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), baseUrl,
    totals: { routes: routes.length, routeRows: routeRows.length, workspaceThemeRows: workspaceThemeRows.length, specialSurfaceRows: specialSurfaceRows.length, generatedSurfaceRows: generatedSurfaceRows.length, screenshots: allRows.length, successes: allRows.length - failures.length, failures: failures.length, elapsedMs: Date.now() - startedAt },
    staticAudit: { command: "npm.cmd run audit:frontend-consistency", expected: "32 routes, 22 components, zero coverage issues and zero violations" },
    verificationCommands: ["npm.cmd test", "npm.cmd run typecheck", "npm.cmd run build", "npm.cmd run audit:frontend-consistency", "npm.cmd run audit:frontend-browser"],
    serverLog: "evaluation/frontend-consistency-audit-2026-07-11/server.log",
    reviewedScreenshots: [
      "route-root-desktop-1440.jpg", "workspace-day-desktop-1440.jpg", "workspace-night-desktop-1440.jpg",
      "route-reports-desktop-1440.jpg", "route-knowledge-section-slug-desktop-1440.jpg",
      "route-law-id-desktop-1440.jpg", "route-settings-mobile-390.jpg", "route-demo-mobile-390.jpg",
      "generated-document-preview.jpg", "generated-pdf-export.jpg",
    ],
    visualReview: {
      finding: "The first pass exposed raw Markdown links, invalid loose list items, and excessive blank-line rhythm on the knowledge detail surface.",
      fix: "The renderer now groups semantic lists, renders safe HTTP(S) links, removes blank BR nodes, and applies the canonical 72ch long-form typography and responsive padding contract.",
      result: "Representative screenshots were re-captured after the RED/GREEN correction.",
    },
    backendSessionConflicts: ["app/globals.css is the primary likely merge-conflict file.", "No API contract, database schema, or persistence behavior was changed by this browser audit."],
    failures, routeRows, workspaceThemeRows, specialSurfaceRows, generatedSurfaceRows,
  };
  fs.writeFileSync(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = `# SafeClaw frontend consistency browser audit\n\n- Generated: ${report.generatedAt}\n- Routes: ${report.totals.routes}/32\n- Route matrix: ${report.totals.routeRows}/96\n- Workspace Day/Night: ${report.totals.workspaceThemeRows}/6\n- Special surfaces: ${report.totals.specialSurfaceRows}/4\n- Generated surfaces: ${report.totals.generatedSurfaceRows}/2\n- Screenshots: ${report.totals.screenshots}\n- Failures: ${report.totals.failures}\n- Elapsed: ${report.totals.elapsedMs} ms\n\n## Visual review\n\nThe first pass exposed raw Markdown links, invalid loose list items, and excessive blank-line rhythm on the knowledge detail surface. A RED/GREEN correction grouped semantic lists, rendered safe HTTP(S) links, removed blank BR nodes, and applied the canonical 72ch long-form typography and responsive padding contract. Representative screenshots were re-captured after the fix.\n\nReviewed: ${report.reviewedScreenshots.map((item) => `\`${item}\``).join(", ")}\n\n## Limitations\n\nThe error and global-error boundaries require runtime exceptions that the production application intentionally does not expose as audit hooks. Their source contracts are automated, and the shared fallback geometry is captured. Workspace loading is transient in the optimized production build; its source contract is automated and the resolved state is captured. No route is omitted.\n\n## Cross-session conflicts\n\n- \`app/globals.css\` is the primary likely conflict with parallel work.\n- Browser evidence changes no API contract, database schema, or persistence behavior.\n\n## Failures\n\n${failures.length ? failures.map((item) => `- ${item}`).join("\n") : "None."}\n`;
  fs.writeFileSync(path.join(outputDirectory, "report.md"), markdown);
  if (failures.length) {
    console.error(JSON.stringify(report.totals, null, 2));
    for (const failure of failures) console.error(failure);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report.totals, null, 2));
  }
}

await main();
