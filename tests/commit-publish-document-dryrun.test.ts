import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/commit_publish_document_dryrun.sh", "utf8");
const windowsGitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
const bashExecutable = process.platform === "win32" && existsSync(windowsGitBash)
  ? windowsGitBash
  : "bash";

function createPublicationFixture(): { root: string; head: string; scriptPath: string } {
  const root = mkdtempSync(join(tmpdir(), "safeclaw-document-publish-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  cpSync("scripts/commit_publish_document_dryrun.sh", join(root, "scripts", "commit_publish_document_dryrun.sh"));
  writeFileSync(join(root, "package.json"), JSON.stringify({
    private: true,
    scripts: { "dryrun:documents": "node scripts/test-generate.mjs" },
  }, null, 2));
  writeFileSync(join(root, "scripts", "test-generate.mjs"), [
    'import { mkdirSync, writeFileSync } from "node:fs";',
    'mkdirSync("data/dryrun", { recursive: true });',
    'writeFileSync("data/dryrun/latest-document-dryrun.json", "{}\\n");',
    'writeFileSync("data/dryrun/latest-document-dryrun.md", "# fixture\\n");',
    'if (process.env.TEST_UNEXPECTED === "1") writeFileSync("unexpected.txt", "unexpected\\n");',
  ].join("\n"));
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "SafeClaw Test"], { cwd: root });
  execFileSync("git", ["config", "user.email", "safeclaw-test@example.invalid"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-m", "test: initialize fixture"], { cwd: root, stdio: "ignore" });
  return {
    root,
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    scriptPath: join(root, "scripts", "commit_publish_document_dryrun.sh"),
  };
}

function runPublication(
  fixture: { root: string; scriptPath: string },
  env: Record<string, string> = {},
): ReturnType<typeof spawnSync> {
  return spawnSync(bashExecutable, [fixture.scriptPath], {
    cwd: fixture.root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("document dry-run publication safety contract", { timeout: 15_000 }, () => {
  it("requires a clean tree and stages only generated snapshot outputs", () => {
    expect(source).toContain("git status --porcelain=v1 --untracked-files=all");
    expect(source).toContain("working tree must be clean before generating a publication snapshot");
    expect(source).toContain('"data/dryrun/latest-document-dryrun.json"');
    expect(source).toContain('"data/dryrun/latest-document-dryrun.md"');
    expect(source).toContain('readonly MANIFEST_PATH="data/dryrun/latest-document-dryrun-manifest.json"');
    expect(source).toContain('crypto.createHash("sha256")');
    expect(source).toContain('git add -- "${EXPECTED_PATHS[@]}"');
    expect(source).toContain("unexpected generated path");
    expect(source).toContain("unexpected staged path");
    expect(source).not.toContain("git add data/dryrun app/page.tsx");
  });

  it("holds commits by default and binds an approved commit to the clean starting HEAD", () => {
    expect(source).toContain('COMMIT_APPROVED="${SAFETYGUARD_COMMIT_APPROVED:-0}"');
    expect(source).toContain('START_HEAD="$(git rev-parse HEAD)"');
    expect(source).toContain('[[ -n "$EXPECTED_HEAD" && "$EXPECTED_HEAD" == "$START_HEAD" ]]');
    expect(source).toContain('[[ -n "$EXPECTED_SOURCE_BRANCH" && "$EXPECTED_SOURCE_BRANCH" == "$CURRENT_BRANCH" ]]');
    expect(source).toContain('git diff --cached -- "${EXPECTED_PATHS[@]}"');
    expect(source).toContain("Commit is held until SAFETYGUARD_COMMIT_APPROVED=1");
    expect(source).toContain("created commit contains unexpected path");
  });

  it("requires separate push approval and exact remote, branch, and subtree identities", () => {
    expect(source).toContain('PUSH_APPROVED="${SAFETYGUARD_PUSH_APPROVED:-0}"');
    expect(source).toContain('readonly PUBLISH_REMOTE="contest-mvp-origin"');
    expect(source).toContain('readonly PUBLISH_BRANCH="master"');
    expect(source).toContain('readonly PUBLISH_PREFIX="contest-mvp"');
    expect(source).toContain('[[ "$PUSH_APPROVED" == "1" ]]');
    expect(source).toContain('[[ "$EXPECTED_REMOTE" == "$PUBLISH_REMOTE" ]]');
    expect(source).toContain('[[ "$EXPECTED_BRANCH" == "$PUBLISH_BRANCH" ]]');
    expect(source).toContain('[[ "$EXPECTED_PREFIX" == "$PUBLISH_PREFIX" ]]');
    expect(source).toContain('git subtree push --prefix "$PUBLISH_PREFIX" "$PUBLISH_REMOTE" "$PUBLISH_BRANCH"');
  });

  it("generates only expected outputs without committing by default", () => {
    const fixture = createPublicationFixture();
    const result = runPublication(fixture);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Commit is held until SAFETYGUARD_COMMIT_APPROVED=1");
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture.root, encoding: "utf8" }).trim()).toBe(fixture.head);
    expect(execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: fixture.root, encoding: "utf8" })).toBe("");
    const manifest = JSON.parse(readFileSync(join(fixture.root, "data", "dryrun", "latest-document-dryrun-manifest.json"), "utf8")) as {
      sourceHead: string;
      artifacts: Array<{ path: string; bytes: number; sha256: string }>;
    };
    expect(manifest.sourceHead).toBe(fixture.head);
    expect(manifest.artifacts.map((artifact) => artifact.path)).toEqual([
      "data/dryrun/latest-document-dryrun.json",
      "data/dryrun/latest-document-dryrun.md",
    ]);
    expect(manifest.artifacts.every((artifact) => artifact.bytes > 0 && /^[0-9a-f]{64}$/u.test(artifact.sha256))).toBe(true);
  });

  it("fails closed when the generator writes an unexpected path", () => {
    const fixture = createPublicationFixture();
    const result = runPublication(fixture, { TEST_UNEXPECTED: "1" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unexpected generated path: unexpected.txt");
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture.root, encoding: "utf8" }).trim()).toBe(fixture.head);
    expect(execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: fixture.root, encoding: "utf8" })).toBe("");
  });

  it("fails closed when commit approval is not bound to the clean starting HEAD", () => {
    const fixture = createPublicationFixture();
    const result = runPublication(fixture, { SAFETYGUARD_COMMIT_APPROVED: "1" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SAFETYGUARD_EXPECTED_HEAD must equal the clean starting HEAD");
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture.root, encoding: "utf8" }).trim()).toBe(fixture.head);
    expect(execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: fixture.root, encoding: "utf8" })).toBe("");
  });

  it("commits only the digest-bound snapshot when HEAD and source branch are approved", () => {
    const fixture = createPublicationFixture();
    const sourceBranch = execFileSync("git", ["branch", "--show-current"], { cwd: fixture.root, encoding: "utf8" }).trim();
    const result = runPublication(fixture, {
      SAFETYGUARD_COMMIT_APPROVED: "1",
      SAFETYGUARD_EXPECTED_HEAD: fixture.head,
      SAFETYGUARD_EXPECTED_SOURCE_BRANCH: sourceBranch,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Exact staged publication diff:");
    expect(result.stdout).toContain("Committed. Push remains disabled.");
    expect(execFileSync("git", ["rev-parse", "HEAD"], { cwd: fixture.root, encoding: "utf8" }).trim()).not.toBe(fixture.head);
    expect(execFileSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], {
      cwd: fixture.root,
      encoding: "utf8",
    }).trim().split(/\r?\n/u).sort()).toEqual([
      "data/dryrun/latest-document-dryrun-manifest.json",
      "data/dryrun/latest-document-dryrun.json",
      "data/dryrun/latest-document-dryrun.md",
    ].sort());
    expect(execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: fixture.root,
      encoding: "utf8",
    })).toBe("");
  });
});
