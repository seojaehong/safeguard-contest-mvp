import Link from "next/link";

import {
  ConclusionBanner,
  DemoNotice,
  Foldable,
  ResponsiveTable,
  ScopeNote,
  Stat,
  StatGrid,
  StatusBadge,
} from "@/components/leave/LeaveUI";
import { summarizeUsage, usageKindLabel, formatDays, HOURLY_LEAVE_CAUTION } from "@/lib/leave-usage";
import { applyAttendanceRatio, proratedFirstFiscalYear, PRESCRIPTION_NOTICE } from "@/lib/leave-advanced";
import { buildPromotionSchedule, scheduleStatusLabel } from "@/lib/leave-promotion";
import {
  DEMO_USAGE_POLICY, DEMO_USAGE_RECORDS,
  DEMO_ATTENDANCE, DEMO_PRORATED, DEMO_PROMOTION,
} from "@/lib/leave-advanced-sample";

export const metadata = {
  title: "사용단위·출근율·촉진 점검 | SafeClaw",
  description:
    "반차·반반차·시간차 환산, 출근율 80% 기준, 회계연도 첫해 비례부여, 연차 사용촉진 일정을 한 화면에서 점검합니다.",
};

export default function AdvancedPage() {
  const usage = summarizeUsage(DEMO_USAGE_RECORDS, DEMO_USAGE_POLICY);
  const attendance = DEMO_ATTENDANCE.map((a) => ({
    ...a,
    result: applyAttendanceRatio({
      hireDate: a.hireDate,
      asOf: "2026-09-23",
      attendanceRatio: a.ratio,
    }),
  }));
  const prorated = DEMO_PRORATED.map((p) => ({
    ...p,
    result: proratedFirstFiscalYear({ hireDate: p.hireDate }),
  }));
  const promotion = DEMO_PROMOTION.map((p) => ({
    ...p,
    result: buildPromotionSchedule(p.input),
  }));

  return (
    <main className="lv-page">
      <DemoNotice />

      <header className="lv-head">
        <p className="lv-head__eyebrow">SafeClaw · 연차 검증</p>
        <h1 className="lv-head__title">사용단위 · 출근율 · 촉진 점검</h1>
        <p className="lv-head__lede">
          실무에서 계산이 갈리는 네 가지를 한 화면에서 봅니다. 자료가 없는 항목은{" "}
          <strong>추정하지 않고</strong> 「확인 불가」로 남깁니다.
        </p>
      </header>

      <ConclusionBanner
        tone="unknown"
        headline="자료가 있는 항목만 계산하고, 나머지는 확인 대상으로 남깁니다"
        detail={
          <>
            출근율·통상임금·촉진 적법성처럼 <strong>사안마다 달라지는 값</strong>은 담당자가
            입력하거나 확인하시도록 두었습니다.
          </>
        }
        meta="기준일 2026-09-23 · 예시 자료"
      />

      {/* ── A1 사용 단위 ── */}
      <section className="lv-scope">
        <h2 className="lv-scope__title">① 사용 단위 — 반차 · 반반차 · 시간차</h2>
        <StatGrid>
          <Stat value={formatDays(usage.totalDays)} label="환산 합계" />
          <Stat value={usage.byKind.full.count} label="종일" />
          <Stat value={usage.byKind.half.count + usage.byKind.quarter.count} label="반차·반반차" />
          <Stat value={usage.issues.length} label="규칙과 다름" emphasis={usage.issues.length > 0} />
        </StatGrid>

        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>단위</th>
                <th className="num">환산</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_USAGE_RECORDS.map((r, i) => {
                const issue = usage.issues.find((x) => x.index === i);
                return (
                  <tr key={`${r.date}-${i}`} data-diff={issue ? "true" : undefined}>
                    <td data-label="날짜">{r.date}</td>
                    <td data-label="단위">
                      {usageKindLabel(r.kind)}
                      {r.kind === "hourly" && r.hours !== undefined ? ` ${r.hours}h` : ""}
                    </td>
                    <td className="num" data-label="환산">
                      {issue?.code === "hours-missing"
                        ? "—"
                        : formatDays(
                            r.kind === "full" ? 1
                            : r.kind === "half" ? 0.5
                            : r.kind === "quarter" ? 0.25
                            : (r.hours ?? 0) / DEMO_USAGE_POLICY.hoursPerDay
                          )}
                    </td>
                    <td className="basis" data-label="비고">
                      {issue ? issue.message : r.note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>

        {usage.needsHourlyCaution && (
          <p className="lv-scope__footer">
            <StatusBadge status="unknown" /> {HOURLY_LEAVE_CAUTION}
          </p>
        )}
      </section>

      {/* ── A2 출근율 ── */}
      <section className="lv-scope">
        <h2 className="lv-scope__title">② 출근율 80% 기준</h2>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>대상</th>
                <th className="num">출근율</th>
                <th className="num">발생일수</th>
                <th>판정</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a.name}>
                  <td data-label="대상">{a.name}</td>
                  <td className="num" data-label="출근율">
                    {a.ratio === undefined ? "—" : `${(a.ratio * 100).toFixed(0)}%`}
                  </td>
                  <td className="num" data-label="발생일수">
                    {a.result.days ?? "—"}
                  </td>
                  <td data-label="판정">
                    <StatusBadge
                      status={
                        a.result.verdict === "normal" ? "match"
                        : a.result.verdict === "reduced" ? "diff"
                        : "unknown"
                      }
                    />
                  </td>
                  <td className="basis" data-label="근거">{a.result.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
        <p className="lv-scope__footer">
          출근율 자체는 계산하지 않습니다. 소정근로일수에서 무엇을 제외할지(육아휴직·업무상재해
          ·쟁의행위 등)는 사안마다 다르고 다툼이 있습니다.
        </p>
      </section>

      {/* ── A3 회계연도 첫해 비례부여 ── */}
      <section className="lv-scope">
        <h2 className="lv-scope__title">③ 회계연도 첫해 비례부여</h2>
        <ResponsiveTable>
          <table>
            <thead>
              <tr>
                <th>입사일</th>
                <th className="num">입사년도 개월</th>
                <th className="num">비례 일수</th>
                <th>산식</th>
              </tr>
            </thead>
            <tbody>
              {prorated.map((p) => (
                <tr key={p.hireDate}>
                  <td data-label="입사일">{p.hireDate}</td>
                  <td className="num" data-label="개월">{p.result.monthsInHireYear}</td>
                  <td className="num" data-label="비례 일수">{p.result.days}</td>
                  <td className="basis" data-label="산식">
                    {p.result.formula}
                    <br />
                    <span style={{ fontSize: 12 }}>{p.point}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
        <p className="lv-scope__footer">
          근거 — <strong>근로개선정책과-5352</strong>(2011-12-19): 연도 중 입사자에게 불리하지
          않도록 다음 회계연도에 입사년도 근속기간에 비례해 부여합니다. 1년 미만 월 단위
          연차(§60②)는 이와 <strong>별개로</strong> 발생합니다.
        </p>
      </section>

      {/* ── A4 촉진 일정 ── */}
      <section className="lv-scope">
        <h2 className="lv-scope__title">④ 연차 사용촉진 일정</h2>
        {promotion.map((p) => (
          <Foldable
            key={p.label}
            summary={`${p.label} — ${scheduleStatusLabel(p.result.overall)}`}
          >
            <ResponsiveTable>
              <table>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>허용 기간</th>
                    <th>실제</th>
                    <th>판정</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {p.result.windows.map((w) => (
                    <tr key={w.label}>
                      <td data-label="단계">{w.label}</td>
                      <td data-label="허용 기간">
                        {w.from && w.to ? `${w.from} ~ ${w.to}` : w.to ? `~ ${w.to}` : "—"}
                      </td>
                      <td data-label="실제">{w.actual ?? "—"}</td>
                      <td data-label="판정">
                        <StatusBadge
                          status={
                            w.status === "match" ? "match"
                            : w.status === "diff" ? "diff"
                            : w.status === "out-of-scope" ? "out-of-scope"
                            : "unknown"
                          }
                        />
                      </td>
                      <td className="basis" data-label="비고">{w.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
            <p className="lv-scope__footer">{p.point}</p>
            <p className="lv-scope__footer">{p.result.disclaimer}</p>
          </Foldable>
        ))}
      </section>

      <ScopeNote
        title="담당자 확인이 필요한 항목"
        items={[
          <>
            <strong>촉진의 적법성</strong> — 서면 여부·도달·노무수령 거부까지가 요건입니다. 이
            화면은 날짜만 대조합니다.
          </>,
          <>
            <strong>출근율 산정</strong> — 소정근로일수에서 무엇을 빼는지는 사안마다 다릅니다.
          </>,
          <>
            <strong>수당 금액</strong> — 통상임금 산입 범위는 그 자체가 다툼의 대상이라 금액은
            산출하지 않습니다.
          </>,
          <>{PRESCRIPTION_NOTICE}</>,
        ]}
        footer={
          <>
            자료가 없으면 <strong>「확인 불가」</strong>로 둡니다. 근거 없이 한쪽으로 단정하지
            않습니다.
          </>
        }
      />

      <footer className="lv-foot">
        <p>
          <Link href="/tools/leave">← 연차 일수 점검</Link>
          {" · "}
          <Link href="/tools/leave/settlement">퇴직 정산</Link>
        </p>
        <p>최종 판단은 담당 공인노무사의 검토를 거칩니다.</p>
      </footer>
    </main>
  );
}
