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
import { settleOnTermination } from "@/lib/leave-ledger";
import { SETTLEMENT_CASES } from "@/lib/leave-settlement-sample";

export const metadata = {
  title: "퇴직 연차 정산 | SafeClaw",
  description:
    "회계연도로 관리하던 사업장의 퇴사자를 입사일 기준과 대조해 정산 대상 일수를 산출합니다. 근거는 고용노동부 근로기준과-5802.",
};

type Props = { searchParams: Promise<{ case?: string }> };

export default async function SettlementPage({ searchParams }: Props) {
  const params = await searchParams;
  const active =
    SETTLEMENT_CASES.find((c) => c.id === params.case) ?? SETTLEMENT_CASES[0];

  const result = settleOnTermination({
    hireDate: active.hireDate,
    endDate: active.endDate,
    fiscalGrantedTotal: active.fiscalGrantedTotal,
    usedOrPaidTotal: active.usedOrPaidTotal,
  });

  const needsAction = result.verdict === "shortfall";

  return (
    <main className="lv-page">
      <DemoNotice />

      <header className="lv-head">
        <p className="lv-head__eyebrow">SafeClaw · 연차 검증</p>
        <h1 className="lv-head__title">퇴직 연차 정산</h1>
        <p className="lv-head__lede">
          회계연도로 연차를 관리하는 사업장에서 직원이 퇴사하면{" "}
          <strong>입사일 기준으로 다시 계산</strong>해 부족분이 없는지 확인해야 합니다.
          연도별 발생 내역을 펼쳐 두 기준을 나란히 보여드립니다.
        </p>
      </header>

      {/* 사례 전환 — JS 없이 링크로 */}
      <nav className="lv-tabs" aria-label="사례 선택">
        {SETTLEMENT_CASES.map((c) => (
          <Link
            key={c.id}
            href={`/tools/leave/settlement?case=${c.id}`}
            className="lv-tab"
            aria-current={c.id === active.id ? "page" : undefined}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {/* ① 결론 먼저 */}
      <ConclusionBanner
        tone={needsAction ? "action" : "clear"}
        headline={
          needsAction
            ? `정산 대상 ${result.shortfallDays}일`
            : "정산 대상이 없습니다"
        }
        detail={result.groundNote}
        meta={
          <>
            입사 {active.hireDate} · 퇴사 {active.endDate} · 보장선{" "}
            {result.guaranteedTotal}일(
            {result.favourable === "hire-date"
              ? "입사일 기준"
              : result.favourable === "fiscal-year"
                ? "회계연도 기준"
                : "동일"}
            )
            {active.source && ` · 출처 ${active.source}`}
          </>
        }
      />

      {/* ② 요약 숫자 */}
      <StatGrid>
        <Stat value={result.hireDateTotal} label="입사일 기준 누계" />
        <Stat value={result.fiscalGrantedTotal} label="회계연도 부여 누계" />
        <Stat value={result.guaranteedTotal} label="보장선 (유리한 쪽)" />
        <Stat value={result.usedOrPaidTotal} label="사용·지급분" />
        <Stat
          value={result.shortfallDays > 0 ? result.shortfallDays : 0}
          label="정산 대상"
          emphasis={needsAction}
        />
      </StatGrid>

      <p className="lv-head__lede" style={{ fontSize: 14 }}>
        <StatusBadge status={needsAction ? "diff" : "match"} /> {active.point}
      </p>

      {/* ③ 근거 — 펼쳐서 확인 */}
      <Foldable summary={`연도별 발생 이력 (${result.ledger.length}개 연차년도)`} defaultOpen>
        <ResponsiveTable>
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
              {result.ledger.map((e) => (
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
        </ResponsiveTable>
      </Foldable>

      <Foldable summary="적용 기준과 근거">
        <p className="lv-scope__footer" style={{ marginTop: 0 }}>
          보장선 = <strong>max(입사일 기준 누계, 회계연도 부여 누계)</strong> · 정산 대상 =
          보장선 − 이미 사용·지급한 일수
        </p>
        <p className="lv-scope__footer">
          <strong>고용노동부 근로기준과-5802</strong> (2009-12-31) — 회계연도를 기준으로
          일률 적용하더라도 근로자에게 불리하지 않아야 하므로, 퇴직시점 총 휴가일수가 입사일
          기준에 미달하면 그 미달분을 미사용수당으로 정산해야 합니다.
        </p>
        <p className="lv-scope__footer">
          같은 해석은 <strong>회계연도 기준이 더 많은 경우 그쪽으로 지급</strong>한다고도
          밝히고 있습니다(입사일기준 62일 / 회계연도기준 69일). 그래서 규칙은 「입사일 기준으로
          맞춘다」가 아니라 <strong>「유리한 쪽으로 맞춘다」</strong>입니다.
        </p>
        <p className="lv-scope__footer">
          이 화면의 계산은 위 행정해석 본문에 제시된 사례값(입사일 기준 79일 · 62일 ·
          정산 26일)과 일치하는지 상시 확인합니다.
        </p>
      </Foldable>

      <ScopeNote
        items={[
          <>
            <strong>수당 금액</strong> — 일수까지만 산출합니다. 통상임금 산입 범위는 그 자체가
            다툼의 대상이라, 금액은 담당자가 확정하시도록 남겨둡니다.
          </>,
          <>출근율 80% 미만 구간 · 육아휴직 등 특수 출결로 발생이 달라지는 경우</>,
          <>회계연도 첫해 비례부여를 회사가 어떻게 했는지 — 여기서는 입력값으로 받습니다</>,
          <>
            <strong>연차촉진(근기법 제61조)</strong>을 적법하게 해서 수당 지급 의무가 없어진
            경우 — 적법성 판정은 사실인정이라 다루지 않습니다
          </>,
          <>
            미사용수당 청구권의 <strong>소멸시효 3년</strong> — 기산점에 다툼이 있어 판정하지
            않습니다
          </>,
        ]}
        footer={
          <>
            확인되지 않은 항목은 <strong>「확인 불가」</strong>로 남깁니다. 근거가 없는 상태에서
            「정산 필요」나 「없음」으로 단정하지 않습니다.
          </>
        }
      />

      <footer className="lv-foot">
        <p>
          <Link href="/tools/leave">← 연차 일수 점검</Link>
          {" · "}
          <Link href="/tools/leave/advanced">사용단위·촉진 점검 →</Link>
        </p>
        <p>최종 판단은 담당 공인노무사의 검토를 거칩니다.</p>
      </footer>
    </main>
  );
}
