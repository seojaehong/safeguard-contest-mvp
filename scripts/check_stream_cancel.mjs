#!/usr/bin/env node
// 반복 실수 막기(/correct, 261027): abort 리스너 등에서 기다리지 않고 부르는
// `void x.cancel(...)` 는 반드시 `.catch(() => undefined)` 로 끝나야 한다.
// 실제 fetch 가 abort 되면 본문 스트림이 먼저 errored 가 되어 cancel 이 거부되고,
// 받는 곳이 없으면 unhandledRejection 이 된다. 33e01cdd 는 처음부터 catch 를 붙였고
// 같은 모양의 두 곳(safety-reference-catalog·remote-hermes-runtime)은 빠져 있었다(#124).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOTS = ["app", "components", "lib", "scripts", "cli"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs", ".cjs", ".js"]);
const VOID_CANCEL = /\bvoid\s+[\w$.?\]\[()]*?\.cancel\s*\(/g;

export function findUncaughtVoidCancels(source) {
  const hits = [];
  for (const match of source.matchAll(VOID_CANCEL)) {
    const end = source.indexOf(";", match.index);
    const statement = source.slice(match.index, end === -1 ? undefined : end);
    if (/\.catch\s*\(/.test(statement)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    hits.push({ line, text: statement.trim() });
  }
  return hits;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

export function scanRepo(repoRoot) {
  const files = ROOTS.flatMap((root) => {
    const dir = path.join(repoRoot, root);
    try { return walk(dir, []); } catch { return []; }
  });
  return files.flatMap((file) =>
    findUncaughtVoidCancels(readFileSync(file, "utf8")).map((hit) => ({
      file: path.relative(repoRoot, file).replaceAll("\\", "/"),
      ...hit,
    })),
  );
}

export function formatHit(hit) {
  return `${hit.file}:${hit.line} ${hit.text}\n  → 기다리지 않는 cancel 은 \`.catch(() => undefined)\` 로 끝낸다(lib/mcp-work-budget.ts 의 abortRead 참고).`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  const hits = targets.length
    ? targets.flatMap((file) => findUncaughtVoidCancels(readFileSync(file, "utf8")).map((hit) => ({ file, ...hit })))
    : scanRepo(process.cwd());
  for (const hit of hits) console.error(formatHit(hit));
  console.log(hits.length ? `FAIL ${hits.length}` : "OK 0");
  process.exit(hits.length ? 1 : 0);
}
