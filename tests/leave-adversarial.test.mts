/**
 * 적대적 입력 — **내가 의도한 것이 아니라 사용자가 넣을 것**을 넣는다.
 *
 * 왜 따로 두나: 2026-09-23 에 내가 만든 루브릭으로 100점을 받고도
 * 외부 검수에서 치명적 버그 5건이 나왔다. 내가 만든 기준은 내가 의도한 동작만
 * 검증한다. 이 파일은 **내가 의도하지 않은 입력**만 모은다.
 *
 * 규칙: 새 버그를 찾으면 여기에 케이스를 추가하고 나서 고친다.
 */
import assert from "node:assert/strict";
import { calculateEntitlement, compareRow } from "../lib/annual-leave.ts";
import { buildHireDateLedger, settleOnTermination } from "../lib/leave-ledger.ts";

let fail = 0;
const ck = (l: string, fn: () => void) => {
  try { fn(); } catch (e) { fail++; console.error(`  ❌ ${l}: ${e instanceof Error ? e.message : e}`); }
};

// ── 검수에서 나온 것 (2026-09-23) ──
ck("기준일보다 미래 입사 → error (일치로 세면 안 된다)", () => {
  const r = compareRow({ name: "x", hireDate: "2027-01-01", recordedDays: 15 }, "2026-09-23");
  assert.equal(r.verdict, "error");
  assert.ok(Number.isNaN(r.calculatedDays));
});

// ── 내가 스스로 돌려서 찾은 것 ──
ck("음수 누계가 정산을 부풀리지 않는다", () => {
  const r = settleOnTermination({
    hireDate: "2019-01-01", endDate: "2026-09-23",
    fiscalGrantedTotal: -10, usedOrPaidTotal: -5,
  });
  assert.ok(r.shortfallDays <= r.guaranteedTotal,
    `정산(${r.shortfallDays})이 보장선(${r.guaranteedTotal})을 넘었다`);
  assert.ok(r.fiscalGrantedTotal >= 0 && r.usedOrPaidTotal >= 0, "음수가 그대로 남았다");
});

// ── 경계값 ──
ck("입사 당일 = 0일", () => {
  assert.equal(calculateEntitlement({ hireDate: "2026-09-23", asOf: "2026-09-23" }).days, 0);
});

ck("윤년 2/29 입사 — 1년을 마친 다음 날 15일 (대법 2022다245419)", () => {
  // 2024-02-29 ~ 2025-02-28 이 1년. 그 다음 날 3/1 에 15일이 발생한다.
  assert.equal(calculateEntitlement({ hireDate: "2024-02-29", asOf: "2025-02-28" }).serviceYears, 0);
  assert.equal(calculateEntitlement({ hireDate: "2024-02-29", asOf: "2025-03-01" }).days, 15);
});

ck("월말 입사 1/31 — 기념일 판정이 흔들리지 않는다", () => {
  assert.equal(calculateEntitlement({ hireDate: "2024-01-31", asOf: "2025-01-30" }).serviceYears, 0);
  assert.equal(calculateEntitlement({ hireDate: "2024-01-31", asOf: "2025-01-31" }).serviceYears, 1);
});

ck("초장기 근속은 상한 25일", () => {
  assert.equal(calculateEntitlement({ hireDate: "1976-01-01", asOf: "2026-09-23" }).days, 25);
});

ck("원장 안전장치 — 50년이어도 폭주하지 않는다", () => {
  const r = buildHireDateLedger("1976-01-01", "2026-09-23");
  assert.ok(r.entries.length <= 61, `행 ${r.entries.length}`);
});

ck("퇴사가 입사보다 빠르면 예외", () => {
  assert.throws(() =>
    settleOnTermination({ hireDate: "2020-01-01", endDate: "2019-01-01",
      fiscalGrantedTotal: 15, usedOrPaidTotal: 0 }));
});

ck("초과 지급이면 정산 대상이 음수 — 0으로 숨기지 않는다", () => {
  const r = settleOnTermination({
    hireDate: "2019-01-01", endDate: "2026-09-23",
    fiscalGrantedTotal: 100, usedOrPaidTotal: 200, hasRecalcClause: false,
  });
  assert.ok(r.shortfallDays < 0, "이미 더 준 사실이 값에 남아야 한다");
  assert.equal(r.verdict, "no-shortfall");
});

ck("대장값 소수 0.5 단위도 대조된다", () => {
  const r = compareRow({ name: "x", hireDate: "2019-03-02", recordedDays: 17.5 }, "2026-09-23");
  assert.equal(r.verdict, "diff");
  assert.equal(r.diff, -0.5);
});

if (fail) { console.error(`\nleave-adversarial: 실패 ${fail}건`); process.exit(1); }
console.log("leave-adversarial: 10건 통과 (검수 지적 + 자체 발견 + 경계값)");
