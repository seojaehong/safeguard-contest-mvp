import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssPath = path.join(root, "app/globals.css");
const reportPath = path.join(root, "evaluation/frontend-consistency-audit-2026-07-11/static-audit.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

function normalizeSelector(value) {
  return value.replace(/\s+/g, " ").trim();
}

const functionalSelectors = new Set();
const decorativeSelectors = new Set();
for (const violation of report.violations) {
  if (violation.rule !== "decorative-box-shadow") continue;
  const selector = normalizeSelector(violation.value.split(" => ")[0]);
  if (/(?:accepted|active|aria-pressed|:focus|focus-cue)/.test(selector)) functionalSelectors.add(selector);
  else decorativeSelectors.add(selector);
}

let removedShadows = 0;
let normalizedRails = 0;
let removedGradients = 0;
let css = fs.readFileSync(cssPath, "utf8");
css = css.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selectorSource, body) => {
  const selector = selectorSource.split(",").map(normalizeSelector).join(", ");
  let nextBody = body;
  if (decorativeSelectors.has(selector) && /box-shadow\s*:/.test(nextBody)) {
    nextBody = nextBody.replace(/box-shadow\s*:\s*[^;]+;/g, "box-shadow: none;");
    removedShadows += 1;
  }
  if (functionalSelectors.has(selector) && /box-shadow\s*:/.test(nextBody)) {
    const normalized = nextBody.replace(/inset\s+[23]px\s+0\s+0/g, "inset 4px 0 0");
    if (normalized !== nextBody) normalizedRails += 1;
    nextBody = normalized;
  }
  if (/background\s*:[^;]*(?:linear-gradient|radial-gradient)/s.test(nextBody)
      && !/background\s*:[^;]*repeating-linear-gradient/s.test(nextBody)) {
    nextBody = nextBody.replace(/background\s*:[^;]*(?:linear-gradient|radial-gradient)[^;]*;/gs,
      "background: var(--workspace-surface-1, rgba(11, 12, 16, 0.78));");
    removedGradients += 1;
  }
  return nextBody === body ? whole : `${selectorSource}{${nextBody}}`;
});

fs.writeFileSync(cssPath, css, "utf8");
process.stdout.write(`${JSON.stringify({ removedShadows, normalizedRails, removedGradients })}\n`);
