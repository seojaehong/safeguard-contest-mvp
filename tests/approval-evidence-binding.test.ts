import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Binding = {
  verified: boolean;
  failures: string[];
  artifacts: Array<{
    path: string;
    gitMode: string | null;
    headSha256: string | null;
    workingTreeMatchesHead: boolean;
  }>;
};

type BindingModule = {
  buildApprovalEvidenceBinding: (options: {
    root: string;
    inputPaths: string[];
    productionCommit: string;
    evidenceCommits: string[];
  }) => Binding;
};

async function loadBindingModule(): Promise<BindingModule> {
  const modulePath = path.resolve("scripts", "approval_evidence_binding.mjs");
  return await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`) as BindingModule;
}

function initRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "approval-binding-"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root, stdio: "ignore" });
  return root;
}

function commitAll(root: string): string {
  execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: root, stdio: "ignore" });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

describe("approval evidence binding", () => {
  it("binds regular evidence to the exact HEAD blob bytes", async () => {
    const root = initRepository();
    const relativePath = "evaluation/report.json";
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), "{\"ok\":true}\n", "utf8");
    const head = commitAll(root);
    const module = await loadBindingModule();

    const binding = module.buildApprovalEvidenceBinding({
      root,
      inputPaths: [relativePath],
      productionCommit: head,
      evidenceCommits: [head],
    });

    expect(binding.verified).toBe(true);
    expect(binding.failures).toEqual([]);
    expect(binding.artifacts[0]).toMatchObject({
      gitMode: "100644",
      workingTreeMatchesHead: true,
    });
    expect(binding.artifacts[0].headSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("fails closed when working bytes differ from the HEAD blob", async () => {
    const root = initRepository();
    const relativePath = "evaluation/report.json";
    fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(root, relativePath), "before\n", "utf8");
    const head = commitAll(root);
    fs.writeFileSync(path.join(root, relativePath), "after\n", "utf8");
    const module = await loadBindingModule();

    const binding = module.buildApprovalEvidenceBinding({
      root,
      inputPaths: [relativePath],
      productionCommit: head,
      evidenceCommits: [head],
    });

    expect(binding.verified).toBe(false);
    expect(binding.failures).toContain(`input-differs-from-head:${relativePath}`);
  });

  it("rejects a Git symlink entry even when the checkout presents a regular file", async () => {
    const root = initRepository();
    const relativePath = "evaluation/report.json";
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, "outside-report.json", "utf8");
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: root,
      encoding: "utf8",
      input: "outside-report.json",
    }).trim();
    execFileSync("git", ["update-index", "--add", "--cacheinfo", `120000,${blob},${relativePath}`], {
      cwd: root,
      stdio: "ignore",
    });
    execFileSync("git", ["commit", "-m", "symlink fixture"], { cwd: root, stdio: "ignore" });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const module = await loadBindingModule();

    const binding = module.buildApprovalEvidenceBinding({
      root,
      inputPaths: [relativePath],
      productionCommit: head,
      evidenceCommits: [head],
    });

    expect(binding.verified).toBe(false);
    expect(binding.failures).toContain(`input-git-mode-not-regular:${relativePath}:120000`);
    expect(binding.failures).toContain(`input-not-tracked-at-head:${relativePath}`);
  });
});
