import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getModuleNavModel, modulePrimaryNav } from "@/lib/module-navigation";

function collectPageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectPageFiles(entryPath);
    return entry.name === "page.tsx" ? [entryPath] : [];
  });
}

describe("module shell navigation", () => {
  it("keeps internal module navigation to six primary destinations", () => {
    expect(modulePrimaryNav.map((item) => item.label)).toEqual([
      "작업공간",
      "문서",
      "리포트",
      "근거",
      "이력",
      "설정"
    ]);
  });

  it("maps AI connect into the settings section instead of exposing it as a primary item", () => {
    const model = getModuleNavModel("/settings/ai-connect");

    expect(model.primaryItems.filter((item) => item.isActive).map((item) => item.label)).toEqual(["설정"]);
    expect(model.secondaryItems).toContainEqual({
      href: "/settings/ai-connect",
      label: "내 AI 연결",
      code: "01",
      isActive: true
    });
  });

  it("keeps evidence knowledge surfaces under the evidence primary item", () => {
    const model = getModuleNavModel("/ontology");

    expect(model.primaryItems.filter((item) => item.isActive).map((item) => item.label)).toEqual(["근거"]);
    expect(model.secondaryItems.map((item) => item.href)).toEqual(["/knowledge", "/ontology", "/ops/api"]);
  });

  it("maps hidden utility routes to the right primary section without adding primary items", () => {
    expect(getModuleNavModel("/ask").activeSection.label).toBe("근거");
    expect(getModuleNavModel("/search").activeSection.label).toBe("근거");
    expect(getModuleNavModel("/dryrun").activeSection.label).toBe("설정");
    expect(getModuleNavModel("/preview").activeSection.label).toBe("작업공간");
    expect(modulePrimaryNav).toHaveLength(6);
  });

  it("keeps app route pages out of the retired v2 and generic hero shells", () => {
    const pageFiles = collectPageFiles(path.join(process.cwd(), "app"));
    const retiredPatterns = ["v2-shell", "v2-nav", "v2-hero", "hero grid"];
    const offenders = pageFiles.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return retiredPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${path.relative(process.cwd(), file)}:${pattern}`);
    });

    expect(offenders).toEqual([]);
  });
});
