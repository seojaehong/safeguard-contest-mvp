"use client";

import { useEffect, useMemo, useState } from "react";

import { settleOnTermination } from "@/lib/leave-ledger";
import { downloadXlsx } from "@/lib/leave-xlsx";
import { todayLocal } from "@/lib/leave-today";
import { StatusBadge } from "@/components/leave/LeaveUI";

/**
 * 퇴직 연차 정산 입력 — **브라우저에서만 계산한다.**
 *
 * 받는 것: 입사일 · 퇴사일 · 회계연도로 부여한 누계 · 사용·지급한 누계
 *          + 취업규칙에 「퇴직 시 입사일 기준 재산정」 규정이 있는지
 *
 * 마지막 항목이 결과를 가른다(최영우 산정 예). 모르면 「확인 필요」로 두고 확정하지 않는다.
 */

type Clause = "unknown" | "yes" | "no";

export function SettlementInput() {
  // 퇴사일 상한(오늘)은 마운트 후에 건다 — SSR 은 UTC 라 KST 오전에 하루 전이 된다.
  const [maxDate, setMaxDate] = useState<string | undefined>(undefined);
  useEffect(() => setMaxDate(todayLocal()), []);
  const [hireDate, setHireDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fiscalGranted, setFiscalGranted] = useState("");
  const [usedOrPaid, setUsedOrPaid] = useState("");
  const [clause, setClause] = useState<Clause>("unknown");

  const ready = hireDate && endDate;

  const result = useMemo(() => {
    if (!ready) return null;
    try {
      return settleOnTermination({
        hireDate,
        endDate,
        fiscalGrantedTotal: Number(fiscalGranted) || 0,
        usedOrPaidTotal: Number(usedOrPaid) || 0,
        hasRecalcClause: clause === "unknown" ? undefined : clause === "yes",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "계산할 수 없습니다" } as const;
    }
  }, [ready, hireDate, endDate, fiscalGranted, usedOrPaid, clause]);

  const hasError = result && "error" in result;
  const r = result && !hasError ? result : null;

  return (
    <section className="lv-input">
      <div className="lv-input__privacy">
        🔒 입력한 내용은 <strong>브라우저 안에서만</strong> 계산됩니다.
      </div>

      <div className="lv-form">
        <label className="lv-input__field">
          <span>입사일</span>
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        </label>
        <label className="lv-input__field">
          <span>퇴사일</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            max={maxDate}
          />
        </label>
        <label className="lv-input__field">
          <span>회계연도로 부여한 누계(일)</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={fiscalGranted}
            onChange={(e) => setFiscalGranted(e.target.value)}
            placeholder="예: 69"
          />
        </label>
        <label className="lv-input__field">
          <span>사용·수당 지급한 누계(일)</span>
          <input
            type="number"
            min={0}
            step="0.5"
            value={usedOrPaid}
            onChange={(e) => setUsedOrPaid(e.target.value)}
            placeholder="예: 53"
          />
        </label>
      </div>

      <fieldset className="lv-clause">
        <legend>취업규칙에 「퇴직 시 입사일 기준으로 재산정한다」는 규정이 있습니까?</legend>
        <div className="lv-clause__opts">
          {(
            [
              ["unknown", "모르겠음 / 확인 필요"],
              ["no", "없음"],
              ["yes", "있음"],
            ] as [Clause, string][]
          ).map(([v, label]) => (
            <label key={v} className={clause === v ? "is-on" : undefined}>
              <input
                type="radio"
                name="clause"
                checked={clause === v}
                onChange={() => setClause(v)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="lv-clause__hint">
          회계연도로 부여한 일수가 입사일 기준보다 <strong>많을 때</strong> 이 규정이 결과를
          가릅니다. 규정이 없으면 부여한 일수를 그대로 두고, 있으면 입사일 기준으로 다시
          계산할 수 있습니다.
        </p>
      </fieldset>

      {!ready && (
        <p className="lv-input__note">입사일과 퇴사일을 넣으면 계산합니다.</p>
      )}

      {hasError && (
        <p className="lv-input__filenote" style={{ color: "var(--accent-warm)" }}>
          {(result as { error: string }).error}
        </p>
      )}

      {r && (
        <>
          <div
            className={`lv-conclusion lv-conclusion--${
              r.verdict === "shortfall"
                ? "action"
                : r.verdict === "insufficient-input"
                  ? "unknown"
                  : "clear"
            }`}
            style={{ marginTop: 16 }}
          >
            <p className="lv-conclusion__headline">
              {r.verdict === "shortfall"
                ? `정산 대상 ${r.shortfallDays}일`
                : r.verdict === "insufficient-input"
                  ? "취업규칙 확인이 필요합니다"
                  : "정산 대상이 없습니다"}
            </p>
            <p className="lv-conclusion__detail">{r.groundNote}</p>
          </div>

          <div className="lv-stats" style={{ marginTop: 12 }}>
            <div className="lv-stat">
              <span className="lv-stat__value">{r.hireDateTotal}</span>
              <span className="lv-stat__label">입사일 기준 누계</span>
            </div>
            <div className="lv-stat">
              <span className="lv-stat__value">{r.fiscalGrantedTotal}</span>
              <span className="lv-stat__label">회계연도 부여 누계</span>
            </div>
            <div className="lv-stat">
              <span className="lv-stat__value">{r.guaranteedTotal}</span>
              <span className="lv-stat__label">보장선</span>
            </div>
            <div className="lv-stat">
              <span className="lv-stat__value">{r.usedOrPaidTotal}</span>
              <span className="lv-stat__label">사용·지급</span>
            </div>
            <div
              className={
                r.verdict === "shortfall" ? "lv-stat lv-stat--emphasis" : "lv-stat"
              }
            >
              <span className="lv-stat__value">
                {Number.isNaN(r.shortfallDays) ? "—" : Math.max(0, r.shortfallDays)}
              </span>
              <span className="lv-stat__label">정산 대상</span>
            </div>
          </div>

          <p style={{ margin: "12px 0 0", fontSize: 13.5 }}>
            <StatusBadge
              status={
                r.verdict === "shortfall"
                  ? "diff"
                  : r.verdict === "insufficient-input"
                    ? "unknown"
                    : "match"
              }
            />{" "}
            보장선은{" "}
            {r.favourable === "hire-date"
              ? "입사일 기준"
              : r.favourable === "fiscal-year"
                ? "회계연도 기준"
                : "두 기준이 같음"}
            입니다.
          </p>

          <details className="lv-fold" style={{ marginTop: 14 }} open>
            <summary className="lv-fold__summary">
              연도별 발생 내역 ({r.ledger.length}개 연차년도)
            </summary>
            <div className="lv-fold__body">
              <div className="lv-table">
                <table>
                  <thead>
                    <tr>
                      <th>구분</th>
                      <th>발생일</th>
                      <th className="num">발생</th>
                      <th className="num">누계</th>
                      <th>적용 근거</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.ledger.map((e) => (
                      <tr key={e.label}>
                        <td data-label="구분">{e.label}</td>
                        <td data-label="발생일">{e.accruedOn}</td>
                        <td className="num" data-label="발생">
                          {e.days}
                        </td>
                        <td className="num" data-label="누계">
                          {e.cumulative}
                        </td>
                        <td className="basis" data-label="근거">
                          {e.basisLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <div className="lv-input__export">
            <button
              type="button"
              className="lv-input__btn"
              onClick={() => {
                const shortfall = Number.isNaN(r.shortfallDays)
                  ? "확인 필요"
                  : Math.max(0, r.shortfallDays);
                void downloadXlsx(`퇴직연차정산_${endDate}`, [
                  {
                    name: "정산 요약",
                    title: "퇴직 연차 정산 결과",
                    subtitle: `입사 ${hireDate} · 퇴사 ${endDate}`,
                    header: ["항목", "값"],
                    widths: [26, 58],
                    rows: [
                      ["입사일 기준 누계", r.hireDateTotal],
                      ["회계연도 부여 누계", r.fiscalGrantedTotal],
                      [
                        "보장선(유리한 쪽)",
                        `${r.guaranteedTotal} (${
                          r.favourable === "hire-date"
                            ? "입사일 기준"
                            : r.favourable === "fiscal-year"
                              ? "회계연도 기준"
                              : "두 기준 동일"
                        })`,
                      ],
                      ["이미 사용·지급", r.usedOrPaidTotal],
                      ["정산 대상 일수", shortfall],
                      ["취업규칙 재산정 규정", clause === "yes" ? "있음" : clause === "no" ? "없음" : "확인 필요"],
                      ["판단 근거", r.groundNote],
                    ],
                    emphasizeRows: [4],
                    notes: [
                      "· 근거 — 고용노동부 근로기준과-5802(2009-12-31), 근기 68207-620(2003-05-23)",
                      "· 퇴직 시 총 휴가일수가 입사일 기준에 미달하면 부족분을 정산합니다.",
                      "· 수당 금액은 산출하지 않습니다. 통상임금 기준은 별도 확인이 필요합니다.",
                      "· 1년 미만 월 단위 연차(11일)는 회계연도 산정과 별개로 발생합니다.",
                      "· 적법한 사용촉진, 소멸시효, 특수 출결은 별도 확인이 필요합니다.",
                    ],
                  },
                  {
                    name: "연도별 발생내역",
                    title: "입사일 기준 연도별 연차 발생 내역",
                    subtitle: `입사 ${hireDate} · 퇴사 ${endDate}`,
                    header: ["구분", "발생일", "발생", "누계", "적용 근거"],
                    widths: [16, 13, 8, 8, 46],
                    rows: r.ledger.map((e) => [
                      e.label,
                      e.accruedOn,
                      e.days,
                      e.cumulative,
                      e.basisLabel,
                    ]),
                  },
                ]);
              }}
            >
              엑셀 내려받기
            </button>
            <button
              type="button"
              className="lv-input__btn is-ghost lv-print-btn"
              onClick={() => window.print()}
            >
              인쇄 · PDF 저장
            </button>
          </div>
        </>
      )}
    </section>
  );
}
