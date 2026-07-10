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
      if (selectorList.some((item) => !/\.workspace-theme-(?:day|night)/u.test(item))) continue;
      expect(declarations, selector).not.toMatch(/(?:font-family|font-size|font-weight|line-height|letter-spacing|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|gap|(?:min-|max-)?(?:width|height)|border-radius|border-width|border)\s*:(?!\s*[^;]*-color)/u);
      expect(fullMatch).not.toContain("!important");
    }
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
