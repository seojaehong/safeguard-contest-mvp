#!/usr/bin/env node
// 바뀐 파일로 PR 전에 돌릴 시험을 고른다(/correct 261027, interrogate 반영).
// 「바뀐 모듈을 import 하는 시험 grep」만으로는 CSS 전체를 읽는 계약 시험과
// 브라우저로 화면을 그리는 시험을 못 잡아 #121 에서 CI 18분을 버렸다.
// 이것은 「고르는 도구」다. 막는 장치는 CI 의 전체 시험이고, 이 도구는 그 전에 먼저 돌릴 것을 고른다.
// 사용: node scripts/affected_tests.mjs [base=origin/master]
//       node scripts/affected_tests.mjs --files <경로...>
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalFrontendIdentityFiles } from "./frontend_audit_source_identity.mjs";

const VITEST_TEST = /^tests\/.+\.test\.ts$/;
const LEAVE_TEST = /^tests\/.+\.(test|crosscheck)\.mts$/;
const BROWSER_HARNESS = "isolated-next-browser-harness";
const AUDIT_RUNNER = "frontend_consistency_audit";

function stem(file) {
  return file.replace(/\.(d\.)?(m|c)?(ts|tsx|js|jsx)$/, "");
}

function mentions(source, file) {
  const base = path.posix.basename(file);
  // 전체 경로·파일 이름·「/이름」(상대 import ./helpers/x 를 잡는다).
  const needles = file.endsWith(".css") ? [file, base] : [stem(file), base, `/${stem(base)}`];
  // 경로 뒤가 따옴표·점·끝일 때만 맞춘다(lib/ai 가 lib/ai-deliverables 를 잡지 않게).
  return needles.some((needle) => new RegExp(`${escapeRegExp(needle)}(?=["'\`.]|$)`, "m").test(source));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function selectAffectedTests(changedFiles, testSources, identityFiles = []) {
  const picked = new Map();
  const add = (test, reason) => {
    if (!picked.has(test)) picked.set(test, new Set());
    picked.get(test).add(reason);
  };
  const identity = new Set(identityFiles);
  const cssChanged = changedFiles.some((file) => file.endsWith(".css"));
  // 지운 app·components TSX 도 지문을 바꾼다(지금 목록에는 없으니 모양으로 잡는다).
  const identityChanged = changedFiles.filter((file) => identity.has(file) || /^(app|components)\/.+\.tsx$/.test(file));
  const screenChanged = cssChanged || identityChanged.length > 0;
  for (const [test, source] of testSources) {
    if (changedFiles.includes(test)) add(test, "바뀐 시험");
    for (const file of changedFiles) {
      if (file === test || file.startsWith("evaluation/")) continue;
      if (mentions(source, file)) add(test, `경로 언급 ${file}`);
    }
    if (cssChanged && source.includes("globals.css")) add(test, "CSS 변경 → globals.css 를 읽는 시험");
    if (screenChanged && source.includes(AUDIT_RUNNER)) add(test, "화면 변경 → 화면 감사를 돌리는 시험");
    if (screenChanged && source.includes(BROWSER_HARNESS)) add(test, "화면 변경 → 브라우저로 그리는 시험");
  }
  const entries = [...picked].sort(([a], [b]) => a.localeCompare(b));
  const commands = [];
  if (identityChanged.length) {
    commands.push(`npm.cmd run -s audit:frontend-consistency  (화면 지문 identity ${identityChanged.length}파일 변경 → static-audit.json 재생성·커밋)`);
    commands.push("node ./scripts/frontend_consistency_browser_audit.mjs  (브라우저 매트릭스 재생성) 또는 browser-evidence-lag.json 에 재생성 뒤 identity·사유 한 줄");
  }
  if (entries.some(([test]) => LEAVE_TEST.test(test))) commands.push("npm.cmd run -s leave:test  (.mts 시험은 vitest 가 아니라 이 명령으로 돈다)");
  return {
    tests: entries.filter(([test]) => VITEST_TEST.test(test)),
    leaveTests: entries.filter(([test]) => LEAVE_TEST.test(test)),
    commands,
  };
}

function changedFilesSince(base) {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
  const lines = [
    git("diff", "--name-only", `${base}...HEAD`),
    git("diff", "--name-only", "HEAD"),
    git("ls-files", "--others", "--exclude-standard"),
  ].join("\n");
  return [...new Set(lines.split(/\r?\n/).filter(Boolean))];
}

export function loadTestSources(repoRoot) {
  const out = [];
  const walk = (relative) => {
    for (const entry of readdirSync(path.join(repoRoot, relative), { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (VITEST_TEST.test(child) || LEAVE_TEST.test(child)) out.push([child, readFileSync(path.join(repoRoot, child), "utf8")]);
    }
  };
  walk("tests");
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const filesFlag = args.indexOf("--files");
  const changed = filesFlag >= 0 ? args.slice(filesFlag + 1) : changedFilesSince(args[0] || "origin/master");
  const root = process.cwd();
  const identityFiles = canonicalFrontendIdentityFiles(root).map((file) => path.relative(root, file).replaceAll("\\", "/"));
  const { tests, leaveTests, commands } = selectAffectedTests(changed, loadTestSources(root), identityFiles);
  for (const [test, reasons] of [...tests, ...leaveTests]) console.log(`${test}\t${[...reasons].join(" · ")}`);
  for (const command of commands) console.log(`# ${command}`);
  console.error(`바뀐 파일 ${changed.length} → vitest ${tests.length} · leave ${leaveTests.length}`);
}
