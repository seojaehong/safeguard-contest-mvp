/**
 * PR-21 회귀 — 런칭 점검(2026-10-25) LV-1~LV-10 을 고정한다.
 *
 * 각 날짜 결함은 분기의 **양쪽**을 함께 넣는다(경계 안·밖, 수령일 있음·없음).
 * 법정 기간 근거 — 근로기준법 제61조 제1항·제2항(법제처 원문, 2026-10-25 조회).
 */
import assert from "node:assert/strict";
import { buildPromotionSchedule } from "../lib/leave-promotion.ts";
import { compareRow } from "../lib/annual-leave.ts";
import { leaveExportRow, leaveCsv } from "../lib/leave-export.ts";
import { settleOnTermination } from "../lib/leave-ledger.ts";
import { summarizeUsage } from "../lib/leave-usage.ts";
import { normalizeDate, parseLines } from "../lib/leave-sheet.ts";
import { LEAVE_TEMPLATE_SHEETS } from "../lib/leave-template-xlsx.ts";
import { readFileSync, readdirSync } from "node:fs";

let fail = 0;
let pass = 0;
const check = (l: string, fn: () => void) => {
  try { fn(); pass++; } catch (e) { fail++; console.error(`  ❌ ${l}: ${e instanceof Error ? e.message : e}`); }
};

// ── LV-2 1차 촉구 기간 · 2차 통보 기한 — 종료 다음날에서 N개월을 뺀다 ─────
// [종료일, 1차 from, 1차 to, 2차 기한]  (§61① — 6개월 전 기준 10일 이내 / 2개월 전까지)
const annualCases: [string, string, string, string][] = [
  ["2026-12-31", "2026-07-01", "2026-07-10", "2026-10-31"], // 교재 표 그대로
  ["2026-02-28", "2025-09-01", "2025-09-10", "2025-12-31"],
  ["2028-02-29", "2027-09-01", "2027-09-10", "2027-12-31"], // 윤년
  ["2026-06-30", "2026-01-01", "2026-01-10", "2026-04-30"],
  ["2026-04-30", "2025-11-01", "2025-11-10", "2026-02-28"],
  ["2026-03-15", "2025-09-16", "2025-09-25", "2026-01-15"], // 월말 아님 — 종전과 같아야 한다
];
for (const [end, from, to, second] of annualCases) {
  check(`LV-2 §61① 종료 ${end}`, () => {
    const r = buildPromotionSchedule({ usagePeriodEnd: end, kind: "annual-15plus" });
    assert.equal(r.windows[0].from, from, `1차 시작 ${r.windows[0].from}`);
    assert.equal(r.windows[0].to, to, `1차 끝 ${r.windows[0].to}`);
    assert.equal(r.windows[2].to, second, `2차 기한 ${r.windows[2].to}`);
  });
}

check("LV-2 §61① 종료 2/28 — 9/1 발송은 일치, 8/31 발송은 차이 (양쪽)", () => {
  const ok = buildPromotionSchedule({ usagePeriodEnd: "2026-02-28", kind: "annual-15plus", firstNoticeSentOn: "2025-09-01" });
  assert.equal(ok.windows[0].status, "match");
  const early = buildPromotionSchedule({ usagePeriodEnd: "2026-02-28", kind: "annual-15plus", firstNoticeSentOn: "2025-08-31" });
  assert.equal(early.windows[0].status, "diff");
  const last = buildPromotionSchedule({ usagePeriodEnd: "2026-02-28", kind: "annual-15plus", firstNoticeSentOn: "2025-09-10" });
  assert.equal(last.windows[0].status, "match");
  const late = buildPromotionSchedule({ usagePeriodEnd: "2026-02-28", kind: "annual-15plus", firstNoticeSentOn: "2025-09-11" });
  assert.equal(late.windows[0].status, "diff");
});

// [종료일, 9일분 1차 from, to, 9일분 2차, 2일분 1차 from, to, 2일분 2차]  (§61②)
const monthlyCases: [string, string, string, string, string, string, string][] = [
  ["2026-12-31", "2026-10-01", "2026-10-10", "2026-11-30", "2026-12-01", "2026-12-05", "2026-12-21"],
  ["2026-04-30", "2026-02-01", "2026-02-10", "2026-03-31", "2026-04-01", "2026-04-05", "2026-04-20"],
  ["2026-02-28", "2025-12-01", "2025-12-10", "2026-01-31", "2026-02-01", "2026-02-05", "2026-02-18"],
  ["2028-02-29", "2027-12-01", "2027-12-10", "2028-01-31", "2028-02-01", "2028-02-05", "2028-02-19"],
  ["2026-06-30", "2026-04-01", "2026-04-10", "2026-05-31", "2026-06-01", "2026-06-05", "2026-06-20"],
  ["2026-03-15", "2025-12-16", "2025-12-25", "2026-02-15", "2026-02-16", "2026-02-20", "2026-03-05"],
];
for (const [end, f1, t1, s1, f2, t2, s2] of monthlyCases) {
  check(`LV-2 §61② 종료 ${end}`, () => {
    const w = buildPromotionSchedule({ usagePeriodEnd: end, kind: "monthly-under-1year" }).windows;
    assert.deepEqual(
      [w[0].from, w[0].to, w[1].to, w[2].from, w[2].to, w[3].to],
      [f1, t1, s1, f2, t2, s2]
    );
  });
}

// ── LV-3 2차 통보는 근로자 응답기한(수령+10일)이 지난 뒤여야 한다 ────────
check("LV-3 수령 7/1 · 2차 7/2 → 차이", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-01", firstNoticeReceivedOn: "2026-07-01", secondNoticeSentOn: "2026-07-02",
  });
  assert.equal(r.windows[2].from, "2026-07-12", `2차 창 시작 ${r.windows[2].from}`);
  assert.equal(r.windows[2].status, "diff");
  assert.equal(r.overall, "diff");
});
check("LV-3 수령 7/1 · 2차 7/11(응답기한 당일) → 차이, 7/12 → 일치 (양쪽)", () => {
  const base = { usagePeriodEnd: "2026-12-31", kind: "annual-15plus" as const, firstNoticeSentOn: "2026-07-01", firstNoticeReceivedOn: "2026-07-01" };
  assert.equal(buildPromotionSchedule({ ...base, secondNoticeSentOn: "2026-07-11" }).windows[2].status, "diff");
  assert.equal(buildPromotionSchedule({ ...base, secondNoticeSentOn: "2026-07-12" }).windows[2].status, "match");
  assert.equal(buildPromotionSchedule({ ...base, secondNoticeSentOn: "2026-11-01" }).windows[2].status, "diff");
});
check("LV-3 수령일 없음 → 2차는 확인 불가 (기한 안이어도)", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-01", secondNoticeSentOn: "2026-10-20",
  });
  assert.equal(r.windows[2].status, "unknown");
});
check("LV-3 수령일 없음 · 2차가 1차 발송 10일 안 → 차이", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-01", secondNoticeSentOn: "2026-07-05",
  });
  assert.equal(r.windows[2].status, "diff");
});
check("LV-3 근로자가 응답기한 안에 통보했으면 2차는 일치로 두지 않는다", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "annual-15plus",
    firstNoticeSentOn: "2026-07-01", firstNoticeReceivedOn: "2026-07-01",
    workerRepliedOn: "2026-07-05", secondNoticeSentOn: "2026-10-20",
  });
  assert.equal(r.windows[2].status, "unknown");
});
check("LV-3 §61② 9일분 2차 — 수령 10/1 · 2차 10/3 → 차이, 10/12 → 일치", () => {
  const base = { usagePeriodEnd: "2026-12-31", kind: "monthly-under-1year" as const, firstNoticeSentOn: "2026-10-01", firstNoticeReceivedOn: "2026-10-01" };
  assert.equal(buildPromotionSchedule({ ...base, secondNoticeSentOn: "2026-10-03" }).windows[1].status, "diff");
  assert.equal(buildPromotionSchedule({ ...base, secondNoticeSentOn: "2026-10-12" }).windows[1].status, "match");
});
check("LV-3 §61② 2차가 1차보다 먼저(7/2 < 10/5) → 일치가 아니다", () => {
  const r = buildPromotionSchedule({
    usagePeriodEnd: "2026-12-31", kind: "monthly-under-1year",
    firstNoticeSentOn: "2026-10-05", firstNoticeReceivedOn: "2026-07-01", secondNoticeSentOn: "2026-07-02",
  });
  assert.notEqual(r.windows[1].status, "match");
});

// ── LV-1 계산 불가 줄은 CSV·xlsx 에서 「확인 불가」 ───────────────────
check("LV-1 입사일 > 기준일 → 「확인 불가」, NaN 없음", () => {
  const row = { name: "미래", hireDate: "2027-01-01", recordedDays: 3, raw: "" };
  const result = compareRow({ name: "미래", hireDate: "2027-01-01", recordedDays: 3 }, "2026-10-25");
  const cells = leaveExportRow({ row, result });
  assert.equal(cells[5], "확인 불가");
  assert.equal(cells[2], "");
  assert.equal(cells[4], "");
  assert.equal(cells[3], 3, "대장 원문은 그대로");
  assert.ok(String(cells[6]).includes("기준일이 입사일보다 빠릅니다"));
  const csv = leaveCsv([{ row, result }], "2026-10-25");
  assert.ok(!csv.includes("NaN"), csv);
  assert.ok(!csv.split("\r\n")[1].includes("일치"), csv);
});
check("LV-1 정상 줄은 종전대로 일치·차이 (양쪽)", () => {
  const row = { name: "가", hireDate: "2025-10-25", recordedDays: 15, raw: "" };
  const m = leaveExportRow({ row, result: compareRow({ name: "가", hireDate: "2025-10-25", recordedDays: 15 }, "2026-10-25") });
  assert.deepEqual(m.slice(2, 6), [15, 15, 0, "일치"]);
  const d = leaveExportRow({ row: { ...row, recordedDays: 14 }, result: compareRow({ name: "가", hireDate: "2025-10-25", recordedDays: 14 }, "2026-10-25") });
  assert.equal(d[5], "차이 있음");
  const none = leaveExportRow({ row: { ...row, recordedDays: null }, result: compareRow({ name: "가", hireDate: "2025-10-25", recordedDays: 0 }, "2026-10-25") });
  assert.equal(none[5], "대장값 없음");
});

// ── LV-4 입력 누락 사유별 제목 · 미입력 누계는 null ──────────────────
check("LV-4 누계 미입력 → reason missing-totals, 미입력 칸 null", () => {
  const r = settleOnTermination({ hireDate: "2024-01-01", endDate: "2025-06-30" } as never);
  assert.equal(r.verdict, "insufficient-input");
  assert.equal(r.reason, "missing-totals");
  assert.equal(r.fiscalGrantedInput, null);
  assert.equal(r.usedOrPaidInput, null);
});
check("LV-4 월차 포함 미선택 → reason monthly-choice, 입력값은 그대로", () => {
  const r = settleOnTermination({ hireDate: "2024-01-01", endDate: "2025-06-30", fiscalGrantedTotal: 20, usedOrPaidTotal: 5 } as never);
  assert.equal(r.reason, "monthly-choice");
  assert.equal(r.fiscalGrantedInput, 20);
  assert.equal(r.usedOrPaidInput, 5);
});
check("LV-4 규정 미상 → reason recalc-clause, 정상 판정에는 reason 없음", () => {
  const r = settleOnTermination({ hireDate: "2024-07-01", endDate: "2025-06-30", fiscalGrantedTotal: 18.5, usedOrPaidTotal: 0 } as never);
  assert.equal(r.reason, "recalc-clause");
  const ok = settleOnTermination({ hireDate: "2025-01-01", endDate: "2026-01-01", fiscalGrantedTotal: 11, usedOrPaidTotal: 0, includeFirstYearMonthly: true } as never);
  assert.equal(ok.verdict, "shortfall");
  assert.equal(ok.reason, undefined);
});

// ── LV-7 반차 환산 ───────────────────────────────────────────────
const policy = { hoursPerDay: 8, allowHalf: true, allowQuarter: true, allowHourly: true, hourlyIncrement: 1 };
check("LV-7 합계는 정확값을 더한 뒤 한 번만 반올림 (3h×3 + 반차 = 1.625 → 1.63)", () => {
  const r = summarizeUsage([
    { date: "2026-01-05", kind: "hourly", hours: 3 },
    { date: "2026-01-06", kind: "hourly", hours: 3 },
    { date: "2026-01-07", kind: "hourly", hours: 3 },
    { date: "2026-01-08", kind: "half" },
  ], policy);
  assert.equal(r.totalDays, 1.63, `합계 ${r.totalDays}`);
});
check("LV-7 소정근로시간 0·NaN 이면 계산하지 않는다 (8 로 몰래 바꾸지 않음)", () => {
  assert.throws(() => summarizeUsage([{ date: "2026-01-05", kind: "half" }], { ...policy, hoursPerDay: 0 }));
  assert.throws(() => summarizeUsage([{ date: "2026-01-05", kind: "half" }], { ...policy, hoursPerDay: NaN }));
  assert.doesNotThrow(() => summarizeUsage([{ date: "2026-01-05", kind: "half" }], { ...policy, hoursPerDay: 4 }));
});

// ── LV-9 날짜 표기 ───────────────────────────────────────────────
for (const [s, exp] of [
  ["2026. 3. 16", "2026-03-16"],
  ["2026. 3. 16.", "2026-03-16"],
  ["2026년 3월 16일", "2026-03-16"],
  ["2026.03.16.", "2026-03-16"],
  ["46097", "2026-03-16"], // 엑셀 일련번호(1900 기준)
  ["45351", "2024-02-29"],
  ["2026-03-16", "2026-03-16"],
  ["20260316", "2026-03-16"],
  ["2026. 2. 30", null], // 없는 날
  ["123", null], // 일련번호 범위 밖
  ["26-03-16", null], // 두 자리 연도는 받지 않는다
  ["아무말", null],
] as [string, string | null][]) {
  check(`LV-9 normalizeDate ${JSON.stringify(s)}`, () => assert.equal(normalizeDate(s), exp));
}
check("LV-9 붙여넣기 — 일련번호 입사일도 읽는다", () => {
  const rows = parseLines("가상1\t46097\t7");
  assert.equal(rows[0].hireDate, "2026-03-16");
  assert.equal(rows[0].error, undefined);
});

// ── LV-10 · COPY-13 빈 서식 문구 ────────────────────────────────
check("LV-10 빈 서식에 노무법인 위너스·개인 메일·공인노무사 검토 문구가 없다", () => {
  const text = JSON.stringify(LEAVE_TEMPLATE_SHEETS);
  for (const banned of ["위너스", "winhr", "공인노무사"]) assert.ok(!text.includes(banned), banned);
  assert.ok(text.includes("개별 사안은 전문가 검토가 필요합니다"));
});
check("LV-10 연차 도구 화면·xlsx 각주에 노무법인 위너스·개인 메일·공인노무사 검토 문구가 없다", () => {
  const files = [
    ...["app/tools/leave/page.tsx", "app/tools/leave/settlement/page.tsx", "app/tools/leave/advanced/page.tsx", "app/tools/leave/layout.tsx"],
    ...readdirSync("components/leave").map((f) => `components/leave/${f}`),
  ];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const banned of ["위너스", "winhr", "공인노무사"]) assert.ok(!src.includes(banned), `${f}: ${banned}`);
  }
});
check("LV-6 링크 문구가 없는 기능(출근율)을 약속하지 않는다", () => {
  for (const f of ["app/tools/leave/page.tsx", "app/tools/leave/settlement/page.tsx"]) {
    assert.ok(!readFileSync(f, "utf8").includes("반차·출근율·사용촉진"), f);
  }
});

if (fail) {
  console.error(`leave-pr21: ${fail}건 실패 / ${pass}건 통과`);
  process.exit(1);
}
console.log(`leave-pr21: ${pass}건 통과 (촉진 기간·2차 통보·확인 불가 내보내기·정산 사유·환산·날짜 표기·서식 문구)`);
