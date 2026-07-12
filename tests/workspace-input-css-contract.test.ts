import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function workspaceCss(): string {
  return fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
}

function workspaceSubmissionGuardCss(): string {
  const css = workspaceCss();
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

  it("keeps the seven responsive textarea blocks on the approved W7 padding and readability matrix", () => {
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
      ["min-height: 124px", "padding: 18px", "font-size: var(--text-body)", "line-height: 1.74"],
      ["font-size: var(--text-control)", "font-weight: 500", "line-height: 1.74", "letter-spacing: var(--tracking-body)"],
      ["min-height: 116px", "padding: 14px 15px", "line-height: 1.7"],
      ["min-height: 108px", "padding: 14px 12px", "line-height: 1.7"],
      ["min-height: 142px", "padding: 16px", "font-size: var(--text-body)", "line-height: var(--leading-body-lg)", "font-weight: 500", "letter-spacing: var(--tracking-body)"],
    ]);
  });

  it("keeps the submission guard as the final owner of workspace textarea line height", () => {
    const css = workspaceCss();
    const submissionGuard = css.indexOf("/* Submission guard:");
    const documentFocus = css.indexOf("/* Document focus mode", submissionGuard);

    expect(submissionGuard).toBeGreaterThanOrEqual(0);
    expect(documentFocus).toBeGreaterThan(submissionGuard);
    expect(css.slice(documentFocus)).not.toMatch(
      /\.command-center-shell\.workspace-theme-day \.workspace-input-page \.command-console-input,\s*\.command-center-shell\.workspace-theme-night \.workspace-input-page \.command-console-input\s*\{\s*line-height:\s*var\(--leading-longform\);\s*\}/u,
    );
    expect(css.slice(documentFocus)).not.toMatch(
      /\.command-center-shell\.workspace-theme-day \.workspace-input-page \.command-console-input,\s*\.command-center-shell\.workspace-theme-night \.workspace-input-page \.command-console-input\s*\{\s*min-height:\s*118px;\s*\}/u,
    );
    expect(css.slice(documentFocus)).not.toMatch(
      /\.command-center-shell\.workspace-theme-day \.workspace-input-page \.command-console-input,\s*\.command-center-shell\.workspace-theme-night \.workspace-input-page \.command-console-input\s*\{\s*min-height:\s*150px;/u,
    );
  });
});
