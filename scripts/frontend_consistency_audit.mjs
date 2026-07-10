#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.resolve(
  root,
  process.env.OUTPUT_PATH || "evaluation/frontend-consistency-audit-2026-07-11/static-audit.json",
);
const cssPath = path.resolve(root, process.env.CSS_PATH || path.join("app", "globals.css"));
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

function cssRuleBlocks(source) {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    declarations: Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    ),
    line: lineNumber(uncommented, match.index),
  }));
}

function effectiveDeclarations(rules, selector) {
  return Object.assign(
    {},
    ...rules.filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.declarations),
  );
}

const functionalEffectSelectors = new Map([
  [".scenario-chip.active", "4px active operational rail"],
  [".template-card.active", "4px active operational rail"],
  [".doc-tab.active", "4px active operational rail"],
  [".command-stepper button.active", "4px active operational rail"],
  [".scenario-strip button.active", "4px active operational rail"],
  [".demo-stage-list li.active", "4px active operational rail"],
  [".quick-chip.active", "4px active operational rail"],
  [".mission-step.active", "4px active operational rail"],
  [".api-proof-card.active", "4px active operational rail"],
  [".document-editor.editor-focus-cue", "4px editor focus cue"],
  [".document-viewer-list button.selected", "4px selected-document rail"],
  ["body:has(.safeclaw-landing) :is(\n  .scenario-chip.active", "4px landing active operational rail"],
  [".safeclaw-module-shell .quick-chip.active", "4px module active operational rail"],
  [".safeclaw-module-shell .language-chip.active", "4px module active operational rail"],
  [".safeclaw-module-shell .template-tab.active", "4px module active operational rail"],
  [".safeclaw-module-shell .document-tab.active", "4px module active operational rail"],
  [".safeclaw-module-shell .workflow-channel-card.active", "4px module active operational rail"],
  [".command-center-shell .document-viewer-list button.selected", "selected-document rail"],
]);

const selectorRoleContract = {
  body: {
    "font-family": "var(--font-product)",
    "font-size": "var(--text-body)",
    "line-height": "var(--leading-body)",
    "letter-spacing": "var(--tracking-body)",
  },
  button: { font: "inherit" },
  input: { font: "inherit" },
  select: { font: "inherit" },
  textarea: { font: "inherit" },
  h1: {
    "font-family": "var(--font-product)",
    "line-height": "var(--leading-page-title)",
    "letter-spacing": "var(--tracking-page-title)",
  },
  h2: {
    "font-family": "var(--font-product)",
    "line-height": "var(--leading-section-title)",
    "letter-spacing": "var(--tracking-section-title)",
  },
  h3: {
    "font-family": "var(--font-product)",
    "line-height": "var(--leading-component-title)",
    "letter-spacing": "var(--tracking-component-title)",
  },
  ".button": {
    border: "1px solid var(--sc-black)",
    background: "var(--sc-hazard-yellow)",
    "box-shadow": "none",
    "letter-spacing": "var(--tracking-body)",
    transform: "none",
  },
  ".button:hover": { "box-shadow": "none", transform: "none" },
  ".command-topbar": { "box-shadow": "none" },
  ".scenario-chip.active": {
    "border-color": "var(--sc-black)",
    background: "var(--sc-steel-060)",
    "box-shadow": "inset 4px 0 0 var(--sc-hazard-yellow)",
  },
  ".document-editor.editor-focus-cue": {
    "border-color": "var(--sc-black)",
    "box-shadow": "inset 4px 0 0 var(--sc-hazard-yellow)",
    transform: "none",
  },
};

function cssViolations(source) {
  const violations = [];
  const rules = cssRuleBlocks(source);
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
    "0", "-0.015em", "-0.025em", "-0.035em", "-0.045em", "0.08em",
    "var(--tracking-body)", "var(--tracking-component-title)", "var(--tracking-section-title)",
    "var(--tracking-page-title)", "var(--tracking-display)", "var(--tracking-hud)",
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

  for (const rule of rules) {
    const boxShadow = rule.declarations["box-shadow"];
    if (boxShadow && boxShadow !== "none") {
      const functional = boxShadow.startsWith("inset ")
        && rule.selectors.every((selector) =>
          [...functionalEffectSelectors.keys()].some((allowedSelector) => selector.includes(allowedSelector)));
      if (!functional) {
        violations.push({
          rule: "decorative-box-shadow",
          file: "app/globals.css",
          line: rule.line,
          value: `${rule.selectors.join(", ")} => ${boxShadow}`,
        });
      }
    }
    const textShadow = rule.declarations["text-shadow"];
    if (textShadow && textShadow !== "none") {
      violations.push({ rule: "decorative-text-shadow", file: "app/globals.css", line: rule.line, value: textShadow });
    }
    for (const property of ["background", "background-image"]) {
      const value = rule.declarations[property];
      if (!value?.includes("gradient(")) continue;
      const functional = rule.selectors.every((selector) =>
        selector === ".hazard-stripe" || selector === ".hazard-stripe-band::before");
      if (!functional) {
        violations.push({ rule: "decorative-gradient", file: "app/globals.css", line: rule.line, value });
      }
    }
  }

  for (const [selector, expected] of Object.entries(selectorRoleContract)) {
    const actual = effectiveDeclarations(rules, selector);
    for (const [property, value] of Object.entries(expected)) {
      if (actual[property] !== value) {
        violations.push({
          rule: "selector-role",
          file: "app/globals.css",
          line: rules.find((rule) => rule.selectors.includes(selector))?.line || 1,
          value: `${selector} ${property}: expected ${value}, received ${actual[property] || "missing"}`,
        });
      }
    }
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
