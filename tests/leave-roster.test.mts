/**
 * 세션 직원 명부 — 저장 범위와 병합 규칙.
 *
 * 왜 테스트하나: 이 모듈은 **사람 이름과 입사일**을 다룬다. 저장 범위가 넓어지거나
 * (localStorage 로 새면 탭을 닫아도 남는다) 서버로 나가는 코드가 붙으면
 * 고객사 직원정보가 의도 밖으로 퍼진다. 그걸 소스 수준에서 막는다.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ── sessionStorage 를 흉내낸다 (node 에는 없다)
const store = new Map<string, string>();
const events: string[] = [];
(globalThis as Record<string, unknown>).window = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  dispatchEvent: (e: { type: string }) => void events.push(e.type),
};
(globalThis as Record<string, unknown>).Event = class {
  type: string;
  constructor(t: string) { this.type = t; }
};

const { loadRoster, mergeRoster, clearRoster, ROSTER_CHANGED } = await import(
  "../lib/leave-roster.ts"
);

let fail = 0;
function ck(name: string, fn: () => void) {
  store.clear();
  events.length = 0;
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    fail += 1;
    console.error(`  ❌ ${name}: ${e instanceof Error ? e.message : e}`);
  }
}

ck("빈 세션에서는 빈 배열", () => {
  assert.deepEqual(loadRoster(), []);
});

ck("넣은 직원을 다시 읽는다", () => {
  mergeRoster([{ name: "홍길동", hireDate: "2019-03-02", recordedDays: 18 }]);
  const r = loadRoster();
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "홍길동");
  assert.equal(r[0].hireDate, "2019-03-02");
});

ck("이름+입사일이 같으면 한 사람 — 뒤에 온 것이 이긴다", () => {
  mergeRoster([{ name: "홍길동", hireDate: "2019-03-02", recordedDays: 18 }]);
  mergeRoster([{ name: "홍길동", hireDate: "2019-03-02", recordedDays: 20 }]);
  const r = loadRoster();
  assert.equal(r.length, 1, "중복으로 쌓이면 안 된다");
  assert.equal(r[0].recordedDays, 20, "최근 업로드 값이 남아야 한다");
});

ck("동명이인은 입사일이 다르면 따로 남는다", () => {
  mergeRoster([
    { name: "김영희", hireDate: "2019-03-02", recordedDays: null },
    { name: "김영희", hireDate: "2024-01-08", recordedDays: null },
  ]);
  assert.equal(loadRoster().length, 2);
});

ck("여러 화면에서 올린 것이 합쳐진다", () => {
  mergeRoster([{ name: "A", hireDate: "2020-01-01", recordedDays: null }]);
  mergeRoster([{ name: "B", hireDate: "2021-01-01", recordedDays: null }]);
  assert.deepEqual(loadRoster().map((m) => m.name).sort(), ["A", "B"]);
});

ck("형식이 깨진 것은 버린다 — 입사일이 날짜가 아니면 넣지 않는다", () => {
  // @ts-expect-error 의도적으로 잘못된 입력
  mergeRoster([{ name: "X", hireDate: "몰라요", recordedDays: null }, { name: 1, hireDate: "2020-01-01" }]);
  assert.deepEqual(loadRoster(), [], "검증을 통과한 것만 저장돼야 한다");
});

ck("저장된 값이 손상돼 있어도 터지지 않는다", () => {
  store.set("safeclaw.leave.roster.v1", "{{깨진 JSON");
  assert.deepEqual(loadRoster(), []);
});

ck("지우면 사라진다", () => {
  mergeRoster([{ name: "홍길동", hireDate: "2019-03-02", recordedDays: 18 }]);
  clearRoster();
  assert.deepEqual(loadRoster(), []);
});

ck("바뀔 때 같은 탭에 알린다 (storage 이벤트는 같은 탭에 안 온다)", () => {
  mergeRoster([{ name: "홍길동", hireDate: "2019-03-02", recordedDays: 18 }]);
  clearRoster();
  assert.deepEqual(events, [ROSTER_CHANGED, ROSTER_CHANGED]);
});

// ── 개인정보 범위 가드 — 소스를 직접 본다
ck("명부는 sessionStorage 만 쓴다 (localStorage 금지)", () => {
  const src = readFileSync(new URL("../lib/leave-roster.ts", import.meta.url), "utf-8");
  const code = src
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("//") && !l.trimStart().startsWith("/*"))
    .join("\n");
  assert.ok(!code.includes("localStorage"), "localStorage 를 쓰면 탭을 닫아도 직원정보가 남는다");
  assert.ok(code.includes("sessionStorage"), "sessionStorage 를 써야 한다");
});

ck("명부 모듈에 서버 전송 코드가 없다", () => {
  const src = readFileSync(new URL("../lib/leave-roster.ts", import.meta.url), "utf-8");
  for (const banned of ["fetch(", "XMLHttpRequest", "navigator.sendBeacon", "WebSocket"]) {
    assert.ok(!src.includes(banned), `${banned} — 직원정보를 밖으로 보내는 경로가 생겼다`);
  }
});

if (fail) { console.error(`\nleave-roster: 실패 ${fail}건`); process.exit(1); }
console.log("leave-roster: 11건 통과 (병합·중복·손상내구성 + 개인정보 범위 가드)");
