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

const { loadRoster, setRoster, clearRoster, rosterKey, ROSTER_CHANGED } = await import(
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
  setRoster([{ name: "홍길동", hireDate: "2019-03-02" }]);
  const r = loadRoster();
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "홍길동");
  assert.equal(r[0].hireDate, "2019-03-02");
});

ck("한 번에 같은 사람이 두 줄 들어오면 하나로 합친다", () => {
  setRoster([
    { name: "홍길동", hireDate: "2019-03-02" },
    { name: "홍길동", hireDate: "2019-03-02" },
  ]);
  assert.equal(loadRoster().length, 1, "중복으로 쌓이면 안 된다");
});

ck("동명이인은 입사일이 다르면 따로 남는다", () => {
  setRoster([
    { name: "김영희", hireDate: "2019-03-02" },
    { name: "김영희", hireDate: "2024-01-08" },
  ]);
  assert.equal(loadRoster().length, 2);
});

// ★ 이것이 이 모듈의 핵심 규칙이다. 합치기로 만들면 드롭다운이 쓰레기로 찬다.
ck("쓰기는 덮어쓰기다 — 앞의 목록이 남지 않는다", () => {
  setRoster([{ name: "A", hireDate: "2020-01-01" }]);
  setRoster([{ name: "B", hireDate: "2021-01-01" }]);
  assert.deepEqual(loadRoster().map((m) => m.name), ["B"], "A 가 남으면 합치기가 된 것이다");
});

ck("타이핑 중간 상태가 쌓이지 않는다 (홍 → 홍길 → 홍길동)", () => {
  // 입력창은 글자 하나 칠 때마다 다시 파싱돼 명부에 쓰인다.
  for (const name of ["홍", "홍길", "홍길동"]) {
    setRoster([{ name, hireDate: "2019-03-02" }]);
  }
  const r = loadRoster();
  assert.equal(r.length, 1, `중간 상태가 남았다: ${r.map(rosterKey).join(" / ")}`);
  assert.equal(r[0].name, "홍길동");
});

ck("날짜 오타를 고치면 틀린 것이 남지 않는다", () => {
  setRoster([{ name: "홍길동", hireDate: "2019-03-20" }]); // 오타
  setRoster([{ name: "홍길동", hireDate: "2019-03-02" }]); // 수정
  const r = loadRoster();
  assert.equal(r.length, 1);
  assert.equal(r[0].hireDate, "2019-03-02");
});

ck("줄을 지우면 명부에서도 빠진다", () => {
  setRoster([
    { name: "A", hireDate: "2020-01-01" },
    { name: "B", hireDate: "2021-01-01" },
  ]);
  setRoster([{ name: "A", hireDate: "2020-01-01" }]); // B 줄 삭제
  assert.deepEqual(loadRoster().map((m) => m.name), ["A"]);
});

ck("빈 목록을 넘기면 명부를 비운다", () => {
  setRoster([{ name: "A", hireDate: "2020-01-01" }]);
  setRoster([]);
  assert.deepEqual(loadRoster(), []);
});

ck("형식이 깨진 것은 버린다 — 입사일이 날짜가 아니거나 이름이 비면 넣지 않는다", () => {
  setRoster([
    { name: "X", hireDate: "몰라요" },
    // @ts-expect-error 의도적으로 잘못된 입력
    { name: 1, hireDate: "2020-01-01" },
    { name: "  ", hireDate: "2020-01-01" },
  ]);
  assert.deepEqual(loadRoster(), [], "검증을 통과한 것만 저장돼야 한다");
});

ck("저장된 값이 손상돼 있어도 터지지 않는다", () => {
  store.set("safeclaw.leave.roster.v1", "{{깨진 JSON");
  assert.deepEqual(loadRoster(), []);
});

ck("지우면 사라진다", () => {
  setRoster([{ name: "홍길동", hireDate: "2019-03-02" }]);
  clearRoster();
  assert.deepEqual(loadRoster(), []);
});

ck("바뀔 때 같은 탭에 알린다 (storage 이벤트는 같은 탭에 안 온다)", () => {
  setRoster([{ name: "홍길동", hireDate: "2019-03-02" }]);
  clearRoster();
  assert.deepEqual(events, [ROSTER_CHANGED, ROSTER_CHANGED]);
});

// ── 개인정보 최소화 — 안 쓰는 개인별 값을 들고 있지 않는다
ck("이름과 입사일만 저장한다 (대장 일수는 담지 않는다)", () => {
  setRoster([
    // @ts-expect-error 호출부가 더 넣어도 저장되면 안 된다
    { name: "홍길동", hireDate: "2019-03-02", recordedDays: 18, 주민번호: "900101-1234567" },
  ]);
  assert.deepEqual(Object.keys(loadRoster()[0]).sort(), ["hireDate", "name"]);
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
console.log("leave-roster: 16건 통과 (덮어쓰기·중복·손상내구성 + 개인정보 범위·최소화 가드)");
