import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");

describe("CI workflow supply-chain contract", () => {
  it("limits the default GitHub token to repository reads", () => {
    expect(workflow).toMatch(/\npermissions:\r?\n  contents: read\r?\n/u);
  });

  it("pins every external action to a reviewed full commit SHA", () => {
    const actionReferences = [...workflow.matchAll(/^\s*- uses:\s*([^\s#]+)(?:\s+#\s*(.+))?$/gmu)];

    expect(actionReferences).toHaveLength(2);
    expect(actionReferences.map((match) => match[1])).toEqual([
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
    ]);
    for (const match of actionReferences) {
      expect(match[1]).toMatch(/@[0-9a-f]{40}$/u);
      expect(match[2]).toMatch(/^v\d+\.\d+\.\d+$/u);
    }
  });

  it("keeps setup-node package-manager caching explicitly disabled", () => {
    expect(workflow).toContain("          package-manager-cache: false");
  });
});
