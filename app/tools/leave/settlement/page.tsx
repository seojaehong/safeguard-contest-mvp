import Link from "next/link";

import { SettlementInput } from "@/components/leave/SettlementInput";

export const metadata = {
  title: "퇴직 연차 정산 | SafeClaw",
  description:
    "회계연도로 연차를 관리하는 사업장에서 퇴사자가 생기면 입사일 기준으로 다시 계산해 부족분을 확인합니다. 연도별 발생 내역과 근거를 함께 보여드립니다.",
};

export default function SettlementPage() {
  return (
    <main className="lv-page">
      <header className="lv-head">
        <p className="lv-head__eyebrow">노무사·인사담당자를 위한 퇴직 정산</p>
        <h1 className="lv-head__title">
          회계연도로 관리했다면, 퇴사할 때 다시 계산해야 합니다
        </h1>
        <p className="lv-head__lede">
          회계연도 기준으로 연차를 부여해 왔더라도 퇴직 시점에{" "}
          <strong>입사일 기준으로 계산한 일수에 미달하면 그 차이를 정산</strong>해야 합니다.
          연도별 발생 내역을 펼쳐 두 기준을 나란히 보여드립니다.
        </p>
      </header>

      <SettlementInput />

      <section className="lv-how">
        <div className="lv-how__item">
          <span className="lv-how__num">계산 방식</span>
          <p>
            보장선 = <strong>입사일 기준 누계와 회계연도 부여 누계 중 유리한 쪽</strong> ·
            정산 대상 = 보장선 − 이미 사용·지급한 일수
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">근거</span>
          <p>
            고용노동부 <strong>근로기준과-5802</strong>(2009-12-31),{" "}
            <strong>근기 68207-620</strong>(2003-05-23)
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">이어서</span>
          <p>
            <Link href="/tools/leave">연차 일수 계산</Link> ·{" "}
            <Link href="/tools/leave/advanced">반차·출근율·사용촉진</Link>
          </p>
        </div>
      </section>

      <section className="lv-scope">
        <h2 className="lv-scope__title">계산 근거</h2>
        <p className="lv-scope__footer" style={{ marginTop: 0 }}>
          <strong>근로기준과-5802</strong> — 회계연도를 기준으로 일률 적용하더라도 근로자에게
          불리하지 않아야 하므로, 퇴직시점 총 휴가일수가 입사일 기준에 미달하면 그 미달분을
          미사용수당으로 정산해야 합니다.
        </p>
        <p className="lv-scope__footer">
          같은 해석은 <strong>회계연도 기준이 더 많은 경우 그쪽으로 지급</strong>한다고도
          밝히고 있습니다(입사일기준 62일 / 회계연도기준 69일). 그래서 기준은 「입사일로
          맞춘다」가 아니라 <strong>「유리한 쪽으로 맞춘다」</strong>입니다.
        </p>
        <p className="lv-scope__footer">
          다만 회계연도 부여분이 더 많을 때는{" "}
          <strong>취업규칙에 퇴직 시 입사일 기준 재산정 규정이 있는지</strong>에 따라 달라집니다.
          규정이 없으면 부여한 일수를 그대로 두고, 있으면 입사일 기준으로 다시 계산할 수
          있습니다.
        </p>
      </section>

      <section className="lv-scope">
        <h2 className="lv-scope__title">함께 확인이 필요한 항목</h2>
        <ul className="lv-scope__list">
          <li>
            <strong>수당 금액</strong> — 일수까지만 산출합니다. 통상임금 산입 범위는 그 자체가
            다툼의 대상이라 금액은 담당자가 확정하시도록 남겨둡니다
          </li>
          <li>출근율 80% 미만 구간, 육아휴직 등 특수 출결로 발생이 달라지는 경우</li>
          <li>
            1년 미만 월 단위 연차(11일)는 회계연도 산정과 <strong>별개로</strong> 발생합니다
          </li>
          <li>
            <strong>연차 사용촉진</strong>을 적법하게 해서 수당 지급 의무가 없어진 경우 —
            적법성 판정은 사실인정이라 다루지 않습니다
          </li>
          <li>미사용수당 청구권의 소멸시효는 별도 검토가 필요합니다</li>
        </ul>
        <p className="lv-scope__footer">
          계산 결과는 근로기준법과 고용노동부 행정해석을 기준으로 합니다. 개별 사안의 최종
          판단은 담당 공인노무사의 검토를 거치시기 바랍니다.
        </p>
      </section>
    </main>
  );
}
