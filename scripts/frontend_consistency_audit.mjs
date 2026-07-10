#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.resolve(
  root,
  process.env.OUTPUT_PATH || "evaluation/frontend-consistency-audit-2026-07-11/static-audit.json",
);
const cssPath = path.join(root, "app", "globals.css");
const contractPath = path.join(root, "lib", "frontend-design-contract.ts");

function listFiles(directory, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(absolutePath, predicate));
    else if (predicate(absolutePath)) result.push(absolutePath);
  }
  return result;
}

function toRoute(pagePath) {
  const relativeDirectory = path.relative(path.join(root, "app"), path.dirname(pagePath)).replaceAll("\\", "/");
  return relativeDirectory ? `/${relativeDirectory}` : "/";
}

function contractRoutes(source) {
  const match = source.match(/export const userVisibleRoutes = \[([\s\S]*?)\] as const;/);
  if (!match) throw new Error("userVisibleRoutes contract was not found");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function cssViolations(source) {
  const violations = [];
  const allowedFontSizes = new Set([
    "11px", "12px", "13px", "14px", "15px", "17px", "20px",
    "var(--text-display)", "var(--text-page-title)", "var(--text-section-title)",
    "var(--text-component-title)", "var(--text-body-lg)", "var(--text-body)",
    "var(--text-support)", "var(--text-control)", "var(--text-table)",
    "var(--text-caption)", "var(--text-hud)", "var(--t-display)", "var(--t-hero)",
    "var(--t-title)", "var(--t-h)", "var(--t-body-lg)", "var(--t-body)",
    "var(--t-caption)", "var(--t-micro)",
  ]);

  for (const match of source.matchAll(/font-family\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim();
    if (!value.startsWith("var(") && value !== "inherit") {
      violations.push({ rule: "font-family-token", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  for (const match of source.matchAll(/font-size\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim().replace(/\s*!important$/, "");
    if (!allowedFontSizes.has(value)) {
      violations.push({ rule: "font-size-tier", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  const allowedLineHeights = new Set([
    "0.98", "1.15", "1.25", "1.35", "1.6", "1.65", "1.75", "16px", "18px", "20px",
    "var(--leading-display)", "var(--leading-page-title)", "var(--leading-section-title)",
    "var(--leading-component-title)", "var(--leading-body-lg)", "var(--leading-body)",
    "var(--leading-longform)", "var(--leading-control)", "var(--leading-table)",
    "var(--leading-caption)", "var(--leading-hud)",
  ]);
  for (const match of source.matchAll(/line-height\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim();
    if (!allowedLineHeights.has(value)) {
      violations.push({ rule: "line-height-tier", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  const allowedTracking = new Set([
    "0", "-0.015em", "-0.025em", "-0.035em", "-0.045em", "0.04em", "0.08em",
    "var(--tracking-body)", "var(--tracking-component-title)", "var(--tracking-section-title)",
    "var(--tracking-page-title)", "var(--tracking-display)", "var(--tracking-table-header)",
    "var(--tracking-hud)",
  ]);
  for (const match of source.matchAll(/letter-spacing\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim();
    if (!allowedTracking.has(value)) {
      violations.push({ rule: "tracking-tier", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  for (const match of source.matchAll(/border-radius\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim().replace(/\s*!important$/, "");
    const allowed = new Set([
      "0", "2px", "4px", "50%", "var(--radius-structural)", "var(--radius-micro)",
      "var(--radius-control)", "var(--radius-panel)", "var(--radius-circle)",
      "var(--radius-sm)", "var(--radius-md)", "var(--radius-lg)", "var(--r-xs)",
      "var(--r-sm)", "var(--r-md)", "var(--r-lg)", "var(--r-xl)",
    ]);
    if (!allowed.has(value)) {
      violations.push({ rule: "radius-tier", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  for (const match of source.matchAll(/!important/g)) {
    violations.push({ rule: "important-declaration", file: "app/globals.css", line: lineNumber(source, match.index), value: "!important" });
  }

  return violations;
}

const css = fs.readFileSync(cssPath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");
const pageFiles = listFiles(path.join(root, "app"), (filePath) => path.basename(filePath) === "page.tsx");
const componentFiles = listFiles(path.join(root, "components"), (filePath) => filePath.endsWith(".tsx"));
const discoveredRoutes = pageFiles.map(toRoute).sort();
const expectedRoutes = contractRoutes(contract).sort();
const missingRoutes = expectedRoutes.filter((route) => !discoveredRoutes.includes(route));
const unexpectedRoutes = discoveredRoutes.filter((route) => !expectedRoutes.includes(route));
const violations = cssViolations(css);

const report = {
  generatedAt: new Date().toISOString(),
  status: missingRoutes.length || unexpectedRoutes.length || violations.length ? "fail" : "pass",
  counts: {
    pageFiles: pageFiles.length,
    componentFiles: componentFiles.length,
    cssLines: css.split(/\r?\n/).length,
    importantDeclarations: [...css.matchAll(/!important/g)].length,
  },
  coverage: { expectedRoutes, discoveredRoutes, missingRoutes, unexpectedRoutes },
  violations,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  outputPath: path.relative(root, outputPath),
  status: report.status,
  counts: report.counts,
  coverageIssues: missingRoutes.length + unexpectedRoutes.length,
  violationCount: violations.length,
}, null, 2));

if (report.status === "fail") process.exitCode = 1;
