import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function cssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  expect(match, `missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("shared framework states", () => {
  const stateFiles = ["app/not-found.tsx", "app/error.tsx", "app/global-error.tsx", "app/workspace/loading.tsx"];

  it.each(stateFiles)("uses a semantic title and the shared special-state hook in %s", (relativePath) => {
    const source = read(relativePath);

    expect(source).toMatch(/<h[12][^>]*className="special-state-title"/);
    expect(source).toContain('className="card list special-state"');
  });

  it("uses a named loading spinner instead of inline numeric styles", () => {
    const source = read("app/workspace/loading.tsx");

    expect(source).toContain('className="loading-spinner"');
    expect(source).not.toMatch(/style=\{\{/);
  });
});

describe("shared shell hooks and accessibility", () => {
  it("exposes stable module shell hooks", () => {
    const source = read("components/SafeClawModuleShell.tsx");

    for (const hook of [
      "safeclaw-module-header",
      "safeclaw-module-navigation",
      "safeclaw-module-title",
      "safeclaw-module-description",
      "safeclaw-module-content",
    ]) {
      expect(source).toContain(hook);
    }
  });

  it.each(["components/SafeClawModuleShell.tsx", "components/SafeClawLanding.tsx"])(
    "keeps decorative brand marks inside accessibly named controls in %s",
    (relativePath) => {
      const source = read(relativePath);
      const decorativeImageLinks = source.match(/<Link[^>]+>[\s\S]*?<img[^>]+alt=""[^>]*\/>[\s\S]*?<\/Link>/g) ?? [];

      expect(decorativeImageLinks.length).toBeGreaterThan(0);
      for (const link of decorativeImageLinks) {
        expect(link).toMatch(/aria-label="[^"]+"/);
      }
    },
  );
});

describe("canonical shared surface styles", () => {
  const css = read("app/globals.css");

  it("defines the shared special state with canonical panel geometry", () => {
    const rule = cssRule(css, ".special-state");

    expect(rule).toContain("padding: var(--space-6)");
    expect(rule).toContain("border-radius: var(--radius-panel)");
    expect(rule).not.toContain("!important");
  });

  it("defines a circular named loading spinner on the canonical icon size", () => {
    const rule = cssRule(css, ".loading-spinner");

    expect(rule).toContain("width: 24px");
    expect(rule).toContain("height: 24px");
    expect(rule).toContain("border-radius: var(--radius-circle)");
    expect(rule).toContain("animation: spin 0.8s linear infinite");
  });

  it("keeps shell titles, descriptions, actions, and cards on canonical tuples", () => {
    const title = cssRule(css, ".safeclaw-module-title");
    const description = cssRule(css, ".safeclaw-module-description");
    const action = cssRule(css, ".safeclaw-module-primary");
    const card = cssRule(css, ".safeclaw-module-card");

    expect(title).toContain("font-size: var(--text-page-title)");
    expect(title).toContain("line-height: var(--leading-page-title)");
    expect(title).toContain("letter-spacing: var(--tracking-page-title)");
    expect(description).toContain("font-size: var(--text-body-lg)");
    expect(description).toContain("line-height: var(--leading-body-lg)");
    expect(description).toContain("letter-spacing: var(--tracking-body)");
    expect(action).toContain("min-height: var(--control-height)");
    expect(action).toContain("border-radius: var(--radius-control)");
    expect(card).toContain("padding: var(--space-6)");
    expect(card).toContain("border-radius: var(--radius-panel)");
  });
});
