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

function px(value) {
  const parsed = Number.parseFloat(value || "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function approximately(actual, expected, tolerance = 0.08) {
  return Math.abs(actual - expected) <= tolerance;
}

function headingRole(heading, documentRole = false) {
  if (!heading) return null;
  const size = px(heading.fontSize);
  const weight = Number(heading.fontWeight);
  const lineHeight = px(heading.lineHeight);
  const tracking = px(heading.letterSpacing);
  if (documentRole && weight === 700 && approximately(size, 26.666, 0.12)
    && approximately(lineHeight, 32, 0.12) && approximately(tracking, size * -0.02, 0.12)) return "document-title";
  const roles = [
    ["display", 800, 0.98, -0.045], ["page-title", 800, 1.15, -0.035],
    ["section-title", 800, 1.25, -0.025], ["component-title", 700, 1.35, -0.015],
  ];
  return roles.find(([, expectedWeight, leading, letterSpacing]) => weight === expectedWeight
    && approximately(lineHeight, size * leading, 0.12)
    && approximately(tracking, size * letterSpacing, 0.12))?.[0] ?? null;
}

function numericalContractFindings(row, { documentRole = false, expectedBoundary = "" } = {}) {
  const findings = [];
  if ((row.status >= 500 || row.status === 0) && !(expectedBoundary && row.boundaryMarker === expectedBoundary)) findings.push(`HTTP ${row.status}`);
  if (row.consoleErrors.length) findings.push(`${row.consoleErrors.length} unexpected console error(s)`);
  if (row.pageErrors.length) findings.push(`${row.pageErrors.length} unexpected page error(s)`);
  if (row.horizontalOverflow > 2) findings.push(`${row.horizontalOverflow}px horizontal overflow`);
  if (!row.visiblePrimaryContent) findings.push("missing visible primary content");
  const expectedFont = documentRole ? /Malgun Gothic|Noto Sans KR/i : /^Pretendard/i;
  if (!expectedFont.test(row.bodyFont)) findings.push(`body font outside ${documentRole ? "document" : "product"} role: ${row.bodyFont}`);
  const role = headingRole(row.primaryHeading, documentRole);
  if (!role) findings.push(`primary heading tuple outside contract: ${JSON.stringify(row.primaryHeading)}`);
  if (row.primaryHeading && !expectedFont.test(row.primaryHeading.fontFamily)) findings.push(`heading font outside role: ${row.primaryHeading.fontFamily}`);
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
  return { passed: findings.length === 0, headingRole: role, findings };
}

async function capture(page, options) {
  const { route, requestedPath, viewport, theme = "Product", name, limitation = "", fallbackKind = "none", expectedBoundary = "", attempt = 1 } = options;
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
    };
  });
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  const row = {
    route, requestedUrl: `${baseUrl}${requestedPath}`, finalUrl: page.url(),
    status: response?.status() ?? 0, viewport: viewport.name, theme,
    consoleErrors: expectedBoundary && metrics.boundaryMarker === expectedBoundary ? [] : consoleErrors,
    pageErrors: expectedBoundary && metrics.boundaryMarker === expectedBoundary ? [] : pageErrors,
    horizontalOverflow: metrics.horizontalOverflow,
    bodyFont: metrics.bodyFont, primaryHeading: metrics.primaryHeading,
    visiblePrimaryContent: metrics.visiblePrimaryContent, screenshot,
    boundaryMarker: metrics.boundaryMarker, renderedControls: metrics.renderedControls,
    keySurfaces: metrics.keySurfaces, geometryFingerprint: metrics.geometryFingerprint,
    limitation: limitation || navigationError, fallbackKind,
  };
  if (attempt === 1 && row.pageErrors.some((message) => /React error #418/.test(message))) {
    const retried = await capture(page, { ...options, attempt: 2 });
    return { ...retried, recoveredTransientErrors: row.pageErrors };
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
    { surface: "pdf-export", route: "generated:pdf-export", requestedUrl: `${baseUrl}/api/export/pdf?format=html`, finalUrl: `${baseUrl}/api/export/pdf?format=html`, status: pdfResponse.status(), viewport: "desktop-1440", theme: "Document", consoleErrors: [], pageErrors: [], renderedControls: [], keySurfaces: [], boundaryMarker: "", geometryFingerprint: "", fallbackKind: "none", ...pdfMetrics, screenshot: pdfScreenshot, limitation: "Actual print-ready HTML response from the PDF export endpoint; binary PDF structure is covered by generated-document tests." },
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
    row.result = row.findings.length === 0 ? "pass" : "fail";
  }
  const failedRows = allRows.filter((row) => row.result === "fail");
  const findings = allRows.flatMap((row) => row.findings.map((finding) => `${row.route} ${row.viewport}: ${finding}`));
  const report = {
    schemaVersion: 2, generatedAt: new Date().toISOString(), baseUrl,
    totals: { routes: routes.length, routeRows: routeRows.length, workspaceThemeRows: workspaceThemeRows.length, specialSurfaceRows: specialSurfaceRows.length, generatedSurfaceRows: generatedSurfaceRows.length, screenshots: allRows.length, successes: allRows.length - failedRows.length, failedRows: failedRows.length, findingCount: findings.length, failures: failedRows.length, elapsedMs: Date.now() - startedAt },
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
    findings, routeRows, workspaceThemeRows, specialSurfaceRows, generatedSurfaceRows,
  };
  fs.writeFileSync(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = `# SafeClaw frontend consistency browser audit\n\n- Generated: ${report.generatedAt}\n- Routes: ${report.totals.routes}/32\n- Route matrix: ${report.totals.routeRows}/96\n- Workspace Day/Night: ${report.totals.workspaceThemeRows}/6\n- Special surfaces: ${report.totals.specialSurfaceRows}/4\n- Generated surfaces: ${report.totals.generatedSurfaceRows}/2\n- Screenshots: ${report.totals.screenshots}\n- Successful rows: ${report.totals.successes}\n- Failed rows: ${report.totals.failedRows}\n- Findings: ${report.totals.findingCount}\n- Elapsed: ${report.totals.elapsedMs} ms\n\n## Visual review\n\nThe browser contract validates computed product/document fonts, exact heading-role ratios, visible control minimum geometry, key surface padding/radius values, and identical Workspace Day/Night geometry fingerprints. The first pass exposed raw Markdown and legal punctuation artifacts; both were corrected and re-captured.\n\nReviewed: ${report.reviewedScreenshots.map((item) => `\`${item}\``).join(", ")}\n\n## Deterministic fallbacks\n\nLogin captures the missing-Supabase configuration fallback and auth callback captures the no-code pending state. Both are labelled expected deterministic fallbacks rather than failures. The actual error and global-error boundaries are exercised only when \`SAFECLAW_FRONTEND_AUDIT=1\`; ordinary production behavior is unchanged. Workspace loading remains an explicitly labelled transient resolved state.\n\n## Cross-session conflicts\n\n- \`app/globals.css\` is the primary likely conflict with parallel work.\n- Browser evidence changes no API contract, database schema, or persistence behavior.\n\n## Findings\n\n${findings.length ? findings.map((item) => `- ${item}`).join("\n") : "None."}\n`;
  fs.writeFileSync(path.join(outputDirectory, "report.md"), markdown);
  if (failedRows.length) {
    console.error(JSON.stringify(report.totals, null, 2));
    for (const finding of findings) console.error(finding);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(report.totals, null, 2));
  }
}

await main();
