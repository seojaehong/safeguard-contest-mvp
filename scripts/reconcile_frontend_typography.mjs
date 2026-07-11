import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssPath = path.join(root, "app/globals.css");
const reportPath = path.join(root, "evaluation/frontend-consistency-audit-2026-07-11/static-audit.json");

const roles = {
  display: ["var(--text-display)", "800", "var(--leading-display)", "var(--tracking-display)"],
  pageTitle: ["var(--text-page-title)", "800", "var(--leading-page-title)", "var(--tracking-page-title)"],
  sectionTitle: ["var(--text-section-title)", "800", "var(--leading-section-title)", "var(--tracking-section-title)"],
  componentTitle: ["var(--text-component-title)", "700", "var(--leading-component-title)", "var(--tracking-component-title)"],
  bodyLarge: ["var(--text-body-lg)", "500", "var(--leading-body-lg)", "var(--tracking-body)"],
  body: ["var(--text-body)", "500", "var(--leading-body)", "var(--tracking-body)"],
  longform: ["var(--text-body)", "500", "var(--leading-longform)", "var(--tracking-body)"],
  support: ["var(--text-support)", "500", "var(--leading-body)", "var(--tracking-body)"],
  control: ["var(--text-control)", "700", "var(--leading-control)", "var(--tracking-body)"],
  table: ["var(--text-table)", "500", "var(--leading-table)", "var(--tracking-body)"],
  caption: ["var(--text-caption)", "600", "var(--leading-caption)", "var(--tracking-body)"],
  tableHeader: ["var(--text-caption)", "700", "var(--leading-caption)", "var(--tracking-body)"],
  hud: ["var(--text-hud)", "700", "var(--leading-hud)", "var(--tracking-hud)"],
};

function normalizeSelector(value) {
  return value.replace(/\s+/g, " ").trim();
}

function setDeclaration(body, property, value) {
  const pattern = new RegExp(`(^|\\n)([ \\t]*)${property}\\s*:\\s*[^;]+;`, "m");
  if (pattern.test(body)) {
    return body.replace(pattern, (_match, prefix, indent) => `${prefix}${indent}${property}: ${value};`);
  }
  const indent = body.match(/\n([ \t]+)[\w-]+\s*:/)?.[1] ?? "  ";
  return `${body.replace(/\s*$/, "")}\n${indent}${property}: ${value};\n`;
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const roleBySelector = new Map();
for (const violation of report.violations) {
  if (violation.rule !== "typography-tuple") continue;
  const match = violation.value.match(/^(.*?) => ([A-Za-z]+): /);
  if (!match || !roles[match[2]]) continue;
  roleBySelector.set(normalizeSelector(match[1]), match[2]);
}

let changedRules = 0;
const css = fs.readFileSync(cssPath, "utf8");
const updated = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectorSource, body) => {
  if (!/font-size\s*:/.test(body)) return whole;
  const selector = selectorSource.split(",").map(normalizeSelector).join(", ");
  const roleName = roleBySelector.get(selector);
  if (!roleName) return whole;
  const [size, weight, lineHeight, tracking] = roles[roleName];
  let nextBody = body;
  nextBody = setDeclaration(nextBody, "font-size", size);
  nextBody = setDeclaration(nextBody, "font-weight", weight);
  nextBody = setDeclaration(nextBody, "line-height", lineHeight);
  nextBody = setDeclaration(nextBody, "letter-spacing", tracking);
  if (roleName === "hud") nextBody = setDeclaration(nextBody, "font-family", "var(--font-hud)");
  if (nextBody === body) return whole;
  changedRules += 1;
  return `${selectorSource}{${nextBody}}`;
});

fs.writeFileSync(cssPath, updated, "utf8");
process.stdout.write(`${JSON.stringify({ changedRules, sourceViolations: roleBySelector.size })}\n`);
