#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const outputPath = path.resolve(
  root,
  process.env.OUTPUT_PATH || "evaluation/frontend-audit-runner-port-v2-2026-07-11/static-audit.json",
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

function contractLiteral(source, exportName) {
  const sourceFile = ts.createSourceFile(
    contractPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declarations = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations]);
  const declaration = declarations.find(
    (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === exportName,
  );
  if (!declaration?.initializer) throw new Error(`${exportName} contract was not found`);

  function literalValue(input) {
    let node = input;
    while (
      ts.isAsExpression(node)
      || ts.isParenthesizedExpression(node)
      || ts.isSatisfiesExpression(node)
    ) {
      node = node.expression;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
    if (ts.isObjectLiteralExpression(node)) {
      return Object.fromEntries(node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error(`${exportName} contains a non-literal property`);
        }
        const propertyName = ts.isIdentifier(property.name)
          || ts.isStringLiteral(property.name)
          || ts.isNumericLiteral(property.name)
          ? property.name.text
          : undefined;
        if (!propertyName) throw new Error(`${exportName} contains an unsupported property name`);
        return [propertyName, literalValue(property.initializer)];
      }));
    }
    throw new Error(`${exportName} contains an unsupported literal value`);
  }

  return literalValue(declaration.initializer);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const contract = fs.readFileSync(contractPath, "utf8");
const frontendScopedTypography = contractLiteral(contract, "frontendScopedTypography");
if (
  !isRecord(frontendScopedTypography)
  || !isRecord(frontendScopedTypography.selectors)
  || !isRecord(frontendScopedTypography.roles)
) {
  throw new Error("frontendScopedTypography contract is malformed");
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function normalizeSelector(selector) {
  return selector
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/,\s*/g, ", ")
    .trim();
}

function splitSelectorList(selectorList) {
  const selectors = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selectorList.length; index += 1) {
    if (selectorList[index] === "(") depth += 1;
    if (selectorList[index] === ")") depth -= 1;
    if (selectorList[index] === "," && depth === 0) {
      selectors.push(normalizeSelector(selectorList.slice(start, index)));
      start = index + 1;
    }
  }
  selectors.push(normalizeSelector(selectorList.slice(start)));
  return selectors.filter(Boolean);
}

function normalizeEffectValue(value) {
  return value
    .replace(/\s*!important$/, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function cssAtRuleRanges(source, prefix) {
  const ranges = [];
  const stack = [];
  let segmentStart = 0;
  let quote = "";
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") {
      stack.push({ header: source.slice(segmentStart, index).trim(), start: index });
      segmentStart = index + 1;
      continue;
    }
    if (character !== "}") continue;
    const block = stack.pop();
    if (!block) throw new Error("Unbalanced CSS closing brace");
    if (block.header.startsWith(prefix)) {
      ranges.push({ context: normalizeSelector(block.header), start: block.start, end: index });
    }
    segmentStart = index + 1;
  }
  if (stack.length) throw new Error("Unbalanced CSS opening brace");
  return ranges;
}

function cssRuleBlocks(source) {
  const uncommented = source.replace(
    /\/\*[\s\S]*?\*\//g,
    (comment) => comment.replace(/[^\r\n]/g, " "),
  );
  const mediaRanges = cssAtRuleRanges(uncommented, "@media");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => {
    const selectorOffset = match.index + Math.max(0, match[1].search(/\S/));
    return {
      selectors: splitSelectorList(match[1]),
      declarations: Object.fromEntries(
        [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
          declaration[1].trim(),
          declaration[2].trim(),
        ]),
      ),
      line: lineNumber(uncommented, selectorOffset),
      contexts: mediaRanges
        .filter((range) => range.start < match.index && match.index < range.end)
        .sort((left, right) => left.start - right.start)
        .map((range) => range.context),
    };
  });
}

function effectiveDeclarations(rules, selector) {
  const normalizedSelector = normalizeSelector(selector);
  return Object.assign(
    {},
    ...rules.filter((rule) => rule.selectors.includes(normalizedSelector)).map((rule) => rule.declarations),
  );
}

const typographyRoles = {
  display: { size: "var(--text-display)", weight: "800", lineHeight: "var(--leading-display)", tracking: "var(--tracking-display)" },
  pageTitle: { size: "var(--text-page-title)", weight: "800", lineHeight: "var(--leading-page-title)", tracking: "var(--tracking-page-title)" },
  sectionTitle: { size: "var(--text-section-title)", weight: "800", lineHeight: "var(--leading-section-title)", tracking: "var(--tracking-section-title)" },
  componentTitle: { size: "var(--text-component-title)", weight: "700", lineHeight: "var(--leading-component-title)", tracking: "var(--tracking-component-title)" },
  bodyLarge: { size: "var(--text-body-lg)", weight: "500", lineHeight: "var(--leading-body-lg)", tracking: "var(--tracking-body)" },
  body: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  longform: { size: "var(--text-body)", weight: "500", lineHeight: "var(--leading-longform)", tracking: "var(--tracking-body)" },
  support: { size: "var(--text-support)", weight: "500", lineHeight: "var(--leading-body)", tracking: "var(--tracking-body)" },
  control: { size: "var(--text-control)", weight: "700", lineHeight: "var(--leading-control)", tracking: "var(--tracking-body)" },
  table: { size: "var(--text-table)", weight: "500", lineHeight: "var(--leading-table)", tracking: "var(--tracking-body)" },
  caption: { size: "var(--text-caption)", weight: "600", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  tableHeader: { size: "var(--text-caption)", weight: "700", lineHeight: "var(--leading-caption)", tracking: "var(--tracking-body)" },
  hud: { size: "var(--text-hud)", weight: "700", lineHeight: "var(--leading-hud)", tracking: "var(--tracking-hud)", fontFamily: "var(--font-hud)" },
};

function selectorText(rule) {
  return rule.selectors.join(", ");
}

const typographyDeclarationProperties = new Set([
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
]);

function scopedTypographyRole(rule) {
  const matches = Object.entries(frontendScopedTypography.roles).filter(([roleName, role]) => {
    if (
      !isRecord(role)
      || typeof role.selectorRole !== "string"
      || typeof role.context !== "string"
      || !isRecord(role.declarations)
    ) {
      throw new Error(`frontendScopedTypography role ${roleName} is malformed`);
    }
    const selectors = frontendScopedTypography.selectors[role.selectorRole];
    if (!Array.isArray(selectors) || selectors.some((selector) => typeof selector !== "string")) {
      throw new Error(`frontendScopedTypography selector role ${role.selectorRole} is malformed`);
    }
    const exactContext = rule.contexts.length === 1
      && rule.contexts[0] === normalizeSelector(role.context);
    const exactSelectors = selectors.length === rule.selectors.length
      && selectors.every((selector, index) => normalizeSelector(selector) === rule.selectors[index]);
    const actualTypographyDeclarations = Object.entries(rule.declarations).filter(
      ([property]) => typographyDeclarationProperties.has(property),
    );
    const exactDeclarations = actualTypographyDeclarations.length === Object.keys(role.declarations).length
      && Object.entries(role.declarations).every(
        ([property, value]) => typeof value === "string" && rule.declarations[property] === value,
      );
    return exactContext && exactSelectors && exactDeclarations;
  });
  if (matches.length > 1) {
    throw new Error(`Ambiguous scoped typography roles: ${matches.map(([roleName]) => roleName).join(", ")}`);
  }
  if (!matches.length) return undefined;
  const [name, role] = matches[0];
  return { name, ...role };
}

function isInteractiveSelector(selector) {
  return /(^|[\s.:#>+~])(a|button|input|select|textarea)(?=$|[\s.:#>+~[])|\b(action|button|control|tab|chip|nav|link|toggle|filter)\b/i.test(selector);
}

function isTableHeaderSelector(selector) {
  return /(^|[\s>+~])th(?=$|[\s.:#>+~[])|table[^,{]*(head|header)|report-table[^,{]*strong/i.test(selector);
}

const semanticRoleOverrides = {
  ".safeclaw-login": "control",
  ".safeclaw-contact": "control",
  ".law-section-lines p": "longform",
  ".legal-reading-body": "longform",
  ".knowledge-detail-card p": "longform",
  ".knowledge-detail-card li": "longform",
  ".command-center-shell.workspace-theme-day .field-workspace .document-textarea": "longform",
  ".command-center-shell.workspace-theme-day .field-workspace .remediation-textarea": "longform",
  ".safeclaw-module-shell.module-variant-document .document-textarea": "longform",
  ".safeclaw-module-shell.module-variant-document .remediation-textarea": "longform",
  ".command-center-shell .command-primary": "control",
  ".safeclaw-module-primary": "control",
  ".safeclaw-module-actions a": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-primary": "control",
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-actions a": "control",
  ".command-center-shell .brand-lockup small": "caption",
  ".command-center-shell .topbar-status span": "hud",
  ".command-center-shell .step-copy small": "hud",
};

function isHudSelector(rule, selector) {
  return rule.declarations["font-family"] === "var(--font-hud)"
    || rule.declarations["letter-spacing"] === "var(--tracking-hud)"
    || /\b(hud|status|eyebrow|kicker|badge|meta|metric|code|console|source|live|signal)\b/i.test(selector);
}

function expectedTypographyRole(rule, selector) {
  const override = semanticRoleOverrides[selector];
  if (override) return override;
  const size = rule.declarations["font-size"];
  if (isTableHeaderSelector(selector) && !isInteractiveSelector(selector)) return "tableHeader";
  if (["var(--text-display)", "var(--t-display)", "clamp(44px, 6vw, 72px)"].includes(size)) return "display";
  if (["var(--text-page-title)", "var(--t-hero)", "clamp(32px, 4vw, 40px)"].includes(size)) return "pageTitle";
  if (["var(--text-section-title)", "var(--t-title)", "clamp(24px, 3vw, 28px)"].includes(size)) return "sectionTitle";
  if (["var(--text-component-title)", "var(--t-h)", "20px"].includes(size)) return "componentTitle";
  if (["var(--text-body-lg)", "var(--t-body-lg)", "17px"].includes(size)) return "bodyLarge";
  if (["var(--text-body)", "var(--t-body)", "15px"].includes(size)) return "body";
  if (["var(--text-control)", "var(--text-support)", "14px"].includes(size)) {
    return isInteractiveSelector(selector) ? "control" : "support";
  }
  if (["var(--text-table)", "13px"].includes(size)) return "table";
  if (["var(--text-caption)", "var(--t-caption)", "12px"].includes(size)) return "caption";
  if (["var(--text-hud)", "var(--t-micro)"].includes(size) || size === "11px" && isHudSelector(rule, selector)) return "hud";
  if (size === "11px") return "caption";
  return undefined;
}

const hazardRail = "inset 4px 0 0 var(--sc-hazard-yellow)";
const moduleRail = "inset 4px 0 0 var(--os-yellow, #ffdc2e)";
const effectContracts = new Map();

function allowEffect(selector, property, value, reason) {
  const key = `${normalizeSelector(selector)}\u0000${property}`;
  const contract = effectContracts.get(key) || { values: new Set(), reasons: new Set() };
  contract.values.add(normalizeEffectValue(value));
  contract.reasons.add(reason);
  effectContracts.set(key, contract);
}

for (const selector of [
  ".scenario-chip.active",
  ".template-card.active",
  ".doc-tab.active",
  ".command-stepper button.active",
  ".scenario-strip button.active",
]) {
  allowEffect(selector, "box-shadow", hazardRail, "4px active operational rail");
}
allowEffect(".document-editor.editor-focus-cue", "box-shadow", hazardRail, "4px editor focus cue");
allowEffect(
  ".document-viewer-list button.selected",
  "box-shadow",
  "inset 4px 0 0 var(--accent)",
  "4px selected-document rail",
);
allowEffect(
  "body:has(.safeclaw-landing) :is(.scenario-strip button.active, .demo-stage-list li.active, .quick-chip.active, .mission-step.active, .api-proof-card.active)",
  "box-shadow",
  hazardRail,
  "4px landing active operational rail",
);
for (const selector of [
  ".safeclaw-module-shell .quick-chip.active",
  ".safeclaw-module-shell .language-chip.active",
  ".safeclaw-module-shell .template-tab.active",
  ".safeclaw-module-shell .document-tab.active",
  ".safeclaw-module-shell .workflow-channel-card.active",
]) {
  allowEffect(selector, "box-shadow", moduleRail, "4px module active operational rail");
}
allowEffect(
  ".command-center-shell .document-viewer-list button.selected",
  "box-shadow",
  "inset 4px 0 0 var(--workspace-ink)",
  "4px selected-document rail",
);
allowEffect(
  ".command-center-shell .document-viewer-list button.selected",
  "box-shadow",
  "inset 4px 0 0 var(--workspace-accent)",
  "4px themed selected-document rail",
);
allowEffect(
  ".hazard-stripe",
  "background-image",
  "repeating-linear-gradient(-45deg, var(--hazard) 0, var(--hazard) 12px, var(--steel-1, #111114) 12px, var(--steel-1, #111114) 24px)",
  "documented hazard marking",
);
allowEffect(
  ".hazard-stripe-band::before",
  "background-image",
  "repeating-linear-gradient(-45deg, var(--hazard) 0, var(--hazard) 8px, var(--steel-1, #111114) 8px, var(--steel-1, #111114) 16px)",
  "documented hazard marking",
);

for (const [selector, value, reason] of [
  [".command-center-shell .input-photo-candidates article.accepted", "inset 4px 0 0 var(--workspace-success)", "accepted photo rail"],
  [".command-center-shell.workspace-theme-day .command-console-input:focus", "0 0 0 3px rgba(245, 197, 24, 0.22)", "keyboard focus ring"],
  [".command-center-shell.workspace-theme-day .input-photo-candidates article.accepted", "inset 4px 0 0 #16a34a", "accepted photo rail"],
  [".command-center-shell.workspace-theme-day .field-workspace .document-editor.editor-focus-cue", "0 0 0 3px rgba(108, 111, 247, 0.12)", "editor focus cue"],
  [".command-center-shell.workspace-theme-day .field-workspace .doc-tab.active", "inset 4px 0 0 var(--workspace-accent)", "active document rail"],
  [".command-center-shell.workspace-theme-day .field-workspace :is(.document-textarea, .remediation-textarea):focus", "0 0 0 3px rgba(108, 111, 247, 0.18)", "keyboard focus ring"],
  [".safeclaw-module-shell.module-variant-document .doc-tab.active", "inset 4px 0 0 var(--workspace-accent)", "active document rail"],
  [".safeclaw-module-shell.module-variant-document .template-card.active", "inset 4px 0 0 var(--workspace-accent)", "active template rail"],
  [".safeclaw-module-shell.module-variant-document .document-textarea:focus", "0 0 0 3px rgba(108, 111, 247, 0.18)", "keyboard focus ring"],
  [".safeclaw-module-shell.module-variant-document .remediation-textarea:focus", "0 0 0 3px rgba(108, 111, 247, 0.18)", "keyboard focus ring"],
  [".command-center-shell.workspace-theme-night .field-workspace .document-editor.editor-focus-cue", "0 0 0 3px rgba(108, 111, 247, 0.22)", "editor focus cue"],
  [".command-center-shell.workspace-theme-night .field-workspace .doc-tab.active", "inset 4px 0 0 var(--workspace-accent)", "active document rail"],
  [".command-center-shell.workspace-theme-night .field-workspace :is(.document-textarea, .remediation-textarea):focus", "0 0 0 3px rgba(108, 111, 247, 0.24)", "keyboard focus ring"],
  [".safeclaw-module-shell:is(.module-variant-document, .module-variant-default) .safeclaw-module-rail a.active", "inset 4px 0 0 var(--workspace-accent)", "active navigation rail"],
  [".safeclaw-module-shell .safeclaw-module-theme-toggle button.active", "inset 0 0 0 1px var(--workspace-rule-strong)", "selected theme indicator"],
  [".safeclaw-module-shell.module-variant-document :is(.safeclaw-mobile-core-list, .safeclaw-mobile-remaining-list) button[aria-pressed=\"true\"]", "inset 4px 0 0 var(--workspace-accent)", "selected mobile document rail"],
]) {
  allowEffect(selector, "box-shadow", value, reason);
}

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
  ".safeclaw-prototype-topbar i": { "border-radius": "var(--radius-circle)" },
  ".recent-list button i": { "border-radius": "var(--radius-circle)" },
  ".status-orb": { "border-radius": "var(--radius-circle)" },
  ".button-spinner": { "border-radius": "var(--radius-circle)" },
  ".safeclaw-module-hero.document h1": {
    "font-size": "var(--text-page-title)",
    "line-height": "var(--leading-page-title)",
    "letter-spacing": "var(--tracking-page-title)",
  },
  ".safeclaw-workdoc-header h2": {
    "font-size": "var(--text-page-title)",
    "line-height": "var(--leading-page-title)",
    "letter-spacing": "var(--tracking-page-title)",
  },
  ".safeclaw-workdoc-section-head h3": {
    "font-size": "var(--text-section-title)",
    "line-height": "var(--leading-section-title)",
    "letter-spacing": "var(--tracking-section-title)",
  },
  ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero h1": {
    "font-size": "var(--text-page-title)",
    "line-height": "var(--leading-page-title)",
    "letter-spacing": "var(--tracking-page-title)",
  },
  ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-header h2": {
    "font-size": "var(--text-page-title)",
    "line-height": "var(--leading-page-title)",
    "letter-spacing": "var(--tracking-page-title)",
  },
  ".safeclaw-module-shell.module-variant-document .safeclaw-workdoc-section-head h3": {
    "font-size": "var(--text-section-title)",
    "line-height": "var(--leading-section-title)",
    "letter-spacing": "var(--tracking-section-title)",
  },
  ".safeclaw-module-shell h2": {
    "font-size": "var(--text-section-title)",
    "line-height": "var(--leading-section-title)",
    "letter-spacing": "var(--tracking-section-title)",
  },
  ".safeclaw-module-shell h3": {
    "font-size": "var(--text-component-title)",
    "line-height": "var(--leading-component-title)",
    "letter-spacing": "var(--tracking-component-title)",
  },
  ".safeclaw-module-shell strong": {
    "font-size": "var(--text-body)",
    "line-height": "var(--leading-body)",
    "letter-spacing": "var(--tracking-body)",
  },
  ".safeclaw-module-shell .safeclaw-report-facts span": {
    "font-size": "var(--text-body)",
    "line-height": "var(--leading-body)",
    "letter-spacing": "var(--tracking-body)",
  },
  ".safeclaw-module-shell .safeclaw-report-notes p": {
    "font-size": "var(--text-body)",
    "line-height": "var(--leading-body)",
    "letter-spacing": "var(--tracking-body)",
  },
  ".safeclaw-module-shell .safeclaw-report-table span": {
    "font-size": "var(--text-table)",
    "line-height": "var(--leading-table)",
    "letter-spacing": "var(--tracking-body)",
  },
  ".safeclaw-module-shell .safeclaw-report-group em": {
    "font-size": "var(--text-body)",
    "line-height": "var(--leading-body)",
    "letter-spacing": "var(--tracking-body)",
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
    const blockStart = source.lastIndexOf("{", match.index);
    const selectorStart = source.lastIndexOf("}", blockStart) + 1;
    const enclosingSelector = source.slice(selectorStart, blockStart);
    if (enclosingSelector.includes("@font-face")) continue;
    const value = match[1].trim().replace(/\s*!important$/, "");
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
  for (const rule of rules) {
    const value = rule.declarations["line-height"]?.trim();
    if (!value || allowedLineHeights.has(value)) continue;
    const scopedRole = scopedTypographyRole(rule);
    if (scopedRole?.declarations["line-height"] !== value) {
      violations.push({ rule: "line-height-tier", file: "app/globals.css", line: rule.line, value });
    }
  }

  const allowedTracking = new Set([
    "0", "-0.015em", "-0.025em", "-0.035em", "-0.045em", "0.08em",
    "var(--tracking-body)", "var(--tracking-component-title)", "var(--tracking-section-title)",
    "var(--tracking-page-title)", "var(--tracking-display)", "var(--tracking-hud)",
  ]);
  for (const match of source.matchAll(/letter-spacing\s*:\s*([^;\r\n}]+)/g)) {
    const value = match[1].trim().replace(/\s*!important$/, "");
    if (!allowedTracking.has(value)) {
      violations.push({ rule: "tracking-tier", file: "app/globals.css", line: lineNumber(source, match.index), value });
    }
  }

  const allowedRadii = new Set([
    "0", "2px", "4px", "50%", "var(--radius-structural)", "var(--radius-micro)",
    "var(--radius-control)", "var(--radius-panel)", "var(--radius-circle)",
    "var(--radius-soft)", "var(--radius-workbench)",
    "var(--radius-sm)", "var(--radius-md)", "var(--radius-lg)", "var(--r-xs)",
    "var(--r-sm)", "var(--r-md)", "var(--r-lg)", "var(--r-xl)",
  ]);
  const reviewedModuleRadii = new Map([
    [".safeclaw-module-shell:is(.module-variant-document, .module-variant-default) .safeclaw-module-rail", "14px"],
    [".safeclaw-module-shell:is(.module-variant-document, .module-variant-default) .safeclaw-module-nav", "8px"],
  ]);
  for (const rule of rules) {
    const value = rule.declarations["border-radius"]?.replace(/\s*!important$/, "");
    if (!value) continue;
    const reviewedRole = rule.selectors.every((selector) => reviewedModuleRadii.get(selector) === value);
    if (!allowedRadii.has(value) && !reviewedRole) {
      violations.push({
        rule: "radius-tier",
        file: "app/globals.css",
        line: rule.line,
        value: `${selectorText(rule)} => ${value}`,
      });
    }
  }

  for (const match of source.matchAll(/!important/g)) {
    violations.push({ rule: "important-declaration", file: "app/globals.css", line: lineNumber(source, match.index), value: "!important" });
  }

  for (const rule of rules) {
    const fontSize = rule.declarations["font-size"];
    if (fontSize) {
      const scopedRole = scopedTypographyRole(rule);
      const hasScopedTuple = scopedRole && Object.hasOwn(scopedRole.declarations, "font-size");
      const roleNames = hasScopedTuple
        ? rule.selectors.map(() => `scoped:${scopedRole.name}`)
        : rule.selectors.map((selector) => expectedTypographyRole(rule, selector));
      const definedRoles = roleNames.filter(Boolean);
      const mixedRoles = new Set(definedRoles).size > 1;
      const hasUnmappedRole = roleNames.some((roleName) => !roleName);
      if (mixedRoles) {
        violations.push({
          rule: "mixed-typography-role",
          file: "app/globals.css",
          line: rule.line,
          value: `${selectorText(rule)} => ${roleNames.join(", ")}`,
        });
      }
      const roleName = mixedRoles || hasUnmappedRole ? undefined : roleNames[0];
      const role = roleName && !hasScopedTuple ? typographyRoles[roleName] : undefined;
      const expected = hasScopedTuple ? scopedRole.declarations : role ? {
        "font-size": role.size,
        "font-weight": role.weight,
        "line-height": role.lineHeight,
        "letter-spacing": role.tracking,
        ...(roleName === "hud" ? { "font-family": role.fontFamily } : {}),
      } : undefined;
      const mismatch = !mixedRoles && (!expected || Object.entries(expected).some(([property, value]) =>
        rule.declarations[property] !== value));
      if (mismatch) {
        violations.push({
          rule: "typography-tuple",
          file: "app/globals.css",
          line: rule.line,
          value: `${selectorText(rule)} => ${roleName || "unmapped"}: ${JSON.stringify(rule.declarations)}`,
        });
      }
    }
    const boxShadow = rule.declarations["box-shadow"];
    if (boxShadow) {
      const normalizedValue = normalizeEffectValue(boxShadow);
      if (normalizedValue !== "none") {
        const functional = rule.selectors.every((selector) => {
          const contract = effectContracts.get(`${selector}\u0000box-shadow`);
          return contract?.values.has(normalizedValue);
        });
        if (!functional) {
          violations.push({
            rule: "decorative-box-shadow",
            file: "app/globals.css",
            line: rule.line,
            value: `${rule.selectors.join(", ")} => ${boxShadow}`,
          });
        }
      }
    }
    const textShadow = rule.declarations["text-shadow"];
    if (textShadow && textShadow !== "none") {
      violations.push({ rule: "decorative-text-shadow", file: "app/globals.css", line: rule.line, value: textShadow });
    }
    for (const property of ["background", "background-image"]) {
      const value = rule.declarations[property];
      if (!value?.includes("gradient(")) continue;
      const normalizedValue = normalizeEffectValue(value);
      const functional = rule.selectors.every((selector) => {
        const contract = effectContracts.get(`${selector}\u0000${property}`);
        return contract?.values.has(normalizedValue);
      });
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
const pageFiles = listFiles(path.join(root, "app"), (filePath) => path.basename(filePath) === "page.tsx");
const componentFiles = listFiles(path.join(root, "components"), (filePath) => filePath.endsWith(".tsx"));
const discoveredRoutes = pageFiles.map(toRoute).sort();
const expectedRoutes = contractRoutes(contract).sort();
const missingRoutes = expectedRoutes.filter((route) => !discoveredRoutes.includes(route));
const unexpectedRoutes = discoveredRoutes.filter((route) => !expectedRoutes.includes(route));
const violations = cssViolations(css);
const identityFiles = [
  cssPath,
  contractPath,
  path.join(root, "package.json"),
  path.join(root, "next.config.mjs"),
  path.join(root, "scripts", "frontend_consistency_audit.mjs"),
  path.join(root, "lib", "frontend-audit", "GlobalBoundaryProbe.audit.tsx"),
  path.join(root, "lib", "frontend-audit", "GlobalBoundaryProbe.noop.tsx"),
  path.join(root, "types", "audit-error-escalation.d.ts"),
  ...pageFiles,
  ...componentFiles,
].sort();
const sourceIdentity = crypto.createHash("sha256");
for (const filePath of identityFiles) {
  sourceIdentity.update(path.relative(root, filePath).replaceAll("\\", "/"));
  sourceIdentity.update("\0");
  sourceIdentity.update(fs.readFileSync(filePath));
  sourceIdentity.update("\0");
}
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceSha,
  sourceIdentity: sourceIdentity.digest("hex"),
  status: missingRoutes.length || unexpectedRoutes.length || violations.length ? "fail" : "pass",
  counts: {
    pageFiles: pageFiles.length,
    componentFiles: componentFiles.length,
    cssLines: css.split(/\r?\n/).length,
    importantDeclarations: [...css.matchAll(/!important/g)].length,
  },
  coverage: { expectedRoutes, discoveredRoutes, missingRoutes, unexpectedRoutes },
  coverageIssues: missingRoutes.length + unexpectedRoutes.length,
  violationCount: violations.length,
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
