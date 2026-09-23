import Link from "next/link";

import { settleOnTermination } from "@/lib/leave-ledger";
import { SETTLEMENT_CASES } from "@/lib/leave-settlement-sample";

export const metadata = {
  title: "퇴직 연차 재정산 데모 | SafeClaw",
  description:
    "회계연도 기준으로 운영한 사업장의 퇴사자를 입사일 기준과 대조해 정산 대상 일수를 산출하는 방식을 가상 사례로 보여주는 데모입니다.",
};

export default function SettlementPage() {
  const results = SETTLEMENT_CASES.map((c) => ({
    meta: c,
    result: settleOnTermination({
      hireDate: c.hireDate,
      endDate: c.endDate,
      fiscalGrantedTotal: c.fiscalGrantedTotal,
      usedOrPaidTotal: c.usedOrPaidTotal,
    }),
  }));

  return (
    <main className="leave-page">
      <div className="notice notice--strong" role="status">
        <strong>가상 데이터 데모입니다.</strong> 실제 파일 검증은 아직 지원하지 않습니다.
        아래 사례는 행정해석 본문과 가상 자료이며, 실제 개인정보가 아닙니다.
      </div>

      <header className="head">
        <p className="eyebrow">SafeClaw · 검증 도구</p>
        <h1>퇴직 연차 재정산 — 회계연도 운영 사업장</h1>
        <p className="lede">
          회계연도로 연차를 관리하던 사업장에서 직원이 퇴사하면,{" "}
          <strong>입사일 기준으로 계산한 일수와 대조</strong>해 부족분을 정산해야 합니다.
          이 도구는 <strong>연도별 발생 이력</strong>을 펼쳐 두 기준의 누계를 비교합니다.
        </p>
      </header>

      <section className="scope">
        <h2>적용 규칙</h2>
        <p className="scope__note" style={{ marginTop: 0 }}>
          보장선 = <strong>max(입사일 기준 누계, 회계연도 부여 누계)</strong> ·{" "}
          정산 대상 = 보장선 − 이미 사용·지급한 일수
        </p>
        <p className="scope__note">
          근거 — 고용노동부 <strong>근로기준과-5802</strong>(2009-12-31): 회계연도를 기준으로
          일률 적용하더라도 근로자에게 불리하지 않아야 하므로, 퇴직시점 총 휴가일수가 입사일
          기준에 미달하면 미달분을 미사용수당으로 정산해야 합니다. 같은 해석은{" "}
          <strong>회계연도 기준이 더 많은 경우에는 그쪽을 지급</strong>한다고도 밝히고 있어,
          규칙은 「입사일 기준으로 맞춘다」가 아니라 <strong>「유리한 쪽으로 맞춘다」</strong>입니다.
        </p>
      </section>

      {results.map(({ meta, result }) => (
        <section key={meta.id} className="scope">
          <h2>{meta.label}</h2>
          <p className="meta">
            입사 <strong>{meta.hireDate}</strong> · 퇴사 <strong>{meta.endDate}</strong>
          </p>

          <div className="summary" style={{ marginTop: 14 }}>
            <div className="stat">
              <span className="stat__num">{result.hireDateTotal}</span>
              <span className="stat__label">입사일 기준 누계</span>
            </div>
            <div className="stat">
              <span className="stat__num">{result.fiscalGrantedTotal}</span>
              <span className="stat__label">회계연도 부여 누계</span>
            </div>
            <div className="stat">
              <span className="stat__num">{result.guaranteedTotal}</span>
              <span className="stat__label">보장선(유리한 쪽)</span>
            </div>
            <div className="stat">
              <span className="stat__num">{result.usedOrPaidTotal}</span>
              <span className="stat__label">사용·지급분</span>
            </div>
            <div
              className={
                result.verdict === "shortfall" ? "stat stat--diff" : "stat"
              }
            >
              <span className="stat__num">
                {result.shortfallDays > 0 ? `${result.shortfallDays}일` : "없음"}
              </span>
              <span className="stat__label">정산 대상</span>
            </div>
          </div>

          <p className="scope__note">
            {result.verdict === "shortfall" ? (
              <span className="tag tag--diff">정산 필요</span>
            ) : (
              <span className="tag">정산 대상 없음</span>
            )}{" "}
            {result.groundNote}
          </p>

          <div className="tablewrap" style={{ marginTop: 14 }}>
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
                    <td>{e.label}</td>
                    <td>{e.accruedOn}</td>
                    <td className="num">{e.days}</td>
                    <td className="num">{e.cumulative}</td>
                    <td className="basis">{e.basisLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="scope__note">
            {meta.point}
            {meta.source && (
              <>
                <br />
                <span style={{ fontSize: 13 }}>출처 · {meta.source}</span>
              </>
            )}
          </p>
        </section>
      ))}

      <section className="scope">
        <h2>이 데모가 보지 않는 것</h2>
        <ul>
          <li>
            <strong>수당 금액</strong> — 일수만 냅니다. 통상임금을 곱한 금액은 계산하지 않습니다.
          </li>
          <li>출근율 80% 미만 구간 · 육아휴직 등 특수 출결로 발생이 달라지는 경우</li>
          <li>회계연도 첫해 비례부여를 회사가 어떻게 했는지 — 여기서는 입력값으로 받습니다</li>
          <li>연차촉진(근기법 제61조)을 적법하게 해서 수당 지급 의무가 없어진 경우</li>
          <li>미사용수당 청구권의 소멸시효(3년) — 해석 질의에도 등장하는 쟁점입니다</li>
        </ul>
        <p className="scope__note">
          실파일 지원 단계에서는 이 항목들이 확인되지 않은 행을 <strong>「확인 불가」</strong>로
          따로 두고, 임의로 「정산 필요」나 「없음」으로 밀어넣지 않을 계획입니다.
        </p>
      </section>

      <footer className="foot">
        <p>
          <Link href="/tools/leave">← 연차 대조(발생일수) 데모</Link>
        </p>
        <p className="foot__verify">
          연도별 발생일수는 Frappe HRMS 한국 연차 엔진과 독립 구현하여 교차 대조했고,
          누계·정산 로직은 근로기준과-5802 본문의 사례값(입사일 기준 79일 · 62일 · 정산 26일)으로
          고정 검증합니다. 법적 기준 최종 확인은 공인노무사 검토를 거칩니다.
        </p>
      </footer>
    </main>
  );
}
