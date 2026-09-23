/**
 * 연차 원장·퇴직정산 검증 — 고용노동부 행정해석 실사례로 고정한다.
 *
 * 출처: 근로기준과-5802 (2009-12-31) "퇴직근로자의 연차유급휴가 미사용수당 정산방법"
 *   사례: 입사 2004-08-01 · 퇴사 2009-09-30 · 재직 중 결근 없음
 *   해석이 제시한 값: 입사일 기준 총 79일 (15+15+16+16+17)
 *                    퇴직일이 2009-07-30 이었다면 입사일기준 62일 / 회계연도기준 69일
 *
 * 이 숫자는 우리가 만든 게 아니라 행정해석 본문에 적힌 값이다.
 * 구현을 고쳐 숫자를 맞추지 말 것 — 틀리면 어느 쪽이 맞는지 먼저 정한다.
 *
 * 실행: node --experimental-strip-types tests/leave-ledger.crosscheck.mts
 */
import assert from "node:assert/strict";
import { buildHireDateLedger, settleOnTermination } from "../lib/leave-ledger.ts";

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
  } catch (e) {
    failures += 1;
    console.error(`  ❌ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}

// 1) 행정해석 본문 값 — 입사일 기준 누계 79일
check("근로기준과-5802 · 입사일 기준 누계 79일", () => {
  const r = buildHireDateLedger("2004-08-01", "2009-09-30");
  assert.equal(r.total, 79, `기대 79, 실제 ${r.total}`);
  assert.deepEqual(
    r.entries.map((e) => e.days),
    [15, 15, 16, 16, 17],
    "연도별 발생일수가 해석의 15+15+16+16+17 과 달라졌다"
  );
});

// 2) 같은 해석의 후단 — 퇴직일이 2009-07-30 이면 입사일 기준 62일
check("근로기준과-5802 후단 · 2009-07-30 퇴직 시 62일", () => {
  const r = buildHireDateLedger("2004-08-01", "2009-07-30");
  assert.equal(r.total, 62, `기대 62, 실제 ${r.total}`);
});

// 3) 회계연도가 더 유리한 경우 — 그대로 둔다(정산 대상 아님)
check("회계연도 69일 > 입사일 62일 → 회계연도 기준 유지", () => {
  const s = settleOnTermination({
    hireDate: "2004-08-01",
    endDate: "2009-07-30",
    fiscalGrantedTotal: 69,
    usedOrPaidTotal: 69,
  });
  assert.equal(s.hireDateTotal, 62);
  assert.equal(s.guaranteedTotal, 69, "유리한 쪽(회계연도 69)이 보장선이어야 한다");
  assert.equal(s.favourable, "fiscal-year");
  assert.equal(s.verdict, "no-shortfall");
});

// 4) 입사일 기준이 더 많으면 차액을 정산한다
check("입사일 79일 > 회계연도 69일 → 차액 정산", () => {
  const s = settleOnTermination({
    hireDate: "2004-08-01",
    endDate: "2009-09-30",
    fiscalGrantedTotal: 69,
    usedOrPaidTotal: 53, // 해석 사례의 "사용하거나 수당으로 지급받은 총 53일"
  });
  assert.equal(s.hireDateTotal, 79);
  assert.equal(s.guaranteedTotal, 79);
  assert.equal(s.favourable, "hire-date");
  assert.equal(s.shortfallDays, 26, `해석 질의의 79-53=26 과 달라졌다: ${s.shortfallDays}`);
  assert.equal(s.verdict, "shortfall");
});

// 5) 1년 미만 월차는 기본적으로 연차 누계에 섞지 않는다
//    ※ 2026-03-01 ~ 2026-09-30 은 **6개월** 완료다(3/1→9/1). 7개월은 10/1 이 되어야 한다.
//      처음에 7로 적었다가 엔진이 6을 내서 확인했고, 엔진이 맞아 기대값을 고쳤다.
//      위 1~4번은 행정해석 본문의 숫자라 고치면 안 되지만, 이 케이스는 내가 만든 것이다.
check("1년 미만 월차는 별도 — 기본 누계에 미포함", () => {
  const r = buildHireDateLedger("2026-03-01", "2026-09-30");
  assert.equal(r.total, 0, "만 1년 전이라 기념일 발생분이 없어야 한다");
  const withMonthly = buildHireDateLedger("2026-03-01", "2026-09-30", {
    includeFirstYearMonthly: true,
  });
  assert.equal(withMonthly.total, 6, `기대 6(3/1~9/1 = 6개월), 실제 ${withMonthly.total}`);
});

if (failures) {
  console.error(`\nleave-ledger.crosscheck: 실패 ${failures}건`);
  process.exit(1);
}
console.log("leave-ledger.crosscheck: 5건 통과 (근로기준과-5802 실사례 79일·62일·26일 포함)");
