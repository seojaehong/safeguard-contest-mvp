/**
 * 출시 게이트 — 제우스가 정한 차단 기준을 테스트로 고정한다 (2026-09-23).
 *
 * 이 테스트가 깨지면 "기능이 안 된다"가 아니라 **"넘으면 안 되는 선을 넘었다"**는 뜻이다.
 * 고칠 때는 구현을 되돌린다. 테스트를 완화하지 않는다.
 */
import assert from "node:assert/strict";
import { buildPromotionSchedule, scheduleStatusLabel } from "../lib/leave-promotion.ts";
import { calculateAllowance } from "../lib/leave-allowance.ts";

let fail = 0;
const check = (l: string, fn: () => void) => {
  try { fn(); } catch (e) { fail++; console.error(`  ❌ ${l}: ${e instanceof Error ? e.message : e}`); }
};

// ── A4 연차촉진 ────────────────────────────────────────────────
check("게이트: 1년 미만 월단위에 일반 규칙을 적용하지 않는다", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31",
    kind: "monthly-under-1year",
  });
  assert.equal(r.overall, "out-of-scope", "§61② 는 기간이 달라 범위밖이어야 한다");
  assert.equal(r.windows.every((w) => w.from === null && w.to === null), true,
    "날짜를 내면 안 된다 — 추정 금지");
});

check("게이트: 1차 촉구는 마감일만 주지 않고 시작·끝을 함께 준다", () => {
  const r = buildPromotionSchedule({ usagePeriodEnd: "2026-12-31", kind: "annual-15plus" });
  const first = r.windows[0];
  // 게이트의 핵심은 "마감일 하나만 보여주지 않는다"이다. 두 값이 모두 있는지만 본다.
  assert.ok(first.from && first.to, "허용 기간의 시작과 끝이 모두 있어야 한다");
  assert.ok(first.to! > first.from!, "끝이 시작보다 뒤여야 한다");
  // ⚠️ 「6개월 전」의 정확한 날짜(6-30 인지 7-01 인지)는 역법 계산 해석이 갈린다.
  //    여기서 특정 날짜를 고정하면 우리가 법 해석을 확정하는 셈이라, 폭만 검사한다.
  //    확정 전까지 화면에는 「전제: 역법상 6개월 전」을 함께 표시한다. (재홍님 확인 대상)
  const span =
    (Date.parse(first.to!) - Date.parse(first.from!)) / 86400000;
  assert.equal(span, 10, `허용 폭은 10일이어야 한다: ${span}일`);
});

check("게이트: 응답기한은 수령일 기준이다 (발송일 대체 금지)", () => {
  const withReceipt = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-02", firstNoticeReceivedOn: "2026-07-06",
  });
  const w = withReceipt.windows[1];
  assert.equal(w.to, "2026-07-16", `수령일+10 이어야 한다: ${w.to}`);

  const noReceipt = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-02",
  });
  const w2 = noReceipt.windows[1];
  assert.equal(w2.status, "unknown", "수령일이 없으면 확인 불가여야 한다");
  assert.equal(w2.to, null, "발송일로 기한을 만들면 안 된다");
});

check("게이트: 기록 없음을 미실시로 바꾸지 않는다", () => {
  const r = buildPromotionSchedule({ usagePeriodEnd: "2026-12-31", kind: "annual-15plus" });
  assert.equal(r.windows[0].status, "unknown", "기록이 없으면 unknown 이지 diff 가 아니다");
});

check("게이트: 라벨이 「촉진: 일치」가 아니라 「일정 대조: 일치」다", () => {
  assert.equal(scheduleStatusLabel("match"), "일정 대조: 일치");
  assert.ok(!scheduleStatusLabel("match").includes("촉진"),
    "촉진 자체가 적법하다는 뜻으로 읽히면 안 된다");
});

check("게이트: 적법성·수당면제 판정 필드가 없다", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-02", firstNoticeReceivedOn: "2026-07-02",
    workerRepliedOn: "2026-07-08", secondNoticeSentOn: "2026-10-20",
  });
  // disclaimer 는 "적법성은 확인하지 않았습니다"라는 **부정문**이라 검사에서 뺀다.
  // 금지하려는 것은 "적법하다"고 단정하는 출력이다.
  const { disclaimer, ...rest } = r;
  const payload = JSON.stringify(rest);
  for (const banned of ["lawful", "적법", "수당면제", "exempt", "촉진 완료"]) {
    assert.ok(!payload.includes(banned), `금지 표현이 결과에 있다: ${banned}`);
  }
  assert.ok(disclaimer.includes("적법성은 확인하지 않았습니다"),
    "한계 고지는 반드시 있어야 한다");
});

// ── A5 수당 엔진 ───────────────────────────────────────────────
check("게이트: 통상임금을 산정하지 않는다 — 단가가 없으면 금액을 내지 않는다", () => {
  const r = calculateAllowance({
    unusedDays: 10, dailyRate: NaN,
    rateBasis: "ordinary-wage", rateSource: "",
  });
  assert.equal(r.verdict, "insufficient-input");
  assert.equal(r.amount, null, "단가 없이 금액을 만들면 안 된다");
});

check("게이트: 단가 출처를 남기지 않으면 금액을 내지 않는다", () => {
  const r = calculateAllowance({
    unusedDays: 10, dailyRate: 100000,
    rateBasis: "ordinary-wage", rateSource: "   ",
  });
  assert.equal(r.verdict, "insufficient-input");
  assert.equal(r.amount, null);
});

check("정상 계산 — 산식과 출처가 결과에 남는다", () => {
  const r = calculateAllowance({
    unusedDays: 10, dailyRate: 120000,
    rateBasis: "ordinary-wage", rateSource: "2026-09 급여대장 통상임금",
  });
  assert.equal(r.verdict, "calculated");
  assert.equal(r.amount, 1200000);
  assert.ok(r.formulaNote.includes("통상임금"));
  assert.ok(r.formulaNote.includes("2026-09 급여대장"));
});

check("게이트: 엔진이 시효·촉진으로 일수를 몰래 깎지 않는다", () => {
  const r = calculateAllowance({
    unusedDays: 26, dailyRate: 100000,
    rateBasis: "ordinary-wage", rateSource: "대장",
  });
  assert.equal(r.unusedDays, 26, "입력 일수를 그대로 써야 한다");
  assert.equal(r.amount, 2600000);
});

if (fail) { console.error(`\nleave-guardrails: 실패 ${fail}건 — 출시 막아야 한다`); process.exit(1); }
console.log("leave-guardrails: 10건 통과 (제우스 출시 게이트)");
