#!/usr/bin/env node
// 반복 실수 막기(/correct 261027, interrogate 반영): 기다리지 않는 스트림 cancel 은
// 반드시 `.catch(() => undefined)` 로 끝나야 한다. 실제 fetch 가 abort 되면 본문 스트림이
// 먼저 errored 가 되어 cancel 이 거부되고, 받는 곳이 없으면 unhandledRejection 이 된다.
// 33e01cdd 는 처음부터 catch 를 붙였고 같은 모양의 두 곳(safety-reference-catalog·
// remote-hermes-runtime)은 빠져 있었다(#124).
//
// 정규식이 아니라 TypeScript AST 로 본다. 주석·문자열은 무시하고, `void x.cancel()`,
// 맨 문장 `x.cancel();`, 화살표 본문 `() => x.cancel()` 을 모두 잡는다.
// 대상은 스트림 쪽 이름(reader·stream·body)의 cancel 뿐이다 — 동기 cancel(디바운스 등)은 건드리지 않는다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const SCAN_ROOTS = ["app", "components", "lib", "scripts", "cli", "tests", ".claude/skills"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".mjs", ".cjs", ".js"]);
const STREAM_RECEIVER = /(reader|stream|body)\b/i;

function unwrap(node) {
  let current = node;
  while (
    current.parent
    && (ts.isParenthesizedExpression(current.parent)
      || ts.isNonNullExpression(current.parent)
      || ts.isAsExpression(current.parent)
      || ts.isSatisfiesExpression(current.parent))
  ) {
    current = current.parent;
  }
  return current;
}

// x.cancel(...) 에서 시작해 .then/.catch/.finally 사슬 끝까지 올라간다.
function climbChain(call) {
  let top = call;
  let handled = false;
  for (;;) {
    const wrapped = unwrap(top);
    const access = wrapped.parent;
    if (!access || !ts.isPropertyAccessExpression(access) || access.expression !== wrapped) break;
    const next = access.parent;
    if (!next || !ts.isCallExpression(next) || next.expression !== access) break;
    const method = access.name.text;
    if (method === "catch" || (method === "then" && next.arguments.length >= 2)) handled = true;
    top = next;
  }
  return { top: unwrap(top), handled };
}

function isDropped(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isVoidExpression(parent) || ts.isExpressionStatement(parent)) return true;
  if (ts.isArrowFunction(parent) && parent.body === node) {
    // `.then(() => reader.cancel())` 처럼 바깥 사슬이 받는 경우는 넘긴다.
    const holder = parent.parent;
    if (holder && ts.isCallExpression(holder) && ts.isPropertyAccessExpression(holder.expression)
      && ["then", "catch", "finally"].includes(holder.expression.name.text)) return false;
    return true;
  }
  return false;
}

export function findUncaughtStreamCancels(source, fileName = "input.ts") {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const hits = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "cancel"
      && STREAM_RECEIVER.test(node.expression.expression.getText(sourceFile))
    ) {
      const { top, handled } = climbChain(node);
      if (!handled && isDropped(top)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const statement = ts.isVoidExpression(top.parent) ? top.parent : top;
        hits.push({ line: line + 1, text: statement.getText(sourceFile).replace(/\s+/g, " ") });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

export function scanRepo(repoRoot) {
  const files = SCAN_ROOTS.flatMap((root) => walk(path.join(repoRoot, root), []));
  const hits = files.flatMap((file) =>
    findUncaughtStreamCancels(readFileSync(file, "utf8"), file).map((hit) => ({
      file: path.relative(repoRoot, file).replaceAll("\\", "/"),
      ...hit,
    })),
  );
  return { scannedFiles: files.map((file) => path.relative(repoRoot, file).replaceAll("\\", "/")), hits };
}

export function formatHit(hit) {
  return `${hit.file}:${hit.line} ${hit.text}\n  → 기다리지 않는 스트림 cancel 은 \`.catch(() => undefined)\` 로 끝낸다(lib/mcp-work-budget.ts 의 abortRead 참고).`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  const hits = targets.length
    ? targets.flatMap((file) => findUncaughtStreamCancels(readFileSync(file, "utf8"), file).map((hit) => ({ file, ...hit })))
    : scanRepo(process.cwd()).hits;
  for (const hit of hits) console.error(formatHit(hit));
  console.log(hits.length ? `FAIL ${hits.length}` : "OK 0");
  process.exit(hits.length ? 1 : 0);
}
