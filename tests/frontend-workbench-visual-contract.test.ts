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
    expect(css).toMatch(/\.command-center-shell \.workbench-theme-toggle button\s*\{[\s\S]*?min-height:\s*var\(--control-height-compact\);[\s\S]*?border-radius:\s*var\(--radius-control\);[\s\S]*?font-size:\s*var\(--text-control\);[\s\S]*?line-height:\s*var\(--leading-control\);[\s\S]*?\}/u);
    expect(css).toMatch(/\.command-center-shell \.workbench-primary-action\s*\{[\s\S]*?min-height:\s*var\(--control-height\);[\s\S]*?border-radius:\s*var\(--radius-control\);[\s\S]*?font-size:\s*var\(--text-control\);[\s\S]*?line-height:\s*var\(--leading-control\);[\s\S]*?\}/u);
    const themeBlocks = [...css.matchAll(/([^{}]*\.workspace-theme-(?:day|night)[^{}]*)\{([^{}]*)\}/gu)];
    for (const [fullMatch] of themeBlocks) {
      expect(fullMatch).not.toContain("!important");
    }
  });

  it("asserts the effective owners for all five workbench surfaces", () => {
    const baseAgentConsole = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const baseAgentBody = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console-body\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    const baseAgentIcon = css.match(/\/\* AI 작업 콘솔[\s\S]*?\.agent-console-icon\s*\{([\s\S]*?)\}/u)?.[1] ?? "";
    expect(baseAgentConsole).toMatch(/gap:\s*var\(--space-2\);[\s\S]*padding:\s*var\(--space-3\);/u);
    expect(exactBlock(".command-center-shell .agent-console")).toMatch(/padding:\s*0;/u);
    expect(exactBlock(".command-center-shell .agent-console-body")).toMatch(/padding:\s*var\(--space-3\);/u);
    expect(baseAgentBody).toMatch(/gap:\s*var\(--space-1\);/u);
    expect(baseAgentIcon).toMatch(/width:\s*16px;/u);
    expect(exactBlock(".command-center-shell .workspace-theme-toggle")).toMatch(/padding:\s*var\(--space-1\);/u);
    expect(exactBlock(".command-center-shell .workspace-theme-toggle button")).toMatch(/min-width:\s*var\(--control-height\);/u);
    expect(css).toMatch(/\.command-center-shell \.linear-workspace-layout\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\);/u);
    expect(css).toMatch(/\.field-workspace\s*\{[^}]*grid-template-columns:\s*224px minmax\(0, 1fr\) 320px;[^}]*gap:\s*var\(--space-4\);/u);
    expect(css).toMatch(/\.share-panel\.workflow-panel\s*\{[^}]*gap:\s*(?:16px|var\(--space-4\));[^}]*padding:\s*(?:16px|var\(--space-4\));/u);
    expect(exactBlock(".safeclaw-module-shell.module-variant-document .safeclaw-report-controls button")).toMatch(/min-height:\s*(?:44px|var\(--control-height\));[\s\S]*padding:\s*(?:12px 16px|var\(--space-3\) var\(--space-4\));/u);
  });

  it("asserts effective mobile workspace values after cascade", () => {
    const mobile = css.match(/@media \(max-width: 720px\) \{([\s\S]*?)\n\}/gu)?.join("\n") ?? "";
    expect(mobile).toMatch(/\.command-center-shell \.command-console-input\s*\{[\s\S]*?padding:\s*16px;/u);
    expect(mobile.lastIndexOf("padding-top: 32px")).toBeGreaterThan(-1);
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

  it("gives document edit focus a single full-width canvas and readable supporting controls", () => {
    expect(components["SafeGuardCommandCenter.tsx"]).toMatch(
      /<FieldOperationsWorkspace[\s\S]*?surface="editor"/u,
    );
    expect(components["FieldOperationsWorkspace.tsx"]).toContain('surface?: "full" | "share" | "editor"');
    expect(css).toMatch(
      /\.field-workspace-editor-only\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/u,
    );
    expect(css).toMatch(
      /\.field-workspace-editor-only\s+\.workspace-canvas\s*\{[^}]*grid-column:\s*1;[^}]*width:\s*100%;/u,
    );
    expect(css).toMatch(
      /\.field-workspace\s+\.compact-head\s*\{[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--space-1\);/u,
    );
    expect(css).toMatch(
      /\.workspace-side\s+\.worker-edit-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/u,
    );
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
      ["workbench-document-rail", "padding: var(--space-6)", "gap: var(--space-4)"],
      ["workbench-evidence-rail", "gap: var(--space-4)", "border-radius: var(--radius-panel)"],
      ["workbench-share-confirmation", "padding: var(--space-6)", "border-radius: var(--radius-panel)"],
      ["workbench-report-filters", "gap: var(--space-2)", "min-height: var(--control-height)"],
      ["workbench-empty-state", "padding: var(--space-6)", "border-radius: var(--radius-panel)"],
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
    expect(radii.every((radius) => ["0", "0px", "2px", "4px", "50%", "var(--radius-control)", "var(--radius-panel)"].includes(radius))).toBe(true);
  });
});
