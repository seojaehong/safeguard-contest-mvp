#!/usr/bin/env node
// 바뀐 파일로 PR 전에 돌릴 시험을 고른다(/correct 261027).
// 「바뀐 모듈을 import 하는 시험 grep」만으로는 CSS 전체를 읽는 계약 시험과
// 브라우저로 `/` 를 렌더하는 시험을 못 잡아 #121 에서 CI 18분을 버렸다.
// 사용: node scripts/affected_tests.mjs [base=origin/master]  → 시험 경로 목록 + 감사 명령
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANDING_FILES = new Set(["app/page.tsx", "app/layout.tsx", "components/SafeClawLanding.tsx"]);
const IDENTITY_HINT = /^(app\/globals\.css|lib\/frontend-design-contract\.ts|scripts\/frontend_[\w-]+\.mjs|package\.json|next\.config\.mjs)$/;
const LANDING_GOTO = /goto\(\s*`\$\{\w+\}\/`/;

function stem(file) {
  return file.replace(/\.(d\.)?(m|c)?(ts|tsx|js|jsx)$/, "");
}

export function selectAffectedTests(changedFiles, testSources) {
  const picked = new Map();
  const add = (test, reason) => {
    if (!picked.has(test)) picked.set(test, new Set());
    picked.get(test).add(reason);
  };
  const cssChanged = changedFiles.some((file) => file.endsWith(".css"));
  const landingChanged = cssChanged || changedFiles.some((file) => LANDING_FILES.has(file));
  for (const [test, source] of testSources) {
    if (changedFiles.includes(test)) add(test, "바뀐 시험");
    for (const file of changedFiles) {
      if (file.startsWith("tests/") || file.startsWith("evaluation/")) continue;
      const needle = file.endsWith(".css") ? file : stem(file);
      if (source.includes(needle)) add(test, `경로 언급 ${file}`);
    }
    if (cssChanged && source.includes("globals.css")) add(test, "CSS 변경 → globals.css 를 읽는 시험");
    if (landingChanged && source.includes("isolated-next-browser-harness") && LANDING_GOTO.test(source)) {
      add(test, "첫 화면 변경 → `/` 를 여는 브라우저 시험");
    }
  }
  const commands = changedFiles.some((file) => IDENTITY_HINT.test(file))
    ? ["npm.cmd run -s audit:frontend-consistency  (화면 지문 identity 파일이 바뀜 → static-audit.json 재생성·커밋)"]
    : [];
  return { tests: [...picked].sort(([a], [b]) => a.localeCompare(b)), commands };
}

function changedFilesSince(base) {
  const committed = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  const working = execFileSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" });
  return [...new Set(`${committed}\n${working}`.split(/\r?\n/).filter(Boolean))];
}

function loadTestSources(repoRoot) {
  const dir = path.join(repoRoot, "tests");
  return readdirSync(dir)
    .filter((name) => /\.test\.(ts|tsx|mts|mjs)$/.test(name))
    .map((name) => [`tests/${name}`, readFileSync(path.join(dir, name), "utf8")]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const filesFlag = args.indexOf("--files");
  const changed = filesFlag >= 0 ? args.slice(filesFlag + 1) : changedFilesSince(args[0] || "origin/master");
  const { tests, commands } = selectAffectedTests(changed, loadTestSources(process.cwd()));
  for (const [test, reasons] of tests) console.log(`${test}\t${[...reasons].join(" · ")}`);
  for (const command of commands) console.log(`# ${command}`);
  console.error(`바뀐 파일 ${changed.length} → 시험 ${tests.length}`);
}
