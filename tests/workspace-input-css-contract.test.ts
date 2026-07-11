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
});
