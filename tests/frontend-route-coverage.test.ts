import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { userVisibleRoutes } from "@/lib/frontend-design-contract";

const root = process.cwd();

function runBrowserContractProbe(expression: string): unknown {
  const moduleUrl = pathToFileURL(path.join(root, "scripts/frontend_consistency_browser_audit.mjs")).href;
  const source = `import * as audit from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "--eval", source], { encoding: "utf8" }));
}

type CssDeclarations = Record<string, string>;
type CssRule = { selectors: string[]; declarations: CssDeclarations };
type MediaBlock = { maxWidth: number; sourceIndex: number; endIndex: number; body: string };

const routeFamilies = {
  landing: ["/", "/home", "/why", "/trust", "/roadmap"],
  workbench: ["/workspace", "/reports"],
  module: ["/archive", "/documents", "/dispatch", "/evidence", "/evidence-file", "/ontology", "/tbm", "/worker", "/workers"],
  "knowledge/legal": ["/ask", "/knowledge", "/knowledge/[section]/[slug]", "/search", "/law/[id]", "/interpretation/[id]", "/precedent/[id]"],
  authentication: ["/login", "/auth/callback", "/settings", "/settings/ai-connect"],
  "internal/demo": ["/demo", "/preview", "/prototype", "/dryrun", "/ops/api"],
} as const;

const routeSurfaceOwners: Record<(typeof userVisibleRoutes)[number], string> = {
  "/": "components/SafeClawLanding.tsx",
  "/archive": "components/SafeClawModuleShell.tsx",
  "/ask": "app/ask/page.tsx",
  "/auth/callback": "app/auth/callback/page.tsx",
  "/demo": "components/V2DemoExperience.tsx",
  "/dispatch": "components/SafeClawModuleShell.tsx",
  "/documents": "components/SafeClawModuleShell.tsx",
  "/dryrun": "app/dryrun/page.tsx",
  "/evidence": "components/SafeClawModuleShell.tsx",
  "/evidence-file": "components/SafeClawModuleShell.tsx",
  "/home": "components/SafeClawModuleShell.tsx",
  "/interpretation/[id]": "app/interpretation/[id]/page.tsx",
  "/knowledge": "components/SafeClawModuleShell.tsx",
  "/knowledge/[section]/[slug]": "app/knowledge/[section]/[slug]/page.tsx",
  "/law/[id]": "app/law/[id]/page.tsx",
  "/login": "app/login/page.tsx",
  "/ontology": "components/SafeClawModuleShell.tsx",
  "/ops/api": "components/SafeClawModuleShell.tsx",
  "/precedent/[id]": "app/precedent/[id]/page.tsx",
  "/preview": "app/preview/page.tsx",
  "/prototype": "app/prototype/page.tsx",
  "/reports": "components/SafeClawModuleShell.tsx",
  "/roadmap": "app/roadmap/page.tsx",
  "/search": "app/search/page.tsx",
  "/settings": "components/SafeClawModuleShell.tsx",
  "/settings/ai-connect": "components/SafeClawModuleShell.tsx",
  "/tbm": "components/SafeClawModuleShell.tsx",
  "/trust": "app/trust/page.tsx",
  "/why": "app/why/page.tsx",
  "/worker": "components/SafeClawModuleShell.tsx",
  "/workers": "components/SafeClawModuleShell.tsx",
  "/workspace": "components/SafeGuardCommandCenter.tsx",
};

const canonicalSurfaceHooks: Record<string, string> = {
  "components/SafeClawLanding.tsx": "safeclaw-landing",
  "components/SafeClawModuleShell.tsx": "safeclaw-module-shell",
  "components/V2DemoExperience.tsx": "demo-mode-shell",
  "components/SafeGuardCommandCenter.tsx": "command-center-shell",
  "app/ask/page.tsx": "SafeClawModuleShell",
  "app/auth/callback/page.tsx": "safeclaw-login-page",
  "app/dryrun/page.tsx": "SafeClawModuleShell",
  "app/interpretation/[id]/page.tsx": "container grid",
  "app/knowledge/[section]/[slug]/page.tsx": "knowledge-shell",
  "app/law/[id]/page.tsx": "container grid",
  "app/login/page.tsx": "safeclaw-login-page",
  "app/precedent/[id]/page.tsx": "container grid",
  "app/preview/page.tsx": "SafeClawModuleShell",
  "app/roadmap/page.tsx": "SafeClawModuleShell",
  "app/search/page.tsx": "SafeClawModuleShell",
  "app/trust/page.tsx": "SafeClawModuleShell",
  "app/why/page.tsx": "SafeClawModuleShell",
};

const delegatedHeadingOwners: Partial<Record<(typeof userVisibleRoutes)[number], string>> = {
  "/ask": "components/SafeClawModuleShell.tsx",
  "/login": "components/AdminLoginPanel.tsx",
  "/auth/callback": "components/AuthCallbackClient.tsx",
  "/dryrun": "components/SafeClawModuleShell.tsx",
  "/preview": "components/SafeClawModuleShell.tsx",
  "/roadmap": "components/SafeClawModuleShell.tsx",
  "/search": "components/SafeClawModuleShell.tsx",
  "/trust": "components/SafeClawModuleShell.tsx",
  "/why": "components/SafeClawModuleShell.tsx",
};

const sharedComponentOwners = {
  "components/AdminLoginPanel.tsx": "AdminLoginPanel",
  "components/AuthCallbackClient.tsx": "AuthCallbackClient",
  "components/SafeClawLanding.tsx": "SafeClawLanding",
  "components/SafeClawModuleShell.tsx": "SafeClawModuleShell",
  "components/V2DemoExperience.tsx": "V2DemoExperience",
  "components/SafeGuardCommandCenter.tsx": "SafeGuardCommandCenter",
} as const;

function listPageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listPageFiles(absolutePath);
    return entry.name === "page.tsx" ? [absolutePath] : [];
  });
}

function routeFromPageFile(filePath: string): string {
  const relativeDirectory = path.relative(path.join(root, "app"), path.dirname(filePath));
  if (!relativeDirectory) return "/";
  return `/${relativeDirectory.split(path.sep).join("/")}`;
}

function pageFileFromRoute(route: string): string {
  return route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function ruleBlocks(source: string): CssRule[] {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.replace(/\s+/g, " ").trim()),
    declarations: Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    ),
  }));
}

function declarationsForExactSelector(source: string, selector: string): CssDeclarations {
  return Object.assign(
    {},
    ...ruleBlocks(source).filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.declarations),
  );
}

function mediaBlocks(source: string): MediaBlock[] {
  const blocks: MediaBlock[] = [];
  const pattern = /@media\s*\(max-width:\s*(\d+)px\)\s*\{/g;
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const openingBrace = source.indexOf("{", match.index);
    let depth = 0;
    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push({
          maxWidth: Number(match[1]),
          sourceIndex: match.index,
          endIndex: index + 1,
          body: source.slice(openingBrace + 1, index),
        });
        break;
      }
    }
  }
  return blocks;
}

function withoutMediaBlocks(source: string): string {
  let cursor = 0;
  let result = "";
  for (const block of mediaBlocks(source)) {
    result += source.slice(cursor, block.sourceIndex);
    cursor = block.endIndex;
  }
  return result + source.slice(cursor);
}

function effectiveDeclarationsAtWidth(source: string, selector: string, width: number): CssDeclarations {
  const declarations = declarationsForExactSelector(withoutMediaBlocks(source), selector);
  for (const block of mediaBlocks(source).filter((item) => item.maxWidth >= width).sort((a, b) => a.sourceIndex - b.sourceIndex)) {
    Object.assign(declarations, declarationsForExactSelector(block.body, selector));
  }
  return declarations;
}

const approvedSpacingPixels = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]);
const approvedSpacingTokens = new Set([
  "--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6",
  "--space-8", "--space-10", "--space-12", "--space-16", "--space-20", "--space-24",
]);
const justifiedSemanticSpacingTokens = new Set(["--os-gutter"]);
const justifiedResponsiveSpacingExpressions = new Set([
  ".safeclaw-landing-nav nav|gap|clamp(var(--space-4), 2.4vw, var(--space-10))",
  ".safeclaw-hero-copy|padding|clamp(var(--space-10), 7vw, var(--space-24))",
  ".safeclaw-hero-console|padding|clamp(32px, 5vw, 64px)",
  ".safeclaw-statement-card|padding|clamp(var(--space-8), 5vw, var(--space-16))",
  ".safeclaw-core-section|padding|clamp(var(--space-10), 6vw, var(--space-20))",
  ".safeclaw-operation-section|padding|clamp(var(--space-10), 6vw, var(--space-20))",
  ".safeclaw-os-tag|margin-bottom|clamp(var(--space-8), 4vw, var(--space-16))",
  ".safeclaw-os-hero-body|gap|clamp(var(--space-8), 5vw, var(--space-20))",
  ".safeclaw-os-hero-body|padding|clamp(var(--space-12), 6vw, var(--space-20)) 0",
  ".safeclaw-os-section|padding-block|clamp(var(--space-16), 6vw, var(--space-24))",
  ".safeclaw-os-section.compact|padding-top|clamp(var(--space-12), 5vw, var(--space-20))",
  "#language|padding-bottom|clamp(var(--space-8), 3vw, var(--space-12))",
  "#proof|padding-top|clamp(var(--space-8), 3vw, var(--space-12))",
  ".safeclaw-landing-footer|padding-block|clamp(48px, 6vw, 80px)",
  ".safeclaw-module-nav|padding|0 clamp(20px, 3vw, 48px)",
]);
const ordinaryModuleOwnedClasses = new Set([
  "advanced-download-grid", "advanced-downloads", "doc-card-evidence-badge",
  "knowledge-entry-grid", "knowledge-entry-list", "knowledge-index-card", "knowledge-status-grid",
  "ontology-empty-panel", "ontology-hover-card", "ontology-kind-list", "ontology-list-column", "ontology-map-column",
  "ontology-node-list", "ontology-node-row", "ontology-summary-grid", "ontology-workbench",
  "safeclaw-archive-list", "safeclaw-current-workpack", "safeclaw-evidence-group",
  "safeclaw-module-actions", "safeclaw-module-brand", "safeclaw-module-card", "safeclaw-module-content",
  "safeclaw-module-description", "safeclaw-module-eyebrow", "safeclaw-module-grid", "safeclaw-module-header",
  "safeclaw-module-list", "safeclaw-module-main", "safeclaw-module-nav", "safeclaw-module-navigation",
  "safeclaw-module-panel", "safeclaw-module-primary", "safeclaw-module-rail", "safeclaw-module-shell",
  "safeclaw-module-title", "safeclaw-section-title", "safeclaw-setting-description", "safeclaw-tbm-board",
  "safeclaw-worker-phone", "safeclaw-worker-table", "sc-blink", "sc-blink--good",
  "worker-ack-note", "worker-language-note", "worker-language-preview", "worker-language-switcher",
  "briefing-settings-card", "briefing-settings-form",
  "ai-connect-actions", "ai-connect-command", "ai-connect-command-box", "ai-connect-empty", "ai-connect-meta",
  "ai-connect-secret", "ai-connect-tabs", "ai-connect-token-items", "ai-connect-token-list", "ai-connect-workspace",
]);
const auditedSpacingProperties = new Set([
  "gap", "row-gap", "column-gap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "top", "right", "bottom", "left",
]);

function isAuditedFamilySelector(selector: string): boolean {
  const landingOwner = /\.(?:safeclaw-(?:landing|os-|hero|proof|statement|core|operation|pipeline|language|module-map|terminal|footer)|hero-console|console-|sc-section-kicker)/.test(selector)
    || /\.safeclaw-(?:contact|login)(?=[\s.:#>+~,\[]|$)/.test(selector);
  const ordinaryModuleOwner = [...ordinaryModuleOwnedClasses].some((className) => selector.includes(`.${className}`))
    && !selector.includes("module-variant-document")
    && !selector.includes(".safeclaw-module-hero.document");
  return landingOwner || ordinaryModuleOwner;
}

function isJustifiedSpacingException(selector: string, property: string, value: string): boolean {
  const separatorGapSelectors = new Set([
    ".safeclaw-proof-strip",
    ".safeclaw-core-grid",
    ".safeclaw-operation-section ol",
    ".ontology-node-list",
    ".ontology-kind-list",
  ]);
  return property === "gap" && value === "1px" && separatorGapSelectors.has(selector);
}

function familySpacingResiduals(source: string): string[] {
  return ruleBlocks(source).flatMap((rule) => {
    const ownedSelectors = rule.selectors.filter(isAuditedFamilySelector);
    if (ownedSelectors.length === 0) return [];
    return Object.entries(rule.declarations).flatMap(([property, value]) => {
      if (!auditedSpacingProperties.has(property)) return [];
      const selectorsToAudit = ownedSelectors.filter((selector) => !isJustifiedSpacingException(selector, property, value));
      if (selectorsToAudit.length === 0) return [];
      const offenders = [...value.matchAll(/(?<![\w.-])([-+]?(?:\d+(?:\.\d+)?|\.\d+))px(?![\w.-])/g)]
        .map((match) => Number(match[1]))
        .filter((number) => !approvedSpacingPixels.has(Math.abs(number)));
      const tokenOffenders = [...value.matchAll(/var\((--[\w-]+)\)/g)]
        .map((match) => match[1])
        .filter((token) => !approvedSpacingTokens.has(token) && !justifiedSemanticSpacingTokens.has(token));
      const hasForbiddenUnit = /(?:^|[\s,(])[-+]?\d*\.?\d+(?:em|rem|%|vw|vh|vmin|vmax)(?![\w-])/.test(value);
      const hasExpression = /\b(?:calc|clamp|min|max)\(/.test(value);
      const expressionAllowed = selectorsToAudit.every((selector) => justifiedResponsiveSpacingExpressions.has(`${selector}|${property}|${value}`));
      const expressionOffender = (hasForbiddenUnit || hasExpression) && !expressionAllowed;
      return offenders.length || tokenOffenders.length || expressionOffender
        ? selectorsToAudit.map((selector) => `${selector} { ${property}: ${value} }`)
        : [];
    });
  });
}

describe("frontend route classification", () => {
  it("discovers every page and assigns each route to exactly one family", () => {
    const discoveredRoutes = listPageFiles(path.join(root, "app")).map(routeFromPageFile).sort();
    const contractedRoutes = [...userVisibleRoutes].sort();
    const classifiedRoutes = Object.values(routeFamilies).flat();

    expect(discoveredRoutes).toEqual(contractedRoutes);
    expect([...classifiedRoutes].sort()).toEqual(discoveredRoutes);
    expect(new Set(classifiedRoutes).size).toBe(classifiedRoutes.length);
  });

  it("gives every rendered route a semantic title and its canonical surface hook", () => {
    for (const routes of Object.values(routeFamilies)) {
      for (const route of routes) {
        const owner = routeSurfaceOwners[route];
        const source = read(owner);
        if (route === "/prototype") {
          expect(source).toContain('redirect("/workspace")');
          continue;
        }

        expect(source, `${route} surface hook`).toContain(canonicalSurfaceHooks[owner]);
        const headingSource = delegatedHeadingOwners[route] ? read(delegatedHeadingOwners[route]) : source;
        expect(headingSource, `${route} semantic page title`).toMatch(/<h1\b/);
      }
    }
  });

  it("verifies every delegated route still renders its declared surface owner", () => {
    for (const owner of Object.values(delegatedHeadingOwners)) {
      expect(sharedComponentOwners, `${owner} delegated owner`).toHaveProperty(owner);
    }

    for (const route of userVisibleRoutes) {
      const pageSource = read(pageFileFromRoute(route));
      const owners = [routeSurfaceOwners[route], delegatedHeadingOwners[route]].filter(
        (owner): owner is string => Boolean(owner),
      );

      for (const owner of owners) {
        if (!(owner in sharedComponentOwners)) continue;
        const componentName = sharedComponentOwners[owner as keyof typeof sharedComponentOwners];

        expect(pageSource, `${route} renders ${componentName}`).toContain(`<${componentName}`);
        if (componentName === "SafeClawModuleShell") {
          expect(pageSource, `${route} module title`).toMatch(/\btitle=/);
          expect(pageSource, `${route} module description`).toMatch(/\bdescription=/);
        }
      }
    }
  });
});

describe("browser evidence reconciliation", () => {
  it("reconciles the complete route, theme, special-state, and generated-surface evidence", () => {
    const reportPath = path.join(root, "evaluation/frontend-consistency-audit-2026-07-11/report.json");
    expect(fs.existsSync(reportPath), "browser audit report exists").toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
      routeRows: Array<Record<string, unknown>>;
      workspaceThemeRows: Array<Record<string, unknown>>;
      specialSurfaceRows: Array<Record<string, unknown>>;
      generatedSurfaceRows: Array<Record<string, unknown>>;
      totals: { failures: number };
    };
    const viewports = ["desktop-1440", "tablet-1024", "mobile-390"];
    const requiredFields = [
      "requestedUrl", "finalUrl", "status", "viewport", "theme", "consoleErrors",
      "pageErrors", "horizontalOverflow", "bodyFont", "bodyFontSize", "bodyFontWeight",
      "bodyLineHeight", "bodyLetterSpacing", "productFontLoaded", "primaryHeading", "visiblePrimaryContent",
      "screenshot", "limitation",
    ];

    expect(report.routeRows).toHaveLength(userVisibleRoutes.length * viewports.length);
    for (const route of userVisibleRoutes) {
      for (const viewport of viewports) {
        const row = report.routeRows.find((item) => item.route === route && item.viewport === viewport);
        expect(row, `${route} ${viewport}`).toBeDefined();
      }
    }

    expect(report.workspaceThemeRows).toHaveLength(viewports.length * 2);
    for (const theme of ["Day", "Night"]) {
      for (const viewport of viewports) {
        expect(
          report.workspaceThemeRows.find((item) => item.theme === theme && item.viewport === viewport),
          `workspace ${theme} ${viewport}`,
        ).toBeDefined();
      }
    }
    expect(report.specialSurfaceRows.map((row) => row.surface).sort()).toEqual([
      "error", "global-error", "loading", "not-found",
    ]);
    expect(report.generatedSurfaceRows.map((row) => row.surface).sort()).toEqual([
      "document-preview", "pdf-export",
    ]);

    for (const row of [
      ...report.routeRows,
      ...report.workspaceThemeRows,
      ...report.specialSurfaceRows,
      ...report.generatedSurfaceRows,
    ]) {
      for (const field of requiredFields) expect(row, `${String(row.route ?? row.surface)} ${field}`).toHaveProperty(field);
      const screenshot = String(row.screenshot);
      expect(screenshot).toMatch(/^evaluation\/frontend-consistency-audit-2026-07-11\/screenshots\//);
      expect(fs.existsSync(path.join(root, screenshot)), screenshot).toBe(true);
    }
    expect(report.totals.failures).toBe(0);
  });

  it("proves actual named framework boundaries and numerical rendered contracts", () => {
    const report = JSON.parse(read("evaluation/frontend-consistency-audit-2026-07-11/report.json")) as {
      specialSurfaceRows: Array<Record<string, unknown>>;
      routeRows: Array<Record<string, unknown>>;
      workspaceThemeRows: Array<Record<string, unknown>>;
      generatedSurfaceRows: Array<Record<string, unknown>>;
      totals: Record<string, number>;
    };
    const allRows = [...report.routeRows, ...report.workspaceThemeRows, ...report.specialSurfaceRows, ...report.generatedSurfaceRows];
    const totalRows = allRows.length;

    expect(report.totals.successes + report.totals.failedRows).toBe(totalRows);
    expect(report.totals.failedRows).toBe(0);
    expect(report.totals.findingCount).toBe(0);
    expect(report.totals.recoveredRows).toBeLessThanOrEqual(1);
    expect(report.totals.successes).toBeGreaterThanOrEqual(0);
    for (const row of allRows) {
      expect(["pass", "pass-with-recovered-transient"]).toContain(row.result);
      expect(row.contractChecks).toMatchObject({ passed: true, findings: [] });
    }
    for (const surface of ["not-found", "error", "global-error"]) {
      const row = report.specialSurfaceRows.find((item) => item.surface === surface);
      expect(row?.boundaryMarker, surface).toBe(surface);
      expect(String(row?.visiblePrimaryContent), surface).toContain(
        surface === "not-found" ? "찾을 수 없는 문서" : surface === "error" ? "일시적인 오류" : "서비스에 일시적인 문제",
      );
    }
    for (const route of ["/login", "/auth/callback"]) {
      for (const row of report.routeRows.filter((item) => item.route === route)) {
        expect(String(row.limitation), `${route} fallback`).not.toBe("");
        expect(row.fallbackKind).toBe("expected-deterministic-fallback");
      }
    }
  });

  it("keeps total reconciliation correct when one failed row has multiple findings", () => {
    const summarize = (rows: Array<{ findings: string[] }>) => ({
      successes: rows.filter((row) => row.findings.length === 0).length,
      failedRows: rows.filter((row) => row.findings.length > 0).length,
      findingCount: rows.reduce((total, row) => total + row.findings.length, 0),
    });
    const totals = summarize([{ findings: [] }, { findings: ["font", "radius"] }]);

    expect(totals).toEqual({ successes: 1, failedRows: 1, findingCount: 2 });
    expect(totals.successes + totals.failedRows).toBe(2);
    expect(totals.successes).toBeGreaterThanOrEqual(0);
  });

  it("rejects independent exact typography and unloaded-font mutations", () => {
    const validRow = {
      route: "/workspace", viewport: "desktop-1440", status: 200, consoleErrors: [], pageErrors: [],
      horizontalOverflow: 0, visiblePrimaryContent: "작업공간", boundaryMarker: "",
      bodyFont: 'Pretendard, "Noto Sans KR", sans-serif', bodyFontSize: "15px", bodyFontWeight: "500",
      bodyLineHeight: "24px", bodyLetterSpacing: "0px", productFontLoaded: true,
      primaryHeading: { tag: "h1", text: "작업공간", fontFamily: "Pretendard", fontSize: "40px", fontWeight: "800", lineHeight: "46px", letterSpacing: "-1.4px" },
      renderedControls: [], keySurfaces: [], documentTypography: {},
    };
    const probe = (row: object) => runBrowserContractProbe(`audit.numericalContractFindings(${JSON.stringify(row)})`) as { findings: string[] };

    expect(probe(validRow).findings).toEqual([]);
    for (const mutation of [
      { primaryHeading: { ...validRow.primaryHeading, fontSize: "39px", lineHeight: "44.85px", letterSpacing: "-1.365px" } },
      { bodyFont: "Arial, sans-serif" },
      { bodyLineHeight: "23px" },
      { bodyLetterSpacing: "1px" },
      { productFontLoaded: false },
    ]) {
      expect(probe({ ...validRow, ...mutation }).findings, JSON.stringify(mutation)).not.toEqual([]);
    }
  }, 30_000);

  it("rejects a product font leaking into any generated-document role", () => {
    const role = (fontFamily: string) => ({
      fontFamily, fontLoaded: true, fontSize: "18.6667px", fontWeight: "700",
      lineHeight: "24px", letterSpacing: "-0.186667px",
    });
    const documentFamily = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const row = {
      route: "generated:document-preview", viewport: "desktop-1440", status: 200,
      consoleErrors: [], pageErrors: [], horizontalOverflow: 0, visiblePrimaryContent: "문서",
      boundaryMarker: "", bodyFont: 'Pretendard, "Noto Sans KR", sans-serif',
      bodyFontSize: "15px", bodyFontWeight: "500", bodyLineHeight: "24px", bodyLetterSpacing: "0px",
      productFontLoaded: true,
      primaryHeading: { fontFamily: "Pretendard", fontSize: "40px", fontWeight: "800", lineHeight: "46px", letterSpacing: "-1.4px" },
      renderedControls: [], keySurfaces: [],
      documentTypography: {
        title: { ...role(documentFamily), fontSize: "26.6667px", lineHeight: "32px", letterSpacing: "-0.533333px" },
        section: role('Pretendard, "Noto Sans KR", sans-serif'),
        body: { ...role(documentFamily), fontSize: "13.3333px", fontWeight: "400", lineHeight: "20px", letterSpacing: "0px" },
        table: { ...role(documentFamily), fontSize: "11.3333px", fontWeight: "400", lineHeight: "16px", letterSpacing: "0px" },
        note: { ...role(documentFamily), fontSize: "10.6667px", fontWeight: "400", lineHeight: "14.6667px", letterSpacing: "0px" },
      },
    };
    const result = runBrowserContractProbe(`audit.numericalContractFindings(${JSON.stringify(row)})`) as { findings: string[] };
    expect(result.findings).toContain("document section family outside document stack: Pretendard, \"Noto Sans KR\", sans-serif");
  }, 15_000);

  it("retains unrelated boundary and hydration errors", () => {
    const probeErrors = ["SafeClaw deterministic frontend audit error boundary probe", "unrelated runtime failure"];
    const filtered = runBrowserContractProbe(`audit.filterExpectedBoundaryErrors(${JSON.stringify(probeErrors)}, "error", "page")`) as string[];
    expect(filtered).toEqual(["unrelated runtime failure"]);
    const genericServerError = "Error: An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.";
    expect(runBrowserContractProbe(`audit.filterExpectedBoundaryErrors([${JSON.stringify(genericServerError)}], "error", "console")`)).toEqual([genericServerError]);
    expect(runBrowserContractProbe(`audit.filterExpectedBoundaryErrors([${JSON.stringify(genericServerError)}, "unrelated console failure"], "error", "console", true)`)).toEqual(["unrelated console failure"]);

    expect(runBrowserContractProbe(`audit.shouldRetryTransientHydration(["Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]="], [])`)).toBe(true);
    expect(runBrowserContractProbe(`audit.shouldRetryTransientHydration(["Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings."], [])`)).toBe(true);
    expect(runBrowserContractProbe(`audit.shouldRetryTransientHydration(["Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]=", "unrelated runtime failure"], [])`)).toBe(false);
    expect(runBrowserContractProbe(`audit.shouldRetryTransientHydration(["Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]="], ["unrelated console failure"])`)).toBe(false);
  }, 30_000);

  it("rejects unexpected HTTP status and final URL mutations", () => {
    const base = {
      route: "/workspace", viewport: "desktop-1440", status: 200,
      expectedStatuses: [200], expectedFinalPath: "/workspace", finalUrl: "http://127.0.0.1:3011/workspace",
      consoleErrors: [], pageErrors: [], horizontalOverflow: 0, visiblePrimaryContent: "작업공간",
      boundaryMarker: "", bodyFont: 'Pretendard, "Noto Sans KR", sans-serif', bodyFontSize: "15px",
      bodyFontWeight: "500", bodyLineHeight: "24px", bodyLetterSpacing: "0px", productFontLoaded: true,
      primaryHeading: { fontFamily: "Pretendard", fontSize: "40px", fontWeight: "800", lineHeight: "46px", letterSpacing: "-1.4px" },
      renderedControls: [], keySurfaces: [], documentTypography: {},
    };
    const probe = (row: object) => runBrowserContractProbe(`audit.numericalContractFindings(${JSON.stringify(row)})`) as { findings: string[] };
    expect(probe(base).findings).toEqual([]);
    expect(probe({ ...base, status: 404 }).findings).toContain("HTTP 404 outside expected statuses 200");
    expect(probe({ ...base, finalUrl: "http://127.0.0.1:3011/login" }).findings).toContain("final path /login, expected /workspace");
  }, 15_000);

  it("keeps the normal-production audit query inert and reports structured gates", () => {
    const errorSource = read("app/error.tsx");
    expect(errorSource).toContain('[data-safeclaw-audit-enabled="true"]');
    expect(errorSource).toContain('__auditBoundary") === "error"');
    const report = JSON.parse(read("evaluation/frontend-consistency-audit-2026-07-11/report.json")) as { verificationCommands: unknown[] };
    expect(report.verificationCommands).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: "npm.cmd test", outcome: "pass", exitCode: 0, testFiles: 56, tests: 523 }),
      expect.objectContaining({ command: "npm.cmd run build", outcome: "pass", exitCode: 0 }),
    ]));
  });
});

describe("knowledge and legal route hierarchy", () => {
  it("renders knowledge Markdown as compact semantic prose, lists, and links", () => {
    const source = read("app/knowledge/[section]/[slug]/page.tsx");

    expect(source).toContain("function renderInlineMarkdown");
    expect(source).toContain("<ul key={`list-${listStart}`}>");
    expect(source).toContain("renderInlineMarkdown(line)");
    expect(source).not.toContain("<br key={index}");
  });

  it("filters isolated punctuation artifacts from legal body sections", () => {
    const source = read("app/law/[id]/page.tsx");
    expect(source).toContain('if (line.trim() === ".") continue;');
    expect(declarationsForExactSelector(read("app/globals.css"), ".legal-detail-page hr")).toMatchObject({
      width: "100%",
      margin: "0",
      border: "0",
      "border-top": "1px solid var(--line)",
    });
  });

  it.each([
    "app/law/[id]/page.tsx",
    "app/precedent/[id]/page.tsx",
    "app/interpretation/[id]/page.tsx",
  ])("uses one semantic page title followed by semantic sections in %s", (relativePath) => {
    const source = read(relativePath);

    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source).toContain('<h1 className="title small-title">');
    expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source.match(/<h2 className="h2">/g)).toHaveLength(2);
    expect(source).not.toMatch(/<div className="h[23]">/);
  });

  it("binds legal prose and preformatted bodies to the long-form reading contract", () => {
    const css = withoutMediaBlocks(read("app/globals.css"));
    const lawSource = read("app/law/[id]/page.tsx");
    const precedentSource = read("app/precedent/[id]/page.tsx");
    const interpretationSource = read("app/interpretation/[id]/page.tsx");

    expect(lawSource).toContain("legal-detail-page");
    expect(precedentSource).toContain('<pre className="legal-reading-body">');
    expect(interpretationSource).toContain('<pre className="legal-reading-body">');
    expect(declarationsForExactSelector(css, ".law-body-viewer")).toMatchObject({
      "max-width": "var(--content-reading)",
    });
    expect(declarationsForExactSelector(css, ".law-section-lines p")).toMatchObject({
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-longform)",
    });
    expect(declarationsForExactSelector(css, ".legal-reading-body")).toMatchObject({
      width: "100%",
      "max-width": "var(--content-reading)",
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-longform)",
    });
  });

  it("uses semantic section and result headings on ask and search surfaces", () => {
    const sources = [
      "app/ask/page.tsx",
      "app/search/page.tsx",
      "components/AnswerPanel.tsx",
      "components/CitationList.tsx",
      "components/ResultCard.tsx",
    ].map(read).join("\n");

    expect(sources).not.toMatch(/<div className="h[23]">/);
    expect(sources.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(read("components/ResultCard.tsx")).toContain('<h3 className="h3">');
  });
});

describe("informational and demo route hierarchy", () => {
  it.each(["app/why/page.tsx", "app/trust/page.tsx", "app/roadmap/page.tsx"])(
    "uses semantic section headings and the landing family hook in %s",
    (relativePath) => {
      const source = read(relativePath);

      expect(source).toContain("SafeClawModuleShell");
      expect(read("components/SafeClawModuleShell.tsx").match(/<h1\b/g)).toHaveLength(1);
      expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThan(0);
    },
  );

  it("uses semantic section and card headings throughout the demo", () => {
    const source = read("components/V2DemoExperience.tsx");
    const triadStart = source.indexOf('<section className="primary-triad-grid">');
    const triadEnd = source.indexOf("</section>", triadStart);
    const triadSource = source.slice(triadStart, triadEnd);

    expect(source).toContain("demo-mode-shell");
    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(source.match(/<h3\b/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(triadSource.match(/<h2\b/g)).toHaveLength(3);
    expect(triadSource).not.toMatch(/<h3\b/);
    expect(source.indexOf("<h2", source.indexOf("<h1"))).toBeLessThan(source.indexOf("<h3"));
  });
});

describe("module route section hierarchy", () => {
  it("promotes knowledge and settings section labels to semantic headings", () => {
    const knowledge = read("app/knowledge/page.tsx");
    const settings = read("app/settings/page.tsx");
    const briefing = read("components/BriefingSettingsCard.tsx");

    expect(knowledge.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(settings).toContain('<h2 className="safeclaw-section-title">{title}</h2>');
    expect(briefing).toContain('<h2 className="safeclaw-section-title">아침 브리핑</h2>');
  });

  it("keeps landing, preview, and ontology sections sequential", () => {
    expect(read("components/SafeClawLanding.tsx").match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(read("app/preview/page.tsx")).toContain('<h2 className="safeclaw-section-title">접어서 제공하는 8종</h2>');
    expect(read("app/ontology/page.tsx")).toContain('<h2 className="safeclaw-section-title">노드 리스트</h2>');
  });

  it("uses named canonical spacing hooks instead of inline layout styles on the dry-run route", () => {
    const source = read("app/dryrun/page.tsx");

    expect(source).toContain("SafeClawModuleShell");
    expect(source).not.toMatch(/style=\{\{/);
  });

  it("binds route-family body, card, control, V2, demo, and legacy geometry to exact selectors", () => {
    const css = read("app/globals.css");
    const desktopCss = withoutMediaBlocks(css);

    expect(declarationsForExactSelector(desktopCss, "html")).toMatchObject({
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".card")).toMatchObject({
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "var(--space-3) var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-card")).toMatchObject({
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-action")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-card")).toMatchObject({
      padding: "var(--space-6)",
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-primary")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel")).toMatchObject({
      gap: "var(--space-6)",
      padding: "clamp(var(--space-8), 5vw, var(--space-16))",
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-form button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "0 var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-shell")).toMatchObject({
      width: "min(var(--content-standard), calc(100% - (var(--space-6) * 2)))",
      padding: "var(--space-5) 0 var(--space-16)",
      gap: "var(--space-6)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-nav")).toMatchObject({
      top: "var(--space-2)",
      gap: "var(--space-4)",
      padding: "var(--space-3) var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-hero")).toMatchObject({
      gap: "var(--space-4)",
      padding: "clamp(var(--space-8), 6vw, var(--space-20))",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-hero h1")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "font-weight": "800",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-stage-panel")).toMatchObject({
      gap: "var(--space-5)",
      padding: "var(--space-6)",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-screen")).toMatchObject({
      gap: "var(--space-5)",
      padding: "clamp(var(--space-5), 3vw, var(--space-8))",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-mode-badges button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "var(--space-2) var(--space-3)",
    });
    for (const selector of [
      ".v2-nav nav a",
      ".safeclaw-login-topbar nav a",
      ".demo-mode-badges button",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [".triad-card h2", ".preview-hero-card h2"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel h1")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "font-weight": "800",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    for (const selector of [
      ".safeclaw-login-form input",
      ".safeclaw-login-form button",
      ".safeclaw-login-actions a",
      ".safeclaw-login-actions button",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [".scenario-strip", ".api-pulse-grid", ".primary-triad-grid", ".trust-grid", ".roadmap-list"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ gap: "var(--space-4)" });
    }
    for (const selector of [".triad-card", ".preview-hero-card", ".trust-grid article", ".roadmap-item"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ padding: "var(--space-6)" });
      expect(effectiveDeclarationsAtWidth(css, selector, 767), `${selector} at 767px`).toMatchObject({
        padding: "var(--space-4)",
      });
    }
    expect(effectiveDeclarationsAtWidth(css, ".v2-shell", 767)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
    expect(effectiveDeclarationsAtWidth(css, ".demo-mode-shell", 767)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
    for (const [selector, measure] of [
      [".container", "var(--content-wide)"],
      [".v2-shell", "var(--content-standard)"],
      [".demo-mode-shell", "var(--content-wide)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, selector, 1280), `${selector} desktop`).toMatchObject({
        width: `min(${measure}, calc(100% - (var(--space-6) * 2)))`,
      });
      expect(effectiveDeclarationsAtWidth(css, selector, 1024), `${selector} tablet`).toMatchObject({
        width: `min(${measure}, calc(100% - (var(--space-5) * 2)))`,
      });
      expect(effectiveDeclarationsAtWidth(css, selector, 767), `${selector} mobile precedence`).toMatchObject({
        width: "min(100%, calc(100% - (var(--space-4) * 2)))",
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".list")).toMatchObject({ gap: "14px" });
    expect(declarationsForExactSelector(desktopCss, ".row")).toMatchObject({ gap: "10px" });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .list")).toMatchObject({
      gap: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .row")).toMatchObject({
      gap: "var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .card")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".route-supporting-page .card", 767)).toMatchObject({
      padding: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .hero")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".route-supporting-page .hero", 767)).toMatchObject({
      padding: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .subtitle")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "font-weight": "500",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".subtitle")).toMatchObject({
      "font-size": "var(--text-component-title)",
      "font-weight": "700",
      "line-height": "var(--leading-component-title)",
      "letter-spacing": "var(--tracking-component-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-topbar nav")).toMatchObject({
      gap: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .two")).toMatchObject({
      gap: "var(--space-4)",
    });
    for (const [width, gutter, heroPadding, surfacePadding, marginTop] of [
      [1280, "var(--space-6)", "var(--space-12) var(--space-6)", "var(--space-6)", "var(--space-8)"],
      [1024, "var(--space-5)", "var(--space-10) var(--space-5)", "var(--space-5)", "var(--space-6)"],
      [767, "var(--space-4)", "var(--space-8) var(--space-4)", "var(--space-4)", "var(--space-4)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-hero", width), `module hero ${width}`).toMatchObject({
        padding: heroPadding,
      });
      expect(
        effectiveDeclarationsAtWidth(
          css,
          ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero",
          width,
        ),
        `document module hero ${width}`,
      ).toMatchObject({ padding: heroPadding });
      for (const selector of [".safeclaw-module-grid", ".safeclaw-module-panel"]) {
        expect(effectiveDeclarationsAtWidth(css, selector, width), `${selector} ${width}`).toMatchObject({
          width: `min(var(--content-wide), calc(100% - (${gutter} * 2)))`,
          margin: `${marginTop} auto 0`,
        });
      }
      for (const selector of [".safeclaw-module-grid article", ".safeclaw-module-grid.nine article"]) {
        expect(effectiveDeclarationsAtWidth(css, selector, width), `${selector} ${width}`).toMatchObject({
          padding: surfacePadding,
        });
      }
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-panel", width)).toMatchObject({
        padding: surfacePadding,
      });
    }
    const workpackEditor = read("components/WorkpackEditor.tsx");
    expect(workpackEditor).toContain('className="workpack-sidebar card list"');
    expect(workpackEditor).not.toContain("route-supporting-page");
    expect(effectiveDeclarationsAtWidth(css, ".container", 720)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
  });

  it("binds landing and ordinary module internals to canonical roles and spacing", () => {
    const css = read("app/globals.css");
    const desktopCss = withoutMediaBlocks(css);

    for (const [width, gutter] of [
      [1280, "var(--space-6)"],
      [1024, "var(--space-5)"],
      [767, "var(--space-4)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-landing", width), `landing gutter ${width}`).toMatchObject({
        "--os-gutter": gutter,
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-brand")).toMatchObject({
      gap: "var(--space-4)",
      padding: "0 var(--space-6) 0 0",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-status")).toMatchObject({ gap: "var(--space-6)" });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-hero-body")).toMatchObject({
      gap: "clamp(var(--space-8), 5vw, var(--space-20))",
      padding: "clamp(var(--space-12), 6vw, var(--space-20)) 0",
      "padding-inline": "var(--os-gutter)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-console")).toMatchObject({
      gap: "var(--space-4)",
      padding: "var(--space-6)",
    });

    for (const selector of [
      ".safeclaw-landing-nav nav button",
      ".safeclaw-landing-nav nav a",
      ".safeclaw-login",
      ".safeclaw-contact",
      ".safeclaw-os-console button",
      ".safeclaw-os-console a",
      ".safeclaw-terminal button",
      ".safeclaw-terminal a",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [
      ".safeclaw-pipeline-grid h3",
      ".safeclaw-proof-matrix h3",
      ".safeclaw-language-matrix h3",
      ".safeclaw-module-map h3",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        margin: "0 0 var(--space-6)",
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }

    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-panel h2")).toMatchObject({
      margin: "var(--space-4) 0 var(--space-3)",
      "font-size": "var(--text-component-title)",
      "font-weight": "700",
      "line-height": "var(--leading-component-title)",
      "letter-spacing": "var(--tracking-component-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-panel p")).toMatchObject({
      "font-size": "var(--text-body)",
      "font-weight": "500",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [".safeclaw-archive-list p", ".safeclaw-worker-table p", ".safeclaw-tbm-board p"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-support)",
        "font-weight": "500",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [
      ".safeclaw-worker-table strong",
      ".safeclaw-archive-list strong",
      ".safeclaw-tbm-board strong",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }
    for (const selector of [".safeclaw-worker-table", ".safeclaw-archive-list", ".safeclaw-tbm-board"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ gap: "var(--space-4)" });
    }
    for (const selector of [
      ".safeclaw-worker-table article",
      ".safeclaw-archive-list article",
      ".safeclaw-tbm-board article",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ padding: "var(--space-6)" });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-worker-phone")).toMatchObject({
      "margin-top": "var(--space-4)",
      "padding-left": "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".worker-language-switcher")).toMatchObject({
      margin: "var(--space-4) 0 var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".worker-language-switcher button")).toMatchObject({
      "min-height": "var(--control-height)",
      padding: "var(--space-3)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-rail nav", 980)).toMatchObject({
      gap: "0 var(--space-4)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-nav", 980)).toMatchObject({
      gap: "var(--space-3)",
      padding: "var(--space-4) var(--space-5)",
    });

    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-tag")).toMatchObject({
      "margin-bottom": "clamp(var(--space-8), 4vw, var(--space-16))",
      padding: "var(--space-3) var(--space-5)",
      "font-family": "var(--font-hud)",
      "font-size": "var(--text-hud)",
      "font-weight": "700",
      "line-height": "var(--leading-hud)",
      "letter-spacing": "var(--tracking-hud)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-hero mark")).toMatchObject({
      padding: "0 var(--space-1)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-section mark")).toMatchObject({
      padding: "0 var(--space-1)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-section h2")).toMatchObject({
      "font-size": "var(--text-section-title)",
      "font-weight": "800",
      "line-height": "var(--leading-section-title)",
      "letter-spacing": "var(--tracking-section-title)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-os-section h2", 767)).toMatchObject({
      "font-size": "var(--text-section-title)",
      "line-height": "var(--leading-section-title)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-os-section", 767)).toMatchObject({
      "padding-block": "var(--space-8)",
    });
    for (const selector of [
      ".safeclaw-pipeline-grid article",
      ".safeclaw-proof-matrix article",
      ".safeclaw-language-matrix article",
      ".safeclaw-module-map a",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), `${selector} desktop`).toMatchObject({
        padding: "var(--space-6)",
      });
      expect(effectiveDeclarationsAtWidth(css, selector, 767), `${selector} mobile`).toMatchObject({
        padding: "var(--space-4)",
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-terminal pre")).toMatchObject({
      "font-family": "var(--font-product)",
      "font-size": "var(--text-body)",
      "font-weight": "500",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-rail h2")).toMatchObject({
      "font-family": "var(--font-hud)",
      "font-size": "var(--text-hud)",
      "font-weight": "700",
      "line-height": "var(--leading-hud)",
      "letter-spacing": "var(--tracking-hud)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-rail a strong")).toMatchObject({
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-main")).toMatchObject({
      "padding-bottom": "var(--space-16)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-nav i")).toMatchObject({
      "margin-right": "var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-current-workpack")).toMatchObject({
      gap: "var(--space-4)",
      margin: "var(--space-8) auto 0",
      padding: "var(--space-6)",
    });
    for (const [width, gutter, padding] of [
      [1280, "var(--space-6)", "var(--space-6)"],
      [1024, "var(--space-5)", "var(--space-5)"],
      [767, "var(--space-4)", "var(--space-4)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-current-workpack", width), `current workpack ${width}`).toMatchObject({
        width: `min(var(--content-wide), calc(100% - (${gutter} * 2)))`,
        padding,
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-current-workpack a")).toMatchObject({
      "min-height": "var(--control-height)",
      padding: "0 var(--space-4)",
      "font-family": "var(--font-product)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".briefing-settings-form button")).toMatchObject({
      "min-height": "var(--control-height)",
      padding: "0 var(--space-4)",
      "font-family": "var(--font-product)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });

    expect(familySpacingResiduals(css)).toEqual([]);
    expect(familySpacingResiduals(".safeclaw-os-tag { margin: 7px; }")).toEqual([
      ".safeclaw-os-tag { margin: 7px }",
    ]);
    expect(familySpacingResiduals(`
      .safeclaw-module-panel,
      .safeclaw-module-shell.module-variant-document .safeclaw-module-panel { gap: 7px; }
    `)).toEqual([".safeclaw-module-panel { gap: 7px }"]);
    expect(familySpacingResiduals(".safeclaw-os-mark { width: 7px; border-width: 7px; }")).toEqual([]);
    expect(familySpacingResiduals(".ontology-node-row { gap: 7px; }")).toEqual([
      ".ontology-node-row { gap: 7px }",
    ]);
    expect(familySpacingResiduals(".ontology-node-row { gap: var(--space-7); }")).toEqual([
      ".ontology-node-row { gap: var(--space-7) }",
    ]);
    expect(familySpacingResiduals(".ontology-node-row { gap: var(--unknown-spacing); }")).toEqual([
      ".ontology-node-row { gap: var(--unknown-spacing) }",
    ]);
    for (const mutation of [
      ".ontology-node-row { gap: 7.4px; }",
      ".ontology-node-row { padding: 16.5px; }",
      ".ontology-node-row { gap: 0.5em; }",
      ".ontology-node-row { gap: 1rem; }",
      ".ontology-node-row { gap: 10%; }",
      ".ontology-node-row { gap: calc(100% - 4px); }",
      ".briefing-settings-form { gap: 7px; }",
      ".ai-connect-tabs { gap: 7px; }",
    ]) {
      expect(familySpacingResiduals(mutation), mutation).toHaveLength(1);
    }

    const ordinaryOwnerFiles = [
      "app/archive/page.tsx", "app/home/page.tsx", "app/dispatch/page.tsx", "app/evidence/page.tsx",
      "app/workers/page.tsx", "app/tbm/page.tsx", "app/settings/page.tsx", "app/knowledge/page.tsx",
      "app/evidence-file/page.tsx", "app/ontology/page.tsx", "app/worker/page.tsx",
      "components/SafeClawModuleShell.tsx", "components/CurrentWorkpackModules.tsx",
      "components/BriefingSettingsCard.tsx", "components/AiConnectPanel.tsx",
    ];
    const excludedOwnerClass = /^(?:safeclaw-(?:doc|document|workdoc|report)|workflow-|dispatch-|share-)/;
    const routeOwnedClass = /^(?:safeclaw-|ontology-|knowledge-|advanced-download|doc-card-evidence-badge|worker-|briefing-settings-|ai-connect-)/;
    for (const ownerFile of ordinaryOwnerFiles) {
      const source = read(ownerFile);
      const extracted = [...source.matchAll(/className="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter((className) => routeOwnedClass.test(className) && !excludedOwnerClass.test(className));
      const missing = [...new Set(extracted)].filter((className) => !ordinaryModuleOwnedClasses.has(className));
      expect(missing, `${ownerFile} owner inventory`).toEqual([]);
    }
    for (const ontologyClass of [
      "ontology-summary-grid", "ontology-workbench", "ontology-list-column", "ontology-node-list",
      "ontology-node-row", "ontology-hover-card", "ontology-map-column", "ontology-kind-list",
    ]) {
      expect(read("app/ontology/page.tsx"), `${ontologyClass} source owner`).toContain(ontologyClass);
      expect(ordinaryModuleOwnedClasses).toContain(ontologyClass);
    }
    for (const [ownerFile, prefix] of [
      ["components/BriefingSettingsCard.tsx", "briefing-settings-"],
      ["components/AiConnectPanel.tsx", "ai-connect-"],
    ] as const) {
      const source = read(ownerFile);
      const delegatedClasses = [...source.matchAll(/className="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter((className) => className.startsWith(prefix));
      expect(delegatedClasses.length, `${ownerFile} delegated classes`).toBeGreaterThan(0);
      for (const className of delegatedClasses) expect(ordinaryModuleOwnedClasses).toContain(className);
    }
  });
});
