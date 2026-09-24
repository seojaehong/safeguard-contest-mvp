/**
 * 이용 통계 — **개인정보가 들어갈 수 없는지**를 소스 수준에서 고정한다.
 *
 * 이 도구는 「파일이 서버로 가지 않습니다」를 약속한다. 계측을 붙이는 순간
 * 그 약속이 거짓이 될 수 있는 경로가 생긴다. 그래서 「보내지 않는다」를
 * 주석이 아니라 테스트로 붙든다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { LEAVE_EVENTS, LEAVE_EXPORT_KINDS } from "../lib/leave-analytics.ts";

let fail = 0;
function ck(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); }
  catch (e) { fail += 1; console.error(`  ❌ ${name}: ${e instanceof Error ? e.message : e}`); }
}

const src = readFileSync(new URL("../lib/leave-analytics.ts", import.meta.url), "utf-8");
const code = src
  .split("\n")
  .filter((l) => {
    const t = l.trimStart();
    return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
  })
  .join("\n");

ck("이벤트 이름이 화이트리스트로 고정돼 있다", () => {
  assert.ok(LEAVE_EVENTS.length > 0);
  assert.ok(LEAVE_EVENTS.every((e) => /^leave_[a-z_]+$/.test(e)), `이름 규칙 위반: ${LEAVE_EVENTS.join()}`);
});

ck("꼬리표 값도 화이트리스트다", () => {
  assert.deepEqual([...LEAVE_EXPORT_KINDS].sort(), ["copy", "print", "template", "xlsx"]);
});

ck("개인정보로 쓰일 수 있는 이름이 코드에 없다", () => {
  for (const banned of ["name", "hireDate", "fileName", "file.name", "email", "phone", "text", "rows", "grid", "roster"]) {
    assert.ok(!code.includes(banned), `속성 이름에 ${banned} 가 들어 있다`);
  }
});

ck("행 수·인원 수를 보내지 않는다 (사업장 규모는 식별에 가까워진다)", () => {
  for (const banned of ["length", "count", "size"]) {
    assert.ok(!code.includes(banned), `${banned} — 수량이 나갈 수 있다`);
  }
});

ck("이벤트 이름을 임의 문자열로 받지 않는다", () => {
  assert.ok(code.includes("LEAVE_EVENTS.includes(event)"), "런타임 화이트리스트 검사가 있어야 한다");
  assert.ok(code.includes("LEAVE_EXPORT_KINDS.includes"), "꼬리표도 런타임 검사가 있어야 한다");
});

ck("호출부가 입력값에서 온 값을 꼬리표로 넘기지 않는다", () => {
  for (const f of ["components/leave/LeaveInput.tsx", "components/leave/SettlementInput.tsx"]) {
    const c = readFileSync(new URL(`../${f}`, import.meta.url), "utf-8");
    const calls = c.match(/trackLeave\([^)]*\)/g) ?? [];
    for (const call of calls) {
      // 허용: trackLeave("leave_x")  /  trackLeave("leave_export", { kind: "xlsx" })
      const ok = /^trackLeave\("leave_[a-z_]+"(, \{ kind: "(xlsx|copy|print|template)" \})?\)$/.test(call);
      assert.ok(ok, `${f} — 허용되지 않은 호출 형태: ${call}`);
    }
    assert.ok(calls.length > 0, `${f} 에 호출이 없다`);
  }
});

ck("화면이 무엇을 집계하는지 밝힌다", () => {
  const c = readFileSync(new URL("../components/leave/LeaveInput.tsx", import.meta.url), "utf-8");
  assert.ok(c.includes("집계에 포함되지 않습니다"), "「아무것도 안 보낸다」로 두면 사실과 다르다");
});

if (fail) { console.error(`\nleave-analytics: 실패 ${fail}건`); process.exit(1); }
console.log("leave-analytics: 7건 통과 (이벤트·꼬리표 화이트리스트 + 개인정보 차단 가드)");
