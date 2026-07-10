import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const componentNames = [
  "SafeGuardCommandCenter.tsx",
  "FieldOperationsWorkspace.tsx",
  "ReportsDownloadCenter.tsx",
  "WorkflowSharePanel.tsx",
  "AgentConsole.tsx"
] as const;

const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");
const components = Object.fromEntries(
  componentNames.map((name) => [name, read(`components/${name}`)])
) as Record<(typeof componentNames)[number], string>;
const css = read("app/globals.css");

const exactBlock = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "gu"))];
  return matches.at(-1)?.[1] ?? "";
};

describe("workbench visual contract", () => {
  it("exposes stable hooks for every operational surface and state", () => {
    const commandCenter = components["SafeGuardCommandCenter.tsx"];
    const fieldWorkspace = components["FieldOperationsWorkspace.tsx"];
    const reports = components["ReportsDownloadCenter.tsx"];
    const share = components["WorkflowSharePanel.tsx"];
    const agent = components["AgentConsole.tsx"];

    expect(commandCenter).toContain("workbench-root");
    expect(commandCenter).toContain("workbench-theme-toggle");
    expect(commandCenter).toContain("workbench-primary-action");
    expect(commandCenter).toContain("workbench-document-rail");
    expect(commandCenter).toContain("workbench-evidence-rail");
    expect(commandCenter).toContain("workbench-loading-state");
    expect(commandCenter).toContain("workbench-disabled-state");
    expect(fieldWorkspace).toContain("workbench-root");
    expect(fieldWorkspace).toContain("workbench-evidence-rail");
    expect(share).toContain("workbench-share-confirmation");
    expect(reports).toContain("workbench-report-filters");
    expect(reports).toContain("workbench-empty-state");
    expect(agent).toContain("workbench-loading-state");
  });

  it("keeps visual declarations out of component inline styles", () => {
    for (const [name, source] of Object.entries(components)) {
      expect(source, name).not.toMatch(/\bstyle\s*=\s*\{\{/u);
    }
  });

  it("uses one geometry contract for Day and Night", () => {
    expect(css).toMatch(/\.command-center-shell\.workbench-root\s*\{[\s\S]*?font-family:\s*var\(--font-product\);[\s\S]*?\}/u);
    expect(css).toMatch(/\.command-center-shell \.workbench-theme-toggle button\s*\{[\s\S]*?min-height:\s*36px;[\s\S]*?border-radius:\s*4px;[\s\S]*?font-size:\s*var\(--text-control\);[\s\S]*?line-height:\s*var\(--leading-control\);[\s\S]*?\}/u);
    expect(css).toMatch(/\.command-center-shell \.workbench-primary-action\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?border-radius:\s*4px;[\s\S]*?font-size:\s*var\(--text-control\);[\s\S]*?line-height:\s*var\(--leading-control\);[\s\S]*?\}/u);
    const themeBlocks = [...css.matchAll(/([^{}]*\.workspace-theme-(?:day|night)[^{}]*)\{([^{}]*)\}/gu)];
    for (const [fullMatch, selector, declarations] of themeBlocks) {
      const selectorList = selector.split(",").map((item) => item.trim());
      for (const item of selectorList.filter((candidate) => /\.workspace-theme-(?:day|night)/u.test(candidate))) {
        expect(declarations, item).not.toMatch(/(?:font-family|font-size|font-weight|line-height|letter-spacing|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|(?:min-|max-)?(?:width|height)|border-radius|border-width|border)\s*:(?!\s*[^;]*-color)/u);
      }
      expect(fullMatch).not.toContain("!important");
    }
  });

  it("asserts the effective owners for all five workbench surfaces", () => {
    const baseAgentConsole = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const baseAgentBody = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console-body\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const baseAgentIcon = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console-icon\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    expect(baseAgentConsole).toMatch(/gap:\s*8px;[\s\S]*padding:\s*12px;/u);
    expect(exactBlock(".command-center-shell .agent-console")).toMatch(/padding:\s*12px;/u);
    expect(baseAgentBody).toMatch(/gap:\s*4px;/u);
    expect(baseAgentIcon).toMatch(/width:\s*16px;/u);
    expect(exactBlock(".command-center-shell .workspace-theme-toggle")).toMatch(/padding:\s*4px;/u);
    expect(exactBlock(".command-center-shell .workspace-theme-toggle button")).toMatch(/min-width:\s*44px;/u);
    expect(css).toMatch(/\.command-center-shell \.linear-workspace-layout\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\);/u);
    expect(css).toMatch(/\.field-workspace\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\) 320px;[^}]*gap:\s*16px;/u);
    expect(css).toMatch(/\.share-panel\.workflow-panel\s*\{[^}]*gap:\s*16px;[^}]*padding:\s*16px;/u);
    expect(exactBlock(".safeclaw-module-shell.module-variant-document .safeclaw-report-controls button")).toMatch(/min-height:\s*44px;[\s\S]*padding:\s*12px 16px;/u);
  });

  it("asserts effective mobile workspace values after cascade", () => {
    const mobile = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/gu)?.join("\n") ?? "";
    expect(mobile).toMatch(/\.command-center-shell \.command-main\s*\{[\s\S]*?padding-top:\s*40px;/u);
    expect(mobile).toMatch(/\.command-center-shell \.command-console-input\s*\{[\s\S]*?padding:\s*16px;/u);
    expect(mobile.lastIndexOf("padding-top: 32px")).toBeGreaterThan(mobile.lastIndexOf("padding-top: 40px"));
    expect(mobile).not.toMatch(/\.command-center-shell \.command-(?:main|console-input)\s*\{[^}]*(?:padding|gap|margin(?:-[\w-]+)?):\s*(?:3|6|10|14|18|42)px/u);
  });

  it("implements the field workspace desktop, tablet, and mobile cascade", () => {
    const desktopRule = css.match(/\.field-workspace\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\) 320px;[^}]*\}/u)?.[0] ?? "";
    const tabletStart = css.indexOf("@media (min-width: 768px) and (max-width: 1279px)");
    const mobileStart = css.indexOf("@media (max-width: 767px)", tabletStart);
    const nextMedia = css.indexOf("@media", mobileStart + 1);
    const tabletRule = css.slice(tabletStart, mobileStart);
    const mobileRule = css.slice(mobileStart, nextMedia);

    expect(desktopRule).toContain("224px minmax(0, 1fr) 320px");
    expect(tabletRule).toMatch(/\.field-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 320px;/u);
    expect(tabletRule).toMatch(/\.workspace-canvas\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/u);
    expect(tabletRule).toMatch(/\.workspace-side\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/u);
    expect(tabletRule).toMatch(/\.workspace-rail\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/u);
    expect(mobileRule).toMatch(/\.field-workspace\s*\{[^}]*grid-template-columns:\s*1fr;/u);
    expect(mobileRule).toMatch(/:is\(\.workspace-rail, \.workspace-canvas, \.workspace-side\)\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*auto;/u);
    expect(tabletStart).toBeGreaterThan(css.indexOf("@media (max-width: 1120px)"));
    expect(mobileStart).toBeGreaterThan(tabletStart);
  });

  it("keeps the rendered progress node animated and reduced-motion safe", () => {
    expect(components["SafeGuardCommandCenter.tsx"]).toMatch(/document-review-meter[\s\S]*?<progress\s+value=/u);
    expect(css).toMatch(/\.inline-progress\.animated progress::-(?:webkit-progress-value|moz-progress-bar)[^{]*\{[\s\S]*?animation:\s*progressPulse/u);
    const reducedMotion = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/u)?.[1] ?? "";
    expect(reducedMotion).toContain(".inline-progress.animated progress::-webkit-progress-value");
    expect(reducedMotion).toContain(".inline-progress.animated progress::-moz-progress-bar");
  });

  it("normalizes document, evidence, share, report, empty, and loading geometry", () => {
    const expectedRules = [
      ["workbench-document-rail", "padding: 24px", "gap: 16px"],
      ["workbench-evidence-rail", "gap: 16px", "border-radius: 4px"],
      ["workbench-share-confirmation", "padding: 24px", "border-radius: 4px"],
      ["workbench-report-filters", "gap: 8px", "min-height: 44px"],
      ["workbench-empty-state", "padding: 24px", "border-radius: 4px"],
      ["workbench-loading-state", "font-size: var(--text-caption)", "line-height: var(--leading-caption)"]
    ] as const;

    for (const [hook, first, second] of expectedRules) {
      const block = css.match(new RegExp(`\\.${hook}\\s*\\{([\\s\\S]*?)\\}`, "u"))?.[1] ?? "";
      expect(block, hook).toContain(first);
      expect(block, hook).toContain(second);
    }
  });

  it("keeps workbench controls and surface geometry on the fixed scale", () => {
    const hookBlocks = [...css.matchAll(/\.workbench-[^{,\s]+\s*\{([\s\S]*?)\}/gu)]
      .map((match) => match[1])
      .join("\n");
    expect(hookBlocks).not.toMatch(/(?:min-)?height:\s*(?:38|40|42)px/u);
    expect(hookBlocks).not.toMatch(/(?:gap|padding|margin(?:-top)?):\s*(?:6|9|10|14|18|22)px(?:\s|;)/u);
    const radii = [...hookBlocks.matchAll(/border-radius:\s*([^;]+);/gu)].map((match) => match[1].trim());
    expect(radii.every((radius) => ["0", "0px", "2px", "4px", "50%"].includes(radius))).toBe(true);
  });
});
