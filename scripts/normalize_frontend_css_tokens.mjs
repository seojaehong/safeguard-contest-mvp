import fs from "node:fs";
import path from "node:path";

const cssPath = path.join(process.cwd(), "app/globals.css");

const fontSizes = new Map(Object.entries({
  "16px": "17px", "0.72rem": "12px", "0.75rem": "12px", "0.74rem": "12px",
  "1rem": "15px", "0.7rem": "11px", "0.9rem": "14px", "0.82rem": "13px",
  "0.92rem": "15px", "0.78rem": "12px", "0.95rem": "15px", "0.84rem": "13px",
  "0.68rem": "11px", "0.66rem": "11px", "0.76rem": "12px", "0.8rem": "13px",
  "0.85rem": "14px", "10px": "11px", "18px": "17px", "34px": "var(--text-page-title)",
  "58px": "var(--text-display)", "46px": "var(--text-display)", "36px": "var(--text-page-title)",
  "32px": "var(--text-page-title)", "22px": "var(--text-component-title)",
  "30px": "var(--text-page-title)", "27px": "var(--text-page-title)",
  "clamp(36px, 4vw, 56px)": "var(--text-display)",
  "clamp(28px, 3vw, 48px)": "var(--text-page-title)",
  "clamp(52px, 5.2vw, 68px)": "var(--text-display)",
  "clamp(38px, 4.4vw, 52px)": "var(--text-display)",
  "clamp(40px, 4.1vw, 52px)": "var(--text-display)",
  "clamp(36px, 4vw, 52px)": "var(--text-display)",
  "clamp(24px, 2.6vw, 38px)": "var(--text-section-title)",
  "clamp(34px, 4.2vw, 46px)": "var(--text-page-title)",
  "clamp(30px, 3vw, 36px)": "var(--text-page-title)",
  "clamp(28px, 2.8vw, 32px)": "var(--text-page-title)",
  "clamp(30px, 9vw, 34px)": "var(--text-page-title)",
}));

const lineHeights = new Map(Object.entries({
  "1.55": "1.6", "1.5": "1.6", "1.58": "1.6", "1": "0.98", "1.45": "1.35",
  "1.72": "1.75", "1.7": "1.75", "1.32": "1.35", "1.34": "1.35", "1.38": "1.35",
  "1.28": "1.25", "1.12": "1.15", "1.85": "1.75", "1.92": "1.75", "1.18": "1.15",
  "1.78": "1.75", "1.22": "1.25", "1.3": "1.35", "1.08": "1.15", "1.74": "1.75",
  "1.82": "1.75", "1.56": "1.6", "1.1": "1.15", "1.14": "1.15", "1.68": "1.65",
  "1.62": "1.6", "1.2": "1.15", "1.76": "1.75", "1.4": "1.35",
}));

const tracking = new Map(Object.entries({
  "0.012em": "0", "0.1em": "0.08em", "0.06em": "0.08em", "0.07em": "0.08em",
  "-0.01em": "-0.015em", "0.02em": "0", "0px": "0",
}));

const radii = new Map(Object.entries({
  "10px": "var(--r-lg)", "999px": "var(--radius-circle)", "8px": "var(--radius-soft)",
  "6px": "var(--r-md)", "12px": "var(--radius-workbench)", "9px": "var(--radius-soft)",
  "7px": "var(--radius-soft)", "14px": "var(--r-xl)", "9999px": "var(--radius-circle)",
}));

const families = new Map(Object.entries({
  'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace': "var(--font-hud)",
  '"Noto Sans KR", "Pretendard", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif': "var(--font-product)",
  '"Noto Sans KR", "Pretendard", var(--font-multilingual)': "var(--font-multilingual)",
  '"Pretendard", "Noto Sans KR", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif': "var(--font-product)",
}));

const spacingPixels = new Map(Object.entries({
  "2": "4", "3": "4", "5": "4", "6": "8", "7": "8", "9": "8",
  "10": "12", "11": "12", "13": "12", "14": "16", "18": "20",
  "22": "24", "26": "24", "28": "32", "30": "32", "36": "40",
}));

const spacingProperties = [
  "gap", "row-gap", "column-gap", "padding", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "padding-inline", "padding-block", "margin",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
];

function replaceValues(source, property, values) {
  const pattern = new RegExp(`(${property}\\s*:\\s*)([^;\\r\\n}]+)(?=\\s*;)`, "g");
  return source.replace(pattern, (_match, prefix, rawValue) => {
    const value = rawValue.trim();
    return `${prefix}${values.get(value) ?? value}`;
  });
}

function normalizeSpacing(source) {
  const propertyPattern = spacingProperties.join("|");
  const pattern = new RegExp(`((?:${propertyPattern})\\s*:\\s*)([^;\\r\\n}]+)(?=\\s*;)`, "g");
  return source.replace(pattern, (_match, prefix, rawValue) => {
    const value = rawValue.trim().replace(/(?<![\w.-])(\d+)px(?![\w.-])/g, (token, number) => {
      const normalized = spacingPixels.get(number);
      return normalized ? `${normalized}px` : token;
    });
    return `${prefix}${value}`;
  });
}

let css = fs.readFileSync(cssPath, "utf8");
css = css.replace(/\s*!important/g, "");
css = replaceValues(css, "font-size", fontSizes);
css = replaceValues(css, "line-height", lineHeights);
css = replaceValues(css, "letter-spacing", tracking);
css = replaceValues(css, "border-radius", radii);
css = replaceValues(css, "font-family", families);
css = normalizeSpacing(css);
fs.writeFileSync(cssPath, css, "utf8");
process.stdout.write(`${JSON.stringify({ importantDeclarations: (css.match(/!important/g) || []).length })}\n`);
