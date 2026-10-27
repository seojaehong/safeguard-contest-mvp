#!/usr/bin/env node
// 반복 실수 막기(/correct 261027): 셔뱅 파일의 첫 줄이 CRLF 면 vite 의 hashbangRE 가
// 셔뱅을 못 봐 그 파일을 import 하는 시험이 SyntaxError 로 죽는다(261026·261027).
// .gitattributes 의 eol=lf 는 새로 꺼낸 파일에만 걸린다. 이미 CRLF 로 꺼내 둔 작업본은
// 이 검사가 잡는다. 고치는 법은 오류 문구에 있다.
import { execFileSync } from "node:child_process";
import { openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CODE = /\.(mjs|cjs|js|mts|cts|ts|tsx|sh)$/;

function firstLine(file) {
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(512);
    const bytes = readSync(fd, buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytes).toString("latin1");
    const end = text.indexOf("\n");
    return end === -1 ? text : text.slice(0, end + 1);
  } finally {
    closeSync(fd);
  }
}

export function findCrlfShebangs(repoRoot) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter((file) => CODE.test(file));
  const offenders = [];
  let shebangs = 0;
  for (const file of tracked) {
    let line;
    try {
      line = firstLine(path.join(repoRoot, file));
    } catch {
      continue;
    }
    if (!line.startsWith("#!")) continue;
    shebangs += 1;
    if (line.endsWith("\r\n") || line.endsWith("\r")) offenders.push(file);
  }
  return { shebangs, offenders };
}

export const FIX_HINT = "작업본이 CRLF 다. 위 파일에 커밋 안 한 변경이 없으면 파일을 지우고 git checkout -- <파일> 로 다시 꺼낸다(.gitattributes 가 LF 로 꺼낸다).";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { shebangs, offenders } = findCrlfShebangs(process.argv[2] || process.cwd());
  for (const file of offenders) console.error(`CRLF 셔뱅 ${file}`);
  if (offenders.length) console.error(FIX_HINT);
  console.log(offenders.length ? `FAIL ${offenders.length}/${shebangs}` : `OK 0/${shebangs}`);
  process.exit(offenders.length ? 1 : 0);
}
