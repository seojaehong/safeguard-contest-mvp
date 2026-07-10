import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { userVisibleRoutes } from "@/lib/frontend-design-contract";

const root = process.cwd();

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
    const sharedOwners = {
      "components/SafeClawLanding.tsx": "SafeClawLanding",
      "components/SafeClawModuleShell.tsx": "SafeClawModuleShell",
      "components/V2DemoExperience.tsx": "V2DemoExperience",
      "components/SafeGuardCommandCenter.tsx": "SafeGuardCommandCenter",
    } as const;

    for (const route of userVisibleRoutes) {
      const owner = routeSurfaceOwners[route];
      if (!(owner in sharedOwners)) continue;
      const componentName = sharedOwners[owner as keyof typeof sharedOwners];
      const pageSource = read(pageFileFromRoute(route));

      expect(pageSource, `${route} renders ${componentName}`).toContain(`<${componentName}`);
      if (componentName === "SafeClawModuleShell") {
        expect(pageSource, `${route} module title`).toMatch(/\btitle=/);
        expect(pageSource, `${route} module description`).toMatch(/\bdescription=/);
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
    expect(source).not.toMatch(/<div className="h[23]">/);
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

    expect(source).toContain("demo-mode-shell");
    expect(source.match(/<h1\b/g)).toHaveLength(1);
    expect(source.match(/<h2\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(source.match(/<h3\b/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
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

  it("keeps route-family containers, cards, controls, and mobile gutters on canonical geometry", () => {
    const css = read("app/globals.css");
    const geometryHooks = [
      "safeclaw-landing",
      "safeclaw-module-shell",
      "command-center-shell",
      "safeclaw-login-page",
      "v2-shell",
      "demo-mode-shell",
      "container",
    ];

    for (const hook of geometryHooks) {
      expect(css, `${hook} CSS hook`).toContain(`.${hook}`);
    }
    expect(css).toContain("width: min(var(--content-standard), calc(100% - (var(--space-6) * 2)))");
    expect(css).toContain("width: min(var(--content-wide), calc(100% - (var(--space-6) * 2)))");
    expect(css).toContain("width: min(100%, calc(100% - (var(--space-4) * 2)))");
    expect(css).toContain("border-radius: var(--radius-panel)");
    expect(css).toContain("border-radius: var(--radius-control)");
    expect(css).toContain("min-height: var(--control-height)");
  });
});
