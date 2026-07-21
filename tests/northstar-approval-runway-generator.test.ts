import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type ApprovalRunwayReport = {
  overall: string;
  sourceHeadAtDraft: string;
  liveCommitAtDraft: string;
  launchReadiness: boolean;
  providerMessageSent: boolean;
  approvalGates: Array<{
    id: string;
    state: string;
    evidencePath: string;
    currentSafetyLock: string;
    forbiddenUntilApproved: string[];
  }>;
};

type ApprovalRunwayModule = {
  buildNorthstarApprovalRunway: (options: {
    rootDir: string;
    openGatePath: string;
    buildInfo: unknown;
    generatedAt?: string;
  }) => ApprovalRunwayReport;
};

async function loadRunwayModule(): Promise<ApprovalRunwayModule> {
  const sourcePath = path.resolve("scripts", "northstar_approval_runway.mjs");
  const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-approval-runway-module-"));
  const modulePath = path.join(moduleDir, "northstar_approval_runway.mjs");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^#!.*\r?\n/u, "");
  fs.writeFileSync(modulePath, source, "utf8");
  return await import(pathToFileURL(modulePath).href) as ApprovalRunwayModule;
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createFixtureRoot(): { root: string; head: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safeclaw-approval-runway-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: root, stdio: "ignore" });
  writeJson(root, "evaluation/northstar-open-gates-current/report.json", {
    overall: "open",
    gates: [
      { id: "provider_dispatch_persistence", state: "approval_gated", evidencePath: "evaluation\\provider-dispatch-idempotency-gate-2026-07-19\\report.json" },
      { id: "supabase_rls_launch_isolation", state: "approval_gated", evidencePath: "evaluation\\rls-llm-wiki-approval-preflight-current-2026-07-20\\report.json" },
      { id: "llm_wiki_publication", state: "approval_gated", evidencePath: "evaluation\\rls-llm-wiki-approval-preflight-current-2026-07-20\\report.json" },
      { id: "sif_embedding_runtime", state: "approval_gated", evidencePath: "evaluation\\sif-embedding-gate\\approval-preflight-report.json" },
    ],
  });
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  return { root, head };
}

describe("northstar approval runway generator", () => {
  it("builds the approval runway from the current open-gate matrix", async () => {
    const { buildNorthstarApprovalRunway } = await loadRunwayModule();
    const { root, head } = createFixtureRoot();
    const report = buildNorthstarApprovalRunway({
      rootDir: root,
      openGatePath: path.join("evaluation", "northstar-open-gates-current", "report.json"),
      buildInfo: { commitSha: head },
      generatedAt: "2026-07-21T00:00:00.000Z",
    });

    expect(report.overall).toBe("approval_runway_ready_open");
    expect(report.sourceHeadAtDraft).toBe(head);
    expect(report.liveCommitAtDraft).toBe(head);
    expect(report.launchReadiness).toBe(false);
    expect(report.providerMessageSent).toBe(false);
    expect(report.approvalGates.map((gate) => gate.id)).toEqual([
      "provider_dispatch_persistence",
      "supabase_rls_launch_isolation",
      "llm_wiki_publication",
      "sif_embedding_runtime",
    ]);
    expect(report.approvalGates.find((gate) => gate.id === "provider_dispatch_persistence")?.currentSafetyLock).toBe("preview_only");
    expect(report.approvalGates.find((gate) => gate.id === "provider_dispatch_persistence")?.evidencePath).toBe("evaluation/provider-dispatch-idempotency-gate-2026-07-19/report.json");
  });

  it("fails closed when a required approval gate is missing", async () => {
    const { buildNorthstarApprovalRunway } = await loadRunwayModule();
    const { root, head } = createFixtureRoot();
    const openGatePath = path.join(root, "evaluation", "northstar-open-gates-current", "report.json");
    const openGate = JSON.parse(fs.readFileSync(openGatePath, "utf8")) as { gates: Array<{ id: string }> };
    openGate.gates = openGate.gates.filter((gate) => gate.id !== "llm_wiki_publication");
    fs.writeFileSync(openGatePath, `${JSON.stringify(openGate, null, 2)}\n`, "utf8");

    expect(() => buildNorthstarApprovalRunway({
      rootDir: root,
      openGatePath: path.join("evaluation", "northstar-open-gates-current", "report.json"),
      buildInfo: { commitSha: head },
    })).toThrow(/Missing approval gate: llm_wiki_publication/u);
  });

  it("fails closed when an approval gate is accidentally marked proven", async () => {
    const { buildNorthstarApprovalRunway } = await loadRunwayModule();
    const { root, head } = createFixtureRoot();
    const openGatePath = path.join(root, "evaluation", "northstar-open-gates-current", "report.json");
    const openGate = JSON.parse(fs.readFileSync(openGatePath, "utf8")) as { gates: Array<{ id: string; state: string }> };
    const providerGate = openGate.gates.find((gate) => gate.id === "provider_dispatch_persistence");
    if (!providerGate) throw new Error("fixture missing provider gate");
    providerGate.state = "proven";
    fs.writeFileSync(openGatePath, `${JSON.stringify(openGate, null, 2)}\n`, "utf8");

    expect(() => buildNorthstarApprovalRunway({
      rootDir: root,
      openGatePath: path.join("evaluation", "northstar-open-gates-current", "report.json"),
      buildInfo: { commitSha: head },
    })).toThrow(/provider_dispatch_persistence must remain approval_gated/u);
  });
});
