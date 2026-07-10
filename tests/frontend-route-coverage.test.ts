import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { userVisibleRoutes } from "@/lib/frontend-design-contract";

const root = process.cwd();

type CssDeclarations = Record<string, string>;
type CssRule = { selectors: string[]; declarations: CssDeclarations };
type MediaBlock = { maxWidth: number; sourceIndex: number; endIndex: number; body: string };

const routeFamilies = {
  landing: ["/", "/home", "/why", "/trust", "/roadmap"],
  workbench: ["/workspace", "/reports"],
  module: ["/archive", "/documents", "/dispatch", "/evidence", "/evidence-file", "/ontology", "/tbm", "/worker", "/workers"],
  "knowledge/legal": ["/ask", "/knowledge", "/knowledge/[section]/[slug]", "/search", "/law/[id]", "/interpretation/[id]", "/precedent/[id]"],
  authentication: ["/login", "/auth/callback", "/settings", "/settings/ai-connect"],
  "internal/demo": ["/demo", "/preview", "/prototype", "/dryrun", "/ops/api"],
} as const;

const routeSurfaceOwners: Record<(typeof userVisibleRoutes)[number], string> = {
  "/": "components/SafeClawLanding.tsx",
  "/archive": "components/SafeClawModuleShell.tsx",
  "/ask": "app/ask/page.tsx",
  "/auth/callback": "app/auth/callback/page.tsx",
  "/demo": "components/V2DemoExperience.tsx",
  "/dispatch": "components/SafeClawModuleShell.tsx",
  "/documents": "components/SafeClawModuleShell.tsx",
  "/dryrun": "app/dryrun/page.tsx",
  "/evidence": "components/SafeClawModuleShell.tsx",
  "/evidence-file": "components/SafeClawModuleShell.tsx",
  "/home": "components/SafeClawModuleShell.tsx",
  "/interpretation/[id]": "app/interpretation/[id]/page.tsx",
  "/knowledge": "components/SafeClawModuleShell.tsx",
  "/knowledge/[section]/[slug]": "app/knowledge/[section]/[slug]/page.tsx",
  "/law/[id]": "app/law/[id]/page.tsx",
  "/login": "app/login/page.tsx",
  "/ontology": "components/SafeClawModuleShell.tsx",
  "/ops/api": "components/SafeClawModuleShell.tsx",
  "/precedent/[id]": "app/precedent/[id]/page.tsx",
  "/preview": "app/preview/page.tsx",
  "/prototype": "app/prototype/page.tsx",
  "/reports": "components/SafeClawModuleShell.tsx",
  "/roadmap": "app/roadmap/page.tsx",
  "/search": "app/search/page.tsx",
  "/settings": "components/SafeClawModuleShell.tsx",
  "/settings/ai-connect": "components/SafeClawModuleShell.tsx",
  "/tbm": "components/SafeClawModuleShell.tsx",
  "/trust": "app/trust/page.tsx",
  "/why": "app/why/page.tsx",
  "/worker": "components/SafeClawModuleShell.tsx",
  "/workers": "components/SafeClawModuleShell.tsx",
  "/workspace": "components/SafeGuardCommandCenter.tsx",
};

const canonicalSurfaceHooks: Record<string, string> = {
  "components/SafeClawLanding.tsx": "safeclaw-landing",
  "components/SafeClawModuleShell.tsx": "safeclaw-module-shell",
  "components/V2DemoExperience.tsx": "demo-mode-shell",
  "components/SafeGuardCommandCenter.tsx": "command-center-shell",
  "app/ask/page.tsx": "container grid",
  "app/auth/callback/page.tsx": "safeclaw-login-page",
  "app/dryrun/page.tsx": "route-internal-page",
  "app/interpretation/[id]/page.tsx": "container grid",
  "app/knowledge/[section]/[slug]/page.tsx": "knowledge-shell",
  "app/law/[id]/page.tsx": "container grid",
  "app/login/page.tsx": "safeclaw-login-page",
  "app/precedent/[id]/page.tsx": "container grid",
  "app/preview/page.tsx": "v2-shell",
  "app/roadmap/page.tsx": "v2-shell",
  "app/search/page.tsx": "container grid",
  "app/trust/page.tsx": "v2-shell",
  "app/why/page.tsx": "v2-shell",
};

const delegatedHeadingOwners: Partial<Record<(typeof userVisibleRoutes)[number], string>> = {
  "/login": "components/AdminLoginPanel.tsx",
  "/auth/callback": "components/AuthCallbackClient.tsx",
};

const sharedComponentOwners = {
  "components/AdminLoginPanel.tsx": "AdminLoginPanel",
  "components/AuthCallbackClient.tsx": "AuthCallbackClient",
  "components/SafeClawLanding.tsx": "SafeClawLanding",
  "components/SafeClawModuleShell.tsx": "SafeClawModuleShell",
  "components/V2DemoExperience.tsx": "V2DemoExperience",
  "components/SafeGuardCommandCenter.tsx": "SafeGuardCommandCenter",
} as const;

function listPageFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listPageFiles(absolutePath);
    return entry.name === "page.tsx" ? [absolutePath] : [];
  });
}

function routeFromPageFile(filePath: string): string {
  const relativeDirectory = path.relative(path.join(root, "app"), path.dirname(filePath));
  if (!relativeDirectory) return "/";
  return `/${relativeDirectory.split(path.sep).join("/")}`;
}

function pageFileFromRoute(route: string): string {
  return route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function ruleBlocks(source: string): CssRule[] {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.replace(/\s+/g, " ").trim()),
    declarations: Object.fromEntries(
      [...match[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
        declaration[1].trim(),
        declaration[2].trim(),
      ]),
    ),
  }));
}

function declarationsForExactSelector(source: string, selector: string): CssDeclarations {
  return Object.assign(
    {},
    ...ruleBlocks(source).filter((rule) => rule.selectors.includes(selector)).map((rule) => rule.declarations),
  );
}

function mediaBlocks(source: string): MediaBlock[] {
  const blocks: MediaBlock[] = [];
  const pattern = /@media\s*\(max-width:\s*(\d+)px\)\s*\{/g;
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) continue;
    const openingBrace = source.indexOf("{", match.index);
    let depth = 0;
    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push({
          maxWidth: Number(match[1]),
          sourceIndex: match.index,
          endIndex: index + 1,
          body: source.slice(openingBrace + 1, index),
        });
        break;
      }
    }
  }
  return blocks;
}

function withoutMediaBlocks(source: string): string {
  let cursor = 0;
  let result = "";
  for (const block of mediaBlocks(source)) {
    result += source.slice(cursor, block.sourceIndex);
    cursor = block.endIndex;
  }
  return result + source.slice(cursor);
}

function effectiveDeclarationsAtWidth(source: string, selector: string, width: number): CssDeclarations {
  const declarations = declarationsForExactSelector(withoutMediaBlocks(source), selector);
  for (const block of mediaBlocks(source).filter((item) => item.maxWidth >= width).sort((a, b) => a.sourceIndex - b.sourceIndex)) {
    Object.assign(declarations, declarationsForExactSelector(block.body, selector));
  }
  return declarations;
}

describe("frontend route classification", () => {
  it("discovers every page and assigns each route to exactly one family", () => {
    const discoveredRoutes = listPageFiles(path.join(root, "app")).map(routeFromPageFile).sort();
    const contractedRoutes = [...userVisibleRoutes].sort();
    const classifiedRoutes = Object.values(routeFamilies).flat();

    expect(discoveredRoutes).toEqual(contractedRoutes);
    expect([...classifiedRoutes].sort()).toEqual(discoveredRoutes);
    expect(new Set(classifiedRoutes).size).toBe(classifiedRoutes.length);
  });

  it("gives every rendered route a semantic title and its canonical surface hook", () => {
    for (const routes of Object.values(routeFamilies)) {
      for (const route of routes) {
        const owner = routeSurfaceOwners[route];
        const source = read(owner);
        if (route === "/prototype") {
          expect(source).toContain('redirect("/workspace")');
          continue;
        }

        expect(source, `${route} surface hook`).toContain(canonicalSurfaceHooks[owner]);
        const headingSource = delegatedHeadingOwners[route] ? read(delegatedHeadingOwners[route]) : source;
        expect(headingSource, `${route} semantic page title`).toMatch(/<h1\b/);
      }
    }
  });

  it("verifies every delegated route still renders its declared surface owner", () => {
    for (const owner of Object.values(delegatedHeadingOwners)) {
      expect(sharedComponentOwners, `${owner} delegated owner`).toHaveProperty(owner);
    }

    for (const route of userVisibleRoutes) {
      const pageSource = read(pageFileFromRoute(route));
      const owners = [routeSurfaceOwners[route], delegatedHeadingOwners[route]].filter(
        (owner): owner is string => Boolean(owner),
      );

      for (const owner of owners) {
        if (!(owner in sharedComponentOwners)) continue;
        const componentName = sharedComponentOwners[owner as keyof typeof sharedComponentOwners];

        expect(pageSource, `${route} renders ${componentName}`).toContain(`<${componentName}`);
        if (componentName === "SafeClawModuleShell") {
          expect(pageSource, `${route} module title`).toMatch(/\btitle=/);
          expect(pageSource, `${route} module description`).toMatch(/\bdescription=/);
        }
      }
    }
  });
});

describe("knowledge and legal route hierarchy", () => {
  it.each([
    "app/law/[id]/page.tsx",
    "app/precedent/[id]/page.tsx",
    "app/interpretation/[id]/page.tsx",
  ])("uses one semantic page title followed by semantic sections in %s", (relativePath) => {
    const source = read(relativePath);

    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source).toContain('<h1 className="title small-title">');
    expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source.match(/<h2 className="h2">/g)).toHaveLength(2);
    expect(source).not.toMatch(/<div className="h[23]">/);
  });

  it("binds legal prose and preformatted bodies to the long-form reading contract", () => {
    const css = withoutMediaBlocks(read("app/globals.css"));
    const lawSource = read("app/law/[id]/page.tsx");
    const precedentSource = read("app/precedent/[id]/page.tsx");
    const interpretationSource = read("app/interpretation/[id]/page.tsx");

    expect(lawSource).toContain("legal-detail-page");
    expect(precedentSource).toContain('<pre className="legal-reading-body">');
    expect(interpretationSource).toContain('<pre className="legal-reading-body">');
    expect(declarationsForExactSelector(css, ".law-body-viewer")).toMatchObject({
      "max-width": "var(--content-reading)",
    });
    expect(declarationsForExactSelector(css, ".law-section-lines p")).toMatchObject({
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-longform)",
    });
    expect(declarationsForExactSelector(css, ".legal-reading-body")).toMatchObject({
      width: "100%",
      "max-width": "var(--content-reading)",
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-longform)",
    });
  });

  it("uses semantic section and result headings on ask and search surfaces", () => {
    const sources = [
      "app/ask/page.tsx",
      "app/search/page.tsx",
      "components/AnswerPanel.tsx",
      "components/CitationList.tsx",
      "components/ResultCard.tsx",
    ].map(read).join("\n");

    expect(sources).not.toMatch(/<div className="h[23]">/);
    expect(sources.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(read("components/ResultCard.tsx")).toContain('<h3 className="h3">');
  });
});

describe("informational and demo route hierarchy", () => {
  it.each(["app/why/page.tsx", "app/trust/page.tsx", "app/roadmap/page.tsx"])(
    "uses semantic section headings and the landing family hook in %s",
    (relativePath) => {
      const source = read(relativePath);

      expect(source).toContain('className="v2-shell"');
      expect(source.match(/<h1\b/g)).toHaveLength(1);
      expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThan(0);
    },
  );

  it("uses semantic section and card headings throughout the demo", () => {
    const source = read("components/V2DemoExperience.tsx");
    const triadStart = source.indexOf('<section className="primary-triad-grid">');
    const triadEnd = source.indexOf("</section>", triadStart);
    const triadSource = source.slice(triadStart, triadEnd);

    expect(source).toContain("demo-mode-shell");
    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(source.match(/<h3\b/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(triadSource.match(/<h2\b/g)).toHaveLength(3);
    expect(triadSource).not.toMatch(/<h3\b/);
    expect(source.indexOf("<h2", source.indexOf("<h1"))).toBeLessThan(source.indexOf("<h3"));
  });
});

describe("module route section hierarchy", () => {
  it("promotes knowledge and settings section labels to semantic headings", () => {
    const knowledge = read("app/knowledge/page.tsx");
    const settings = read("app/settings/page.tsx");
    const briefing = read("components/BriefingSettingsCard.tsx");

    expect(knowledge.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(settings).toContain('<h2 className="safeclaw-section-title">{title}</h2>');
    expect(briefing).toContain('<h2 className="safeclaw-section-title">아침 브리핑</h2>');
  });

  it("keeps landing, preview, and ontology sections sequential", () => {
    expect(read("components/SafeClawLanding.tsx").match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(read("app/preview/page.tsx")).toContain('<h2 className="safeclaw-section-title">접어서 제공하는 8종</h2>');
    expect(read("app/ontology/page.tsx")).toContain('<h2 className="safeclaw-section-title">노드 리스트</h2>');
  });

  it("uses named canonical spacing hooks instead of inline layout styles on the dry-run route", () => {
    const source = read("app/dryrun/page.tsx");

    expect(source).toContain("route-internal-page");
    expect(source).toContain("route-internal-hero");
    expect(source).not.toMatch(/style=\{\{/);
  });

  it("binds route-family body, card, control, V2, demo, and legacy geometry to exact selectors", () => {
    const css = read("app/globals.css");
    const desktopCss = withoutMediaBlocks(css);

    expect(declarationsForExactSelector(desktopCss, "html")).toMatchObject({
      "font-size": "var(--text-body)",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".card")).toMatchObject({
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "var(--space-3) var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-card")).toMatchObject({
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-shared-action")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-description")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-card")).toMatchObject({
      padding: "var(--space-6)",
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-primary")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel p")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "line-height": "var(--leading-body-lg)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel")).toMatchObject({
      gap: "var(--space-6)",
      padding: "clamp(var(--space-8), 5vw, var(--space-16))",
      "border-radius": "var(--radius-panel)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-form button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "0 var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-shell")).toMatchObject({
      width: "min(var(--content-standard), calc(100% - (var(--space-6) * 2)))",
      padding: "var(--space-5) 0 var(--space-16)",
      gap: "var(--space-6)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-nav")).toMatchObject({
      top: "var(--space-2)",
      gap: "var(--space-4)",
      padding: "var(--space-3) var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-hero")).toMatchObject({
      gap: "var(--space-4)",
      padding: "clamp(var(--space-8), 6vw, var(--space-20))",
    });
    expect(declarationsForExactSelector(desktopCss, ".v2-hero h1")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "font-weight": "800",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-stage-panel")).toMatchObject({
      gap: "var(--space-5)",
      padding: "var(--space-6)",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-screen")).toMatchObject({
      gap: "var(--space-5)",
      padding: "clamp(var(--space-5), 3vw, var(--space-8))",
    });
    expect(declarationsForExactSelector(desktopCss, ".demo-mode-badges button")).toMatchObject({
      "min-height": "var(--control-height)",
      "border-radius": "var(--radius-control)",
      padding: "var(--space-2) var(--space-3)",
    });
    for (const selector of [
      ".v2-nav nav a",
      ".safeclaw-login-topbar nav a",
      ".demo-mode-badges button",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [".triad-card h2", ".preview-hero-card h2"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-panel h1")).toMatchObject({
      "font-size": "var(--text-page-title)",
      "font-weight": "800",
      "line-height": "var(--leading-page-title)",
      "letter-spacing": "var(--tracking-page-title)",
    });
    for (const selector of [
      ".safeclaw-login-form input",
      ".safeclaw-login-form button",
      ".safeclaw-login-actions a",
      ".safeclaw-login-actions button",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [".scenario-strip", ".api-pulse-grid", ".primary-triad-grid", ".trust-grid", ".roadmap-list"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ gap: "var(--space-4)" });
    }
    for (const selector of [".triad-card", ".preview-hero-card", ".trust-grid article", ".roadmap-item"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ padding: "var(--space-6)" });
      expect(effectiveDeclarationsAtWidth(css, selector, 767), `${selector} at 767px`).toMatchObject({
        padding: "var(--space-4)",
      });
    }
    expect(effectiveDeclarationsAtWidth(css, ".v2-shell", 767)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
    expect(effectiveDeclarationsAtWidth(css, ".demo-mode-shell", 767)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
    for (const [selector, measure] of [
      [".container", "var(--content-wide)"],
      [".v2-shell", "var(--content-standard)"],
      [".demo-mode-shell", "var(--content-wide)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, selector, 1280), `${selector} desktop`).toMatchObject({
        width: `min(${measure}, calc(100% - (var(--space-6) * 2)))`,
      });
      expect(effectiveDeclarationsAtWidth(css, selector, 1024), `${selector} tablet`).toMatchObject({
        width: `min(${measure}, calc(100% - (var(--space-5) * 2)))`,
      });
      expect(effectiveDeclarationsAtWidth(css, selector, 767), `${selector} mobile precedence`).toMatchObject({
        width: "min(100%, calc(100% - (var(--space-4) * 2)))",
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".list")).toMatchObject({ gap: "14px" });
    expect(declarationsForExactSelector(desktopCss, ".row")).toMatchObject({ gap: "10px" });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .list")).toMatchObject({
      gap: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .row")).toMatchObject({
      gap: "var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .card")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".route-supporting-page .card", 767)).toMatchObject({
      padding: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .hero")).toMatchObject({
      padding: "var(--space-6)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".route-supporting-page .hero", 767)).toMatchObject({
      padding: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .subtitle")).toMatchObject({
      "font-size": "var(--text-body-lg)",
      "font-weight": "500",
      "line-height": "var(--leading-body-lg)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".subtitle")).toMatchObject({
      "font-size": "var(--text-component-title)",
      "font-weight": "700",
      "line-height": "var(--leading-component-title)",
      "letter-spacing": "var(--tracking-component-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-login-topbar nav")).toMatchObject({
      gap: "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".route-supporting-page .two")).toMatchObject({
      gap: "var(--space-4)",
    });
    for (const [width, gutter, heroPadding, surfacePadding, marginTop] of [
      [1280, "var(--space-6)", "var(--space-12) var(--space-6)", "var(--space-6)", "var(--space-8)"],
      [1024, "var(--space-5)", "var(--space-10) var(--space-5)", "var(--space-5)", "var(--space-6)"],
      [767, "var(--space-4)", "var(--space-8) var(--space-4)", "var(--space-4)", "var(--space-4)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-hero", width), `module hero ${width}`).toMatchObject({
        padding: heroPadding,
      });
      expect(
        effectiveDeclarationsAtWidth(
          css,
          ".safeclaw-module-shell.module-variant-document .safeclaw-module-hero",
          width,
        ),
        `document module hero ${width}`,
      ).toMatchObject({ padding: heroPadding });
      for (const selector of [".safeclaw-module-grid", ".safeclaw-module-panel"]) {
        expect(effectiveDeclarationsAtWidth(css, selector, width), `${selector} ${width}`).toMatchObject({
          width: `min(var(--content-wide), calc(100% - (${gutter} * 2)))`,
          margin: `${marginTop} auto 0`,
        });
      }
      for (const selector of [".safeclaw-module-grid article", ".safeclaw-module-grid.nine article"]) {
        expect(effectiveDeclarationsAtWidth(css, selector, width), `${selector} ${width}`).toMatchObject({
          padding: surfacePadding,
        });
      }
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-panel", width)).toMatchObject({
        padding: surfacePadding,
      });
    }
    const workpackEditor = read("components/WorkpackEditor.tsx");
    expect(workpackEditor).toContain('className="workpack-sidebar card list"');
    expect(workpackEditor).not.toContain("route-supporting-page");
    expect(effectiveDeclarationsAtWidth(css, ".container", 720)).toMatchObject({
      width: "min(100%, calc(100% - (var(--space-4) * 2)))",
    });
  });

  it("binds landing and ordinary module internals to canonical roles and spacing", () => {
    const css = read("app/globals.css");
    const desktopCss = withoutMediaBlocks(css);

    for (const [width, gutter] of [
      [1280, "var(--space-6)"],
      [1024, "var(--space-5)"],
      [767, "var(--space-4)"],
    ] as const) {
      expect(effectiveDeclarationsAtWidth(css, ".safeclaw-landing", width), `landing gutter ${width}`).toMatchObject({
        "--os-gutter": gutter,
      });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-brand")).toMatchObject({
      gap: "var(--space-4)",
      padding: "0 var(--space-6) 0 0",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-status")).toMatchObject({ gap: "var(--space-6)" });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-hero-body")).toMatchObject({
      gap: "clamp(var(--space-8), 5vw, var(--space-20))",
      padding: "clamp(var(--space-12), 6vw, var(--space-20)) 0",
      "padding-inline": "var(--os-gutter)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-console")).toMatchObject({
      gap: "var(--space-4)",
      padding: "var(--space-6)",
    });

    for (const selector of [
      ".safeclaw-landing-nav nav button",
      ".safeclaw-landing-nav nav a",
      ".safeclaw-login",
      ".safeclaw-contact",
      ".safeclaw-os-console button",
      ".safeclaw-os-console a",
      ".safeclaw-terminal button",
      ".safeclaw-terminal a",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "min-height": "var(--control-height)",
        "font-size": "var(--text-control)",
        "font-weight": "700",
        "line-height": "var(--leading-control)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [
      ".safeclaw-pipeline-grid h3",
      ".safeclaw-proof-matrix h3",
      ".safeclaw-language-matrix h3",
      ".safeclaw-module-map h3",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        margin: "0 0 var(--space-6)",
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }

    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-panel h2")).toMatchObject({
      margin: "var(--space-4) 0 var(--space-3)",
      "font-size": "var(--text-component-title)",
      "font-weight": "700",
      "line-height": "var(--leading-component-title)",
      "letter-spacing": "var(--tracking-component-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-panel p")).toMatchObject({
      "font-size": "var(--text-body)",
      "font-weight": "500",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    for (const selector of [".safeclaw-archive-list p", ".safeclaw-worker-table p", ".safeclaw-tbm-board p"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-support)",
        "font-weight": "500",
        "line-height": "var(--leading-body)",
        "letter-spacing": "var(--tracking-body)",
      });
    }
    for (const selector of [
      ".safeclaw-worker-table strong",
      ".safeclaw-archive-list strong",
      ".safeclaw-tbm-board strong",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({
        "font-size": "var(--text-component-title)",
        "font-weight": "700",
        "line-height": "var(--leading-component-title)",
        "letter-spacing": "var(--tracking-component-title)",
      });
    }
    for (const selector of [".safeclaw-worker-table", ".safeclaw-archive-list", ".safeclaw-tbm-board"]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ gap: "var(--space-4)" });
    }
    for (const selector of [
      ".safeclaw-worker-table article",
      ".safeclaw-archive-list article",
      ".safeclaw-tbm-board article",
    ]) {
      expect(declarationsForExactSelector(desktopCss, selector), selector).toMatchObject({ padding: "var(--space-6)" });
    }
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-worker-phone")).toMatchObject({
      "margin-top": "var(--space-4)",
      "padding-left": "var(--space-4)",
    });
    expect(declarationsForExactSelector(desktopCss, ".worker-language-switcher")).toMatchObject({
      margin: "var(--space-4) 0 var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".worker-language-switcher button")).toMatchObject({
      "min-height": "var(--control-height)",
      padding: "var(--space-3)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-rail nav", 980)).toMatchObject({
      gap: "0 var(--space-4)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-module-nav", 980)).toMatchObject({
      gap: "var(--space-3)",
      padding: "var(--space-4) var(--space-5)",
    });

    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-tag")).toMatchObject({
      "margin-bottom": "clamp(var(--space-8), 4vw, var(--space-16))",
      padding: "var(--space-3) var(--space-5)",
      "font-family": "var(--font-hud)",
      "font-size": "var(--text-hud)",
      "font-weight": "700",
      "line-height": "var(--leading-hud)",
      "letter-spacing": "var(--tracking-hud)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-os-section h2")).toMatchObject({
      "font-size": "var(--text-section-title)",
      "font-weight": "800",
      "line-height": "var(--leading-section-title)",
      "letter-spacing": "var(--tracking-section-title)",
    });
    expect(effectiveDeclarationsAtWidth(css, ".safeclaw-os-section h2", 767)).toMatchObject({
      "font-size": "var(--text-section-title)",
      "line-height": "var(--leading-section-title)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-terminal pre")).toMatchObject({
      "font-family": "var(--font-product)",
      "font-size": "var(--text-body)",
      "font-weight": "500",
      "line-height": "var(--leading-body)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-rail h2")).toMatchObject({
      "font-family": "var(--font-hud)",
      "font-size": "var(--text-hud)",
      "font-weight": "700",
      "line-height": "var(--leading-hud)",
      "letter-spacing": "var(--tracking-hud)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-rail a strong")).toMatchObject({
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-main")).toMatchObject({
      "padding-bottom": "var(--space-16)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-module-nav i")).toMatchObject({
      "margin-right": "var(--space-2)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-current-workpack")).toMatchObject({
      gap: "var(--space-4)",
      margin: "var(--space-8) auto 0",
      padding: "var(--space-4) var(--space-6)",
    });
    expect(declarationsForExactSelector(desktopCss, ".safeclaw-current-workpack a")).toMatchObject({
      "min-height": "var(--control-height)",
      padding: "0 var(--space-4)",
      "font-family": "var(--font-product)",
      "font-size": "var(--text-control)",
      "font-weight": "700",
      "line-height": "var(--leading-control)",
      "letter-spacing": "var(--tracking-body)",
    });

    const auditedFamilySelector = /(?:safeclaw-(?:landing|os-|pipeline|proof|language|module-map|terminal|footer)|hero-console|safeclaw-module-(?:rail|main|nav)|safeclaw-current-workpack)/;
    const spacingProperties = new Set(["gap", "row-gap", "column-gap", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "top", "right", "bottom", "left"]);
    const disallowedFixedSpacing = new Set([2, 5, 6, 9, 10, 11, 14, 18, 22, 26, 28, 30, 42, 44, 46, 56, 72]);
    const residuals = ruleBlocks(css).flatMap((rule) => {
      if (!rule.selectors.some((selector) => auditedFamilySelector.test(selector))) return [];
      if (rule.selectors.some((selector) => selector.includes("module-variant-document"))) return [];
      return Object.entries(rule.declarations).flatMap(([property, value]) => {
        if (!spacingProperties.has(property)) return [];
        const offenders = [...value.matchAll(/(?<![-\w])(-?\d+)px\b/g)]
          .map((match) => Number(match[1]))
          .filter((number) => disallowedFixedSpacing.has(Math.abs(number)));
        return offenders.length ? [`${rule.selectors.join(", ")} { ${property}: ${value} }`] : [];
      });
    });
    expect(residuals).toEqual([]);
  });
});
