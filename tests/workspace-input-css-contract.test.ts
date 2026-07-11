import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function workspaceSubmissionGuardCss(): string {
  const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
  const start = css.indexOf("/* Submission guard:");
  const end = css.indexOf("/* Document focus mode", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
}

describe("workspace input CSS contract", () => {
  it("keeps the responsive textarea cascade free of important overrides", () => {
    const guardCss = workspaceSubmissionGuardCss();
    const textareaBlocks = Array.from(
      guardCss.matchAll(
        /([^{}]*\.workspace-input-page \.command-console-input[^{}]*)\{([^{}]*)\}/g,
      ),
    );

    expect(textareaBlocks).toHaveLength(7);
    expect(
      textareaBlocks.reduce(
        (count, block) => count + (block[2].match(/!important/g) ?? []).length,
        0,
      ),
    ).toBe(0);
  });

  it("keeps the seven responsive textarea blocks on the reviewed declaration matrix", () => {
    const textareaBlocks = Array.from(
      workspaceSubmissionGuardCss().matchAll(
        /([^{}]*\.workspace-input-page \.command-console-input[^{}]*)\{([^{}]*)\}/g,
      ),
      (match) => match[2]
        .trim()
        .split(/;\s*/u)
        .filter(Boolean)
        .map((declaration) => declaration.replace(/\s+/gu, " ")),
    );

    expect(textareaBlocks).toEqual([
      ["box-sizing: border-box"],
      ["display: block", "min-height: 152px", "padding: 22px 24px", "overflow-y: auto", "line-height: 1.76", "resize: vertical"],
      ["min-height: 124px", "padding: 18px", "line-height: 1.74"],
      ["font-size: 14px"],
      ["min-height: 116px", "padding: 14px 15px", "line-height: 1.7"],
      ["min-height: 108px", "padding: 14px 12px", "line-height: 1.7"],
      ["min-height: 142px", "padding: 16px", "font-size: 15px", "line-height: 1.68"],
    ]);
  });
});
