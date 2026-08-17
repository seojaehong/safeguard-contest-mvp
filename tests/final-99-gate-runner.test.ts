import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  coreDocumentChecks,
  requiredDeliverables,
  resolveAskAiMode,
  resolveDocsDir,
  resolveExecutionMode,
  shouldSkipAuthHistoryWrites,
} from "@/scripts/final_99_gate_contract.mjs";

describe("final-99 gate runner contract", () => {
  it("uses the same 12-document contract as the product and broad review", () => {
    expect(requiredDeliverables).toHaveLength(12);
    expect(new Set(requiredDeliverables).size).toBe(12);
    expect(requiredDeliverables).toContain("workPermitDraft");

    const permitCheck = coreDocumentChecks.find((item) => item.id === "permit-inspection");
    expect(permitCheck).toMatchObject({
      key: "workPermitDraft",
      routeTitle: "작업허가 및 안전점검표",
    });
    expect(permitCheck?.requiredTerms).toEqual(expect.arrayContaining(["허가", "격리", "차단", "종료", "보호구"]));
  });

  it("forces auth-history writes off in explicit no-mutation mode", () => {
    expect(resolveExecutionMode(["--no-mutation"], {})).toBe("no-mutation");
    expect(resolveExecutionMode([], { SAFEGUARD_NO_MUTATION: "1" })).toBe("no-mutation");
    expect(resolveExecutionMode([], {})).toBe("standard");

    expect(shouldSkipAuthHistoryWrites("operator-token", "no-mutation")).toBe(true);
    expect(shouldSkipAuthHistoryWrites("operator-token", "standard")).toBe(false);
    expect(shouldSkipAuthHistoryWrites(undefined, "standard")).toBe(true);
    expect(resolveAskAiMode("no-mutation", {})).toBe("template");
    expect(resolveAskAiMode("standard", {})).toBeUndefined();
    expect(resolveAskAiMode("no-mutation", { SAFEGUARD_FINAL99_AI_MODE: "enhanced" })).toBe("template");
    expect(resolveAskAiMode("standard", { SAFEGUARD_FINAL99_AI_MODE: "enhanced" })).toBe("enhanced");
  });

  it("allows evidence-only runs to isolate generated documentation", () => {
    const cwd = path.resolve("test-repo");
    const isolatedDocs = path.resolve("test-scan", "docs");
    expect(resolveDocsDir({}, cwd)).toBe(path.join(cwd, "docs"));
    expect(resolveDocsDir({ SAFEGUARD_DOCS_DIR: isolatedDocs }, cwd)).toBe(isolatedDocs);
  });

  it("keeps the orchestration download smoke on the same 12-document contract", () => {
    const source = fs.readFileSync("scripts/prod_orchestration_download_smoke.mjs", "utf8");
    for (const key of requiredDeliverables) expect(source).toContain(`["${key}"`);
    expect(source).toContain("SAFEGUARD_SMOKE_AI_MODE");
  });
});
