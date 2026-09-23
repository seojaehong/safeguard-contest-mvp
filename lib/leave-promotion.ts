/**
 * 연차 사용 촉진 — **일정 계산 보조**. 적법성은 판정하지 않는다.
 *
 * 근로기준법 제61조는 **두 절차를 구분한다.**
 *   ① 제61조 제1항 — 1년 이상 발생한 연차(15일+)
 *        사용기간 끝 6개월 전 기준 10일 이내: 미사용일수 통지 + 사용시기 지정 요구
 *        근로자가 10일 이내 미통보 → 사용기간 끝 2개월 전까지 사용자가 시기 지정 통보
 *   ② 제61조 제2항 — 계속근로 1년 미만자의 월단위 연차
 *        기간이 다르다. **①의 6개월·2개월을 그대로 쓰면 안 된다.**
 *
 * 🔒 제우스 출시 게이트 (2026-09-23) — 아래를 하면 출시 차단
 *   · 1년 미만 발생분에 일반 6개월·2개월 규칙 적용 → 별도 분기 없으면 「지원 범위 밖」
 *   · 사용기간 종료일·대상 유형이 불명확한데 확정 일정 출력
 *   · 근로자 응답기한을 촉구 「수령일」이 아니라 발송일로 계산
 *   · 1차 촉구를 마감일 하나만 표시 (허용 기간의 시작·끝을 함께)
 *   · 기록 없음 → 미실시, 날짜 일치 → 적법·촉진 완료·수당 면제로 전환
 *   · 정산일수 차감에 연결
 *   허용 등급은 **「일정 대조: 일치」까지**. 「촉진: 일치」는 쓰지 않는다.
 */

export type LeaveKind = "annual-15plus" | "monthly-under-1year";

export interface PromotionScheduleInput {
  /** 그 연차의 사용기간 종료일 (예: 회계연도 운영이면 12-31) */
  usagePeriodEnd: string;
  /** 어떤 연차인가 — 1년 미만 월단위는 기간이 다르다 */
  kind: LeaveKind;
  /** 1차 촉구를 실제로 보낸 날 (있으면 대조한다) */
  firstNoticeSentOn?: string;
  /** 근로자가 1차 촉구를 **받은** 날 — 응답기한은 수령일 기준이다 */
  firstNoticeReceivedOn?: string;
  /** 근로자가 사용시기를 통보한 날 */
  workerRepliedOn?: string;
  /** 사용자가 2차(시기 지정) 통보를 보낸 날 */
  secondNoticeSentOn?: string;
}

export type ScheduleStatus = "match" | "diff" | "unknown" | "out-of-scope";

export interface ScheduleWindow {
  label: string;
  /** 허용 기간 시작 — 제우스 요구: 마감일만 보여주지 않는다 */
  from: string | null;
  /** 허용 기간 끝 */
  to: string | null;
  /** 실제로 한 날 (입력이 있으면) */
  actual?: string;
  status: ScheduleStatus;
  note: string;
}

export interface PromotionScheduleResult {
  kind: LeaveKind;
  usagePeriodEnd: string;
  windows: ScheduleWindow[];
  /** 전체 대조 결과 — 「일정 대조」에 한정된 판정이다 */
  overall: ScheduleStatus;
  /** 화면에 반드시 붙는 한계 고지 */
  disclaimer: string;
}

const DISCLAIMER =
  "입력한 사용기간 종료일과 대상 유형을 전제로 계산한 일정입니다. 서면·도달·실제 사용 보장 등 적법성은 확인하지 않았습니다.";

function parse(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t;
}
function addMonths(d: Date, n: number): Date {
  const t = new Date(d);
  const day = t.getUTCDate();
  t.setUTCDate(1);
  t.setUTCMonth(t.getUTCMonth() + n);
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t;
}

/**
 * 촉진 일정 계산.
 *
 * ⚠️ `kind === "monthly-under-1year"` 는 **지원 범위 밖**으로 반환한다.
 *    §61②의 기간이 ①과 다른데 별도 분기를 구현하지 않았기 때문이다.
 *    추정해서 날짜를 내는 것보다 안 내는 쪽이 안전하다(제우스 게이트).
 */
export function buildPromotionSchedule(
  input: PromotionScheduleInput
): PromotionScheduleResult {
  const { usagePeriodEnd, kind } = input;

  if (!usagePeriodEnd) {
    return {
      kind,
      usagePeriodEnd,
      windows: [],
      overall: "unknown",
      disclaimer: DISCLAIMER,
    };
  }

  if (kind === "monthly-under-1year") {
    return {
      kind,
      usagePeriodEnd,
      windows: [
        {
          label: "1년 미만 월단위 연차",
          from: null,
          to: null,
          status: "out-of-scope",
          note: "근기법 제61조 제2항은 제1항과 기간이 다릅니다. 이 도구는 아직 그 분기를 구현하지 않아 일정을 내지 않습니다.",
        },
      ],
      overall: "out-of-scope",
      disclaimer: DISCLAIMER,
    };
  }

  const end = parse(usagePeriodEnd);
  const windows: ScheduleWindow[] = [];

  // ① 1차 촉구 — 「6개월 전 기준 10일 이내」. 시작과 끝을 함께 낸다
  const sixMonthsBefore = addMonths(end, -6);
  const firstFrom = sixMonthsBefore;
  const firstTo = addDays(sixMonthsBefore, 10);
  const sent = input.firstNoticeSentOn;
  windows.push({
    label: "1차 촉구 (미사용일수 통지 + 사용시기 지정 요구)",
    from: fmt(firstFrom),
    to: fmt(firstTo),
    actual: sent,
    status: !sent
      ? "unknown"
      : parse(sent) >= firstFrom && parse(sent) <= firstTo
        ? "match"
        : "diff",
    note: !sent
      ? "보낸 기록이 입력되지 않았습니다. 기록이 없다고 해서 미실시로 보지 않습니다."
      : "허용 기간 안에 보냈는지만 봅니다. 서면 여부·도달 여부는 확인하지 않습니다.",
  });

  // ② 근로자 응답기한 — **수령일** 기준 10일
  const received = input.firstNoticeReceivedOn;
  if (received) {
    const replyDue = addDays(parse(received), 10);
    const replied = input.workerRepliedOn;
    windows.push({
      label: "근로자 사용시기 통보 기한 (수령일 +10일)",
      from: received,
      to: fmt(replyDue),
      actual: replied,
      status: !replied
        ? "unknown"
        : parse(replied) <= replyDue
          ? "match"
          : "diff",
      note: "촉구를 **받은 날**부터 셉니다. 발송일로 계산하지 않습니다.",
    });
  } else {
    windows.push({
      label: "근로자 사용시기 통보 기한",
      from: null,
      to: null,
      status: "unknown",
      note: "촉구 수령일이 없어 기한을 낼 수 없습니다. 발송일로 대체하지 않습니다.",
    });
  }

  // ③ 2차 통보 — 사용기간 끝 2개월 전까지
  const secondTo = addMonths(end, -2);
  const second = input.secondNoticeSentOn;
  const workerReplied = Boolean(input.workerRepliedOn);
  windows.push({
    label: "2차 통보 (사용자의 사용시기 지정)",
    from: null,
    to: fmt(secondTo),
    actual: second,
    status: !second
      ? "unknown"
      : parse(second) <= secondTo
        ? "match"
        : "diff",
    note: workerReplied
      ? "근로자가 사용시기를 통보한 기록이 있습니다. 2차 통보 필요 여부는 사안에 따라 다르므로 판단하지 않습니다."
      : "근로자 미통보 여부가 확인되지 않으면 2차 통보 필요 여부도 단정하지 않습니다.",
  });

  const statuses = windows.map((w) => w.status);
  const overall: ScheduleStatus = statuses.includes("diff")
    ? "diff"
    : statuses.includes("unknown")
      ? "unknown"
      : "match";

  return { kind, usagePeriodEnd, windows, overall, disclaimer: DISCLAIMER };
}

/** 화면 라벨 — 「촉진: 일치」가 아니라 「일정 대조: 일치」다 */
export function scheduleStatusLabel(s: ScheduleStatus): string {
  if (s === "match") return "일정 대조: 일치";
  if (s === "diff") return "일정 대조: 차이";
  if (s === "out-of-scope") return "지원 범위 밖";
  return "확인 불가";
}
