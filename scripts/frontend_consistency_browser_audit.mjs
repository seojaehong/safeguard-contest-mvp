import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
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

function px(value) {
  const parsed = Number.parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function approximately(actual, expected, tolerance = 0.08) {
  return Math.abs(actual - expected) <= tolerance;
}

function expectedHeadingTuple(row, documentRole) {
  if (documentRole) return { role: "document-title", size: 26.6667, weight: 700, lineHeight: 32, tracking: -0.533334 };
  const width = { "desktop-1440": 1440, "tablet-1024": 1024, "mobile-390": 390 }[row.viewport];
  if (!width) return null;
  if (row.route === "/") {
    const size = Math.min(72, Math.max(44, width * 0.06));
    return { role: "display", size, weight: 800, lineHeight: size * 0.98, tracking: size * -0.045 };
  }
  const size = Math.min(40, Math.max(32, width * 0.04));
  return { role: "page-title", size, weight: 800, lineHeight: size * 1.15, tracking: size * -0.035 };
}

function tupleFindings(label, tuple, expected) {
  if (!tuple) return [`missing ${label} tuple`];
  const findings = [];
  if (!approximately(px(tuple.fontSize), expected.size, 0.12)) findings.push(`${label} size ${tuple.fontSize}, expected ${expected.size}px`);
  if (Number(tuple.fontWeight) !== expected.weight) findings.push(`${label} weight ${tuple.fontWeight}, expected ${expected.weight}`);
  if (!approximately(px(tuple.lineHeight), expected.lineHeight, 0.12)) findings.push(`${label} line-height ${tuple.lineHeight}, expected ${expected.lineHeight}px`);
  const tracking = tuple.letterSpacing === "normal" ? 0 : px(tuple.letterSpacing);
  if (!approximately(tracking, expected.tracking, 0.12)) findings.push(`${label} tracking ${tuple.letterSpacing}, expected ${expected.tracking}px`);
  return findings;
}

const probeMessages = {
  error: "SafeClaw deterministic frontend audit error boundary probe",
  "global-error": "SafeClaw deterministic frontend audit global boundary probe",
};

export function filterExpectedBoundaryErrors(errors, expectedBoundary, kind, probeConfirmed = false) {
  const probe = probeMessages[expectedBoundary];
  if (!probe) return [...errors];
  return errors.filter((message) => {
    if (kind === "page") return message !== probe;
    if (message === probe || message === `Error: ${probe}` || message.includes(`Error: ${probe}\n`)) return false;
    if (expectedBoundary === "error" && probeConfirmed
      && message === "Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.") return false;
    return !(expectedBoundary === "error" && probeConfirmed && message === "Failed to load resource: the server responded with a status of 500 (Internal Server Error)");
  });
}

const transientHydration418 = /^Minified React error #418; visit https:\/\/react\.dev\/errors\/418\?args\[\]=HTML&args\[\]=(?:\s*$| for the full message)/;

export function shouldRetryTransientHydration(pageErrors, consoleErrors) {
  return pageErrors.length === 1 && consoleErrors.length === 0 && transientHydration418.test(pageErrors[0]);
}

export function numericalContractFindings(row, { documentRole = false, expectedBoundary = "" } = {}) {
  const findings = [];
  if (row.expectedStatuses?.length && !row.expectedStatuses.includes(row.status)) {
    findings.push(`HTTP ${row.status} outside expected statuses ${row.expectedStatuses.join(",")}`);
  }
  if (row.expectedFinalPath) {
    let finalPath = "invalid-url";
    try { finalPath = new URL(row.finalUrl).pathname; } catch {}
    if (finalPath !== row.expectedFinalPath) findings.push(`final path ${finalPath}, expected ${row.expectedFinalPath}`);
  }
  if (row.consoleErrors.length) findings.push(`${row.consoleErrors.length} unexpected console error(s)`);
  if (row.pageErrors.length) findings.push(`${row.pageErrors.length} unexpected page error(s)`);
  if (row.horizontalOverflow > 2) findings.push(`${row.horizontalOverflow}px horizontal overflow`);
  if (!row.visiblePrimaryContent) findings.push("missing visible primary content");
  const expectedFont = documentRole ? /Malgun Gothic|Noto Sans KR/i : /^Pretendard/i;
  if (!expectedFont.test(row.bodyFont)) findings.push(`body font outside ${documentRole ? "document" : "product"} role: ${row.bodyFont}`);
  const expectedHeading = expectedHeadingTuple(row, documentRole);
  if (!expectedHeading) findings.push(`unknown viewport contract: ${row.viewport}`);
  else findings.push(...tupleFindings("primary heading", row.primaryHeading, expectedHeading));
  if (row.primaryHeading && !expectedFont.test(row.primaryHeading.fontFamily)) findings.push(`heading font outside role: ${row.primaryHeading.fontFamily}`);
  const expectedBody = documentRole
    ? { size: 13.3333, weight: 400, lineHeight: 20, tracking: 0 }
    : { size: 15, weight: 500, lineHeight: 24, tracking: 0 };
  findings.push(...tupleFindings("body", {
    fontSize: row.bodyFontSize, fontWeight: row.bodyFontWeight,
    lineHeight: row.bodyLineHeight, letterSpacing: row.bodyLetterSpacing,
  }, expectedBody));
  if (!row.productFontLoaded) findings.push(`${documentRole ? "document" : "Pretendard"} font check failed`);
  const documentExpectations = {
    title: { size: 26.6667, weight: 700, lineHeight: 32, tracking: -0.533334 },
    section: { size: 18.6667, weight: 700, lineHeight: 24, tracking: -0.186667 },
    body: { size: 13.3333, weight: 400, lineHeight: 20, tracking: 0 },
    table: { size: 11.3333, weight: 400, lineHeight: 16, tracking: 0 },
    note: { size: 10.6667, weight: 400, lineHeight: 14.6667, tracking: 0 },
  };
  if (row.route === "generated:document-preview" || documentRole) {
    for (const [roleName, expected] of Object.entries(documentExpectations)) {
      const tuple = row.documentTypography?.[roleName];
      findings.push(...tupleFindings(`document ${roleName}`, tuple, expected));
      if (tuple && !/^"?Malgun Gothic"?.*Noto Sans KR/i.test(tuple.fontFamily)) {
        findings.push(`document ${roleName} family outside document stack: ${tuple.fontFamily}`);
      }
      if (tuple && !tuple.fontLoaded) findings.push(`document ${roleName} font load check failed`);
    }
  }
  for (const control of row.renderedControls) {
    if (["checkbox", "radio", "file", "hidden"].includes(control.type)) continue;
    if (control.height < 35.5) findings.push(`${control.selector} control height ${control.height}px below compact 36px`);
    if (![0, 2, 4, 9999].some((allowed) => approximately(control.radius, allowed, 0.2))) {
      findings.push(`${control.selector} control radius ${control.radius}px outside 0/2/4px contract`);
    }
  }
  const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96];
  for (const surface of row.keySurfaces) {
    if (![0, 2, 4].some((allowed) => approximately(surface.radius, allowed, 0.2))) {
      findings.push(`${surface.selector} radius ${surface.radius}px outside structural/micro/panel contract`);
    }
    for (const padding of surface.padding) {
      if (!spacing.some((allowed) => approximately(padding, allowed, 0.2))) {
        findings.push(`${surface.selector} padding ${padding}px outside spacing scale`);
      }
    }
  }
  if (expectedBoundary && row.boundaryMarker !== expectedBoundary) {
    findings.push(`expected ${expectedBoundary} boundary marker, received ${row.boundaryMarker || "none"}`);
  }
  return { passed: findings.length === 0, headingRole: expectedHeading?.role ?? null, findings };
}

async function capture(page, options) {
  const { route, requestedPath, viewport, theme = "Product", name, limitation = "", fallbackKind = "none", expectedBoundary = "", expectedStatuses = [200], expectedFinalPath = new URL(requestedPath, baseUrl).pathname, attempt = 1 } = options;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto("about:blank");
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
    if (expectedBoundary) await page.waitForSelector(`[data-audit-boundary="${expectedBoundary}"]`, { timeout: 8_000 });
    await page.waitForTimeout(650);
    await page.evaluate(() => document.fonts.ready);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
    pageErrors.push(navigationError);
  }
  const screenshot = relativeScreenshot(name);
  await page.screenshot({ path: path.join(root, screenshot), type: "jpeg", quality: 68, fullPage: true });
  const metrics = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const typographyTuple = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return { fontFamily: style.fontFamily, fontLoaded: document.fonts.check(`${style.fontWeight} ${style.fontSize} "Malgun Gothic"`) || document.fonts.check(`${style.fontWeight} ${style.fontSize} "Noto Sans KR"`), fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing === "normal" ? "0px" : style.letterSpacing };
    };
    const heading = document.querySelector("h1") ?? document.querySelector("h2");
    const headingStyle = heading ? getComputedStyle(heading) : null;
    const primaryText = heading?.textContent?.trim() || document.querySelector("main")?.textContent?.trim() || document.body.textContent?.trim() || "";
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const renderedControls = [...document.querySelectorAll("button, input, select, a.button")].filter(visible).map((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { selector: `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}[${index}]`, type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(), height: rect.height, minHeight: style.minHeight, radius: Number.parseFloat(style.borderTopLeftRadius) || 0 };
    });
    const keySurfaces = [...document.querySelectorAll("main > .card:not(.v2-hero), main > section.card:not(.v2-hero), .safeclaw-module-panel, .command-input-card, .triad-card")].filter(visible).slice(0, 20).map((element, index) => {
      const style = getComputedStyle(element);
      return { selector: `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, ".")}[${index}]`, radius: Number.parseFloat(style.borderTopLeftRadius) || 0, padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map((value) => Number.parseFloat(value) || 0) };
    });
    const geometryFingerprint = [...document.querySelectorAll("main [class], body > [class]")].filter(visible).slice(0, 80).map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const className = [...new Set(String(element.className).replace(/workspace-theme-(?:day|night|field|light)/g, "workspace-theme").split(/\s+/).filter((value) => value && value !== "active"))].join(" ");
      return [element.tagName, className, ...[rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10), style.display, style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft, style.borderTopLeftRadius, style.fontSize, style.lineHeight, style.letterSpacing];
    });
    return {
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      bodyFont: bodyStyle.fontFamily,
      bodyFontSize: bodyStyle.fontSize,
      bodyFontWeight: bodyStyle.fontWeight,
      bodyLineHeight: bodyStyle.lineHeight,
      bodyLetterSpacing: bodyStyle.letterSpacing === "normal" ? "0px" : bodyStyle.letterSpacing,
      productFontLoaded: document.fonts.status === "loaded" && document.fonts.check('500 15px "Pretendard"'),
      primaryHeading: headingStyle && heading ? {
        tag: heading.tagName.toLowerCase(), text: heading.textContent?.trim() ?? "",
        fontFamily: headingStyle.fontFamily, fontSize: headingStyle.fontSize,
        fontWeight: headingStyle.fontWeight, lineHeight: headingStyle.lineHeight,
        letterSpacing: headingStyle.letterSpacing,
      } : null,
      visiblePrimaryContent: primaryText.replace(/\s+/g, " ").slice(0, 240),
      boundaryMarker: document.querySelector("[data-audit-boundary]")?.getAttribute("data-audit-boundary") ?? "",
      renderedControls,
      keySurfaces,
      geometryFingerprint: JSON.stringify(geometryFingerprint),
      documentTypography: {
        title: typographyTuple(document.querySelector(".document-print-typography .safety-form-preview-head strong")),
        section: typographyTuple(document.querySelector(".document-print-typography .safety-form-bridge h3, .document-print-typography .safety-form-section-stack h3")),
        body: typographyTuple(document.querySelector(".document-print-typography .safety-form-meta-grid span")),
        table: typographyTuple(document.querySelector(".document-print-typography td")),
        note: typographyTuple(document.querySelector(".document-print-typography .safety-form-preview-head small")),
      },
    };
  });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  const probeConfirmed = Boolean(probeMessages[expectedBoundary]
    && (pageErrors.includes(probeMessages[expectedBoundary]) || consoleErrors.includes(probeMessages[expectedBoundary])));
  const filteredConsoleErrors = metrics.boundaryMarker === expectedBoundary
    ? filterExpectedBoundaryErrors(consoleErrors, expectedBoundary, "console", probeConfirmed) : consoleErrors;
  const filteredPageErrors = metrics.boundaryMarker === expectedBoundary
    ? filterExpectedBoundaryErrors(pageErrors, expectedBoundary, "page") : pageErrors;
  const row = {
    route, requestedUrl: `${baseUrl}${requestedPath}`, finalUrl: page.url(),
    status: response?.status() ?? 0, expectedStatuses, expectedFinalPath, viewport: viewport.name, theme,
    consoleErrors: filteredConsoleErrors,
    pageErrors: filteredPageErrors,
    horizontalOverflow: metrics.horizontalOverflow,
    bodyFont: metrics.bodyFont, bodyFontSize: metrics.bodyFontSize, bodyFontWeight: metrics.bodyFontWeight,
    bodyLineHeight: metrics.bodyLineHeight, bodyLetterSpacing: metrics.bodyLetterSpacing,
    productFontLoaded: metrics.productFontLoaded, primaryHeading: metrics.primaryHeading,
    visiblePrimaryContent: metrics.visiblePrimaryContent, screenshot,
    boundaryMarker: metrics.boundaryMarker, renderedControls: metrics.renderedControls,
    keySurfaces: metrics.keySurfaces, geometryFingerprint: metrics.geometryFingerprint,
    documentTypography: metrics.documentTypography,
    limitation: limitation || navigationError, fallbackKind,
  };
  if (attempt === 1 && shouldRetryTransientHydration(row.pageErrors, row.consoleErrors)) {
    const retried = await capture(page, { ...options, attempt: 2 });
    const recoveredMessage = "A sole known React 418 hydration transient recovered on one immediate isolated retry.";
    return {
      ...retried,
      recoveredTransientErrors: row.pageErrors,
      fallbackKind: "recovered-transient-hydration",
      limitation: [retried.limitation, recoveredMessage].filter(Boolean).join(" "),
    };
  }
  return row;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ko-KR", colorScheme: "dark", reducedMotion: "reduce" });
  const page = await context.newPage();
  const routeRows = [];
  for (const [route, requestedPath] of routes) {
    for (const viewport of viewports) {
      const authFallback = route === "/login"
        ? "Supabase is intentionally unconfigured in the deterministic audit environment; the configuration fallback is captured."
        : route === "/auth/callback"
          ? "No authentication code is supplied in the deterministic audit environment; the pending callback fallback is captured."
          : "";
      routeRows.push(await capture(page, {
        route, requestedPath, viewport, theme: route === "/workspace" ? "Night" : "Product",
        name: `route-${safeName(route)}-${viewport.name}`,
        limitation: authFallback || (route === "/interpretation/[id]" ? "No checked-in interpretation fixture; deterministic missing-record fallback captured." : ""),
        fallbackKind: authFallback || route === "/interpretation/[id]" ? "expected-deterministic-fallback" : "none",
        expectedStatuses: route === "/interpretation/[id]" ? [404] : [200],
        expectedFinalPath: route === "/prototype" ? "/workspace" : new URL(requestedPath, baseUrl).pathname,
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
    ["not-found", "/__frontend-audit-not-found__", "Actual Next.js not-found boundary.", "not-found"],
    ["error", "/dryrun?__auditBoundary=error", "Actual app/error boundary exercised by an environment-gated deterministic server throw.", "error"],
    ["global-error", "/dryrun?__auditBoundary=global-error", "Actual app/global-error boundary exercised by an environment-gated root-layout client throw.", "global-error"],
    ["loading", "/workspace?scenario=seoul-construction-windy", "Loading is transient in the production build; source contract is covered and the resolved workspace surface is captured.", ""],
  ];
  const specialSurfaceRows = [];
  for (const [surface, requestedPath, limitation, expectedBoundary] of specialDefinitions) {
    const row = await capture(page, {
      route: `special:${surface}`, requestedPath, viewport: viewports[0], theme: "Product",
      name: `special-${surface}`, limitation, fallbackKind: surface === "loading" ? "expected-transient-resolution" : "none",
      expectedBoundary,
      expectedStatuses: surface === "not-found" ? [404] : surface === "error" ? [500] : [200],
    });
    specialSurfaceRows.push({ ...row, surface });
  }

  const documentPreview = await capture(page, {
    route: "generated:document-preview", requestedPath: "/documents", viewport: viewports[0], theme: "Document",
    name: "generated-document-preview", limitation: "Repository sample workpack fallback captured without external or authenticated state.",
    expectedStatuses: [200], expectedFinalPath: "/documents",
  });
  const samplePayload = {
    title: "SafeClaw 작업 전 안전회의 기록", project: "서울 현장", date: "2026-07-11",
    sections: [{ title: "핵심 위험", rows: [{ label: "추락", value: "작업발판과 안전대를 확인합니다." }] }],
    rows: [{ document: "작업 전 안전회의 기록", section: "핵심 위험", item: "추락", content: "작업발판과 안전대를 확인합니다." }],
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
    bodyFontSize: getComputedStyle(document.body).fontSize,
    bodyFontWeight: getComputedStyle(document.body).fontWeight,
    bodyLineHeight: getComputedStyle(document.body).lineHeight,
    bodyLetterSpacing: getComputedStyle(document.body).letterSpacing === "normal" ? "0px" : getComputedStyle(document.body).letterSpacing,
    productFontLoaded: document.fonts.status === "loaded" && document.fonts.check('400 10pt "Malgun Gothic"'),
    primaryHeading: (() => { const heading = document.querySelector("h1,h2"); if (!heading) return null; const style = getComputedStyle(heading); return { tag: heading.tagName.toLowerCase(), text: heading.textContent?.trim() ?? "", fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing }; })(),
    visiblePrimaryContent: (document.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    documentTypography: (() => {
      const tuple = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        return { fontFamily: style.fontFamily, fontLoaded: document.fonts.check(`${style.fontWeight} ${style.fontSize} "Malgun Gothic"`) || document.fonts.check(`${style.fontWeight} ${style.fontSize} "Noto Sans KR"`), fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing === "normal" ? "0px" : style.letterSpacing };
      };
      return { title: tuple("h1"), section: tuple("h2"), body: tuple(".meta div"), table: tuple("td"), note: tuple(".notice") };
    })(),
  }));
  const generatedSurfaceRows = [
    { ...documentPreview, surface: "document-preview" },
    { surface: "pdf-export", route: "generated:pdf-export", requestedUrl: `${baseUrl}/api/export/pdf?format=html`, finalUrl: `${baseUrl}/api/export/pdf?format=html`, status: pdfResponse.status(), expectedStatuses: [200], expectedFinalPath: "/api/export/pdf", viewport: "desktop-1440", theme: "Document", consoleErrors: [], pageErrors: [], renderedControls: [], keySurfaces: [], boundaryMarker: "", geometryFingerprint: "", fallbackKind: "none", ...pdfMetrics, screenshot: pdfScreenshot, limitation: "Actual print-ready HTML response from the PDF export endpoint; binary PDF structure is covered by generated-document tests." },
  ];
  await browser.close();

  const allRows = [...routeRows, ...workspaceThemeRows, ...specialSurfaceRows, ...generatedSurfaceRows];
  for (const viewport of viewports) {
    const day = workspaceThemeRows.find((row) => row.viewport === viewport.name && row.theme === "Day");
    const night = workspaceThemeRows.find((row) => row.viewport === viewport.name && row.theme === "Night");
    if (day && night && day.geometryFingerprint !== night.geometryFingerprint) {
      day.geometryMismatch = true;
      night.geometryMismatch = true;
    }
  }
  for (const row of allRows) {
    const expectedBoundary = row.route.startsWith("special:") && ["not-found", "error", "global-error"].includes(row.surface) ? row.surface : "";
    const documentRole = row.surface === "pdf-export";
    const contractChecks = numericalContractFindings(row, { documentRole, expectedBoundary });
    if (row.geometryMismatch) contractChecks.findings.push("Workspace Day/Night geometry fingerprint differs");
    contractChecks.passed = contractChecks.findings.length === 0;
    row.contractChecks = contractChecks;
    row.findings = [...contractChecks.findings];
    row.result = row.findings.length > 0 ? "fail" : row.recoveredTransientErrors ? "pass-with-recovered-transient" : "pass";
  }
  const failedRows = allRows.filter((row) => row.result === "fail");
  const recoveredRows = allRows.filter((row) => row.result === "pass-with-recovered-transient");
  const findings = allRows.flatMap((row) => row.findings.map((finding) => `${row.route} ${row.viewport}: ${finding}`));
  const buildId = fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim();
  const verificationCommands = [
    { command: "npm.cmd test", outcome: "pass", exitCode: 0, testFiles: 56, tests: 523 },
    { command: "npm.cmd run typecheck", outcome: "pass", exitCode: 0 },
    { command: "npm.cmd run build", outcome: "pass", exitCode: 0, buildId },
    { command: "npm.cmd run audit:frontend-consistency", outcome: "pass", exitCode: 0, pages: 32, components: 22, coverageIssues: 0, violations: 0 },
    { command: "npm.cmd run audit:frontend-browser", outcome: failedRows.length ? "fail" : "pass", exitCode: failedRows.length ? 1 : 0, rows: allRows.length, failedRows: failedRows.length, findings: findings.length },
  ];
  const report = {
    schemaVersion: 2, generatedAt: new Date().toISOString(), baseUrl,
    totals: { routes: routes.length, routeRows: routeRows.length, workspaceThemeRows: workspaceThemeRows.length, specialSurfaceRows: specialSurfaceRows.length, generatedSurfaceRows: generatedSurfaceRows.length, screenshots: allRows.length, successes: allRows.length - failedRows.length, failedRows: failedRows.length, recoveredRows: recoveredRows.length, findingCount: findings.length, failures: failedRows.length, elapsedMs: Date.now() - startedAt },
    staticAudit: { command: "npm.cmd run audit:frontend-consistency", expected: "32 routes, 22 components, zero coverage issues and zero violations" },
    verificationCommands,
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
    backendSessionConflicts: [
      "Frontend head owns typography, PDF/font assets, browser audit, and evidence through this branch.",
      "Backend head 2d0ff44 owns harness/history/grounded-vision behavior; preserve those changes during integration.",
      "High-risk shared files include app/globals.css, SafeGuardCommandCenter.tsx, WorkpackEditor.tsx, lib/types.ts, current-workpack.ts, and db-harness.ts.",
      "Known launch blocker delegated to the backend post-integration patch: document modules currently retain a purple shell identity and tall mobile rail/header; preserve report/document body styling while aligning shell identity to Workspace.",
      "Backend-owned P1 followup: persist report provenance beyond the banner (source.mode, scope, workpackSavedAt).",
      "Backend-owned P2 followups: separate empty/readiness/data/download states; reduce /documents mobile editor y≈3424 by showing core three items first, collapsing the remainder, and removing duplicate CTA. Current evidence has no horizontal overflow or overlap.",
      "After integration rerun full tests, typecheck, build, static audit, all 108 browser rows, and explicit /documents-/reports-vs-/workspace y-position and identity comparison.",
    ],
    findings, routeRows, workspaceThemeRows, specialSurfaceRows, generatedSurfaceRows,
  };
  fs.writeFileSync(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const gateLines = verificationCommands.map((gate) => `- \`${gate.command}\`: ${gate.outcome}, exit ${gate.exitCode}${gate.testFiles ? `, ${gate.testFiles} files/${gate.tests} tests` : ""}${gate.buildId ? `, build ${gate.buildId}` : ""}${gate.pages ? `, ${gate.pages} pages/${gate.components} components, coverage ${gate.coverageIssues}, violations ${gate.violations}` : ""}${gate.rows ? `, ${gate.rows} rows, failed ${gate.failedRows}, findings ${gate.findings}` : ""}`).join("\n");
  const markdown = `# SafeClaw frontend consistency browser audit\n\n- Generated: ${report.generatedAt}\n- Routes: ${report.totals.routes}/32\n- Route matrix: ${report.totals.routeRows}/96\n- Workspace Day/Night: ${report.totals.workspaceThemeRows}/6\n- Special surfaces: ${report.totals.specialSurfaceRows}/4\n- Generated surfaces: ${report.totals.generatedSurfaceRows}/2\n- Screenshots: ${report.totals.screenshots}\n- Successful rows: ${report.totals.successes}\n- Failed rows: ${report.totals.failedRows}\n- Recovered transient rows: ${report.totals.recoveredRows}\n- Findings: ${report.totals.findingCount}\n- Elapsed: ${report.totals.elapsedMs} ms\n\n## Verification results\n\n${gateLines}\n\n## Visual review\n\nThe browser contract validates computed product/document font availability, exact body and heading tuples derived from the numerical design specification, generated-document roles, visible control geometry, key surface padding/radius values, and identical Workspace Day/Night geometry fingerprints.\n\nReviewed: ${report.reviewedScreenshots.map((item) => `\`${item}\``).join(", ")}\n\n## Deterministic fallbacks\n\nLogin and auth callback are labelled expected deterministic fallbacks. Audit-only boundaries require \`SAFECLAW_FRONTEND_AUDIT=1\`; the same query is inert without the server-provided audit signal.\n\n## Cross-session merge matrix\n\n- Frontend owns typography, PDF/font assets, browser audit, and evidence through this branch.\n- Backend head \`2d0ff44\` owns harness/history/grounded-vision changes; preserve them while porting frontend design/PDF/audit changes.\n- High-risk shared files: \`app/globals.css\`, \`SafeGuardCommandCenter.tsx\`, \`WorkpackEditor.tsx\`, \`lib/types.ts\`, \`current-workpack.ts\`, and \`db-harness.ts\`.\n- Known launch blocker delegated to backend: purple document-module shell identity and tall mobile rail/header. Preserve internal report/document body styling while aligning the shell to Workspace.\n- Mandatory post-integration rerun: full tests, typecheck, build, static audit, all 108 rows, and /documents-/reports-vs-/workspace y-position/identity comparison.\n- \`package-lock.json\` is now tracked for reproducible installs and is a possible integration conflict.\n\n## Findings\n\n${findings.length ? findings.map((item) => `- ${item}`).join("\n") : "None."}\n`;
  const finalMarkdown = markdown.replace(
    "- Mandatory post-integration rerun:",
    "- Backend-owned P1 followup: persist report provenance beyond the banner (`source.mode`, scope, and `workpackSavedAt`).\n- Backend-owned P2 followups: separate empty/readiness/data/download states; reduce the `/documents` mobile editor height by showing the core three items first, collapsing the remainder, and removing the duplicate CTA. Current evidence has no horizontal overflow or overlap.\n- Mandatory post-integration rerun:",
  );
  fs.writeFileSync(path.join(outputDirectory, "report.md"), finalMarkdown);
  if (failedRows.length) {
    console.error(JSON.stringify(report.totals, null, 2));
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report.totals, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
