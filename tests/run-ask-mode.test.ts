import { describe, expect, it } from "vitest";

import { resolveRunAskMode } from "@/lib/run-ask-mode";

describe("resolveRunAskMode", () => {
  it("defaults omitted generation requests to enhanced DB-harness mode", () => {
    expect(resolveRunAskMode({})).toBe("enhanced");
  });

  it("keeps explicit template mode available for demos and fast fixtures", () => {
    expect(resolveRunAskMode({ requestedMode: "template" })).toBe("template");
  });

  it("ignores invalid mode values instead of falling back to template", () => {
    expect(resolveRunAskMode({ requestedMode: "unknown" })).toBe("enhanced");
  });

  it("allows the environment default to opt into full mode", () => {
    expect(resolveRunAskMode({ envDefault: "full" })).toBe("full");
  });
});
