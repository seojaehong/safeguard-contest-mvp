import { describe, expect, it } from "vitest";

import { getModuleNavModel, modulePrimaryNav } from "@/lib/module-navigation";

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
});
