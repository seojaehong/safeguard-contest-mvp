import Link from "next/link";

import { compareRow } from "@/lib/annual-leave";
import {
  DEMO_ROWS,
  DEMO_AS_OF,
  DEMO_WORKPLACE_NAME,
} from "@/lib/leave-demo-sample";

export const metadata = {
  title: "연차 대조 데모 | SafeClaw",
  description:
    "입사일 기준 연차 발생일수를 대장 기재값과 대조하는 방식을 가상 데이터로 보여주는 데모입니다.",
};

export default function LeaveToolPage() {
  const rows = DEMO_ROWS.map((row) => ({
    ...compareRow(row, DEMO_AS_OF),
    note: row.note,
  }));

  const diffCount = rows.filter((r) => r.verdict === "diff").length;
  const matchCount = rows.filter((r) => r.verdict === "match").length;
  const errorCount = rows.filter((r) => r.verdict === "error").length;

  return (
    <main className="leave-page">
      {/* 제우스 요구사항: 화면 상단에 성격을 고정 표시한다 */}
      <div className="notice notice--strong" role="status">
        <strong>가상 데이터 데모입니다.</strong> 실제 파일 검증은 아직 지원하지 않습니다.
        아래 표는 우리가 만든 가상 직원 자료이며, 실제 개인정보가 아닙니다.
      </div>

      <header className="head">
        <p className="eyebrow">SafeClaw · 검증 도구</p>
        <h1>연차 대조 — 입사일 기준 발생일수</h1>
        <p className="lede">
          대장에 적힌 연차일수가 <strong>입사일 기준 발생일수</strong>와 맞는지 한 번에
          대조합니다. 계산 결과만 주는 것이 아니라 <strong>어떤 규칙을 적용했는지</strong>를
          함께 보여줍니다.
        </p>
      </header>

      <section className="summary">
        <div className="stat">
          <span className="stat__num">{rows.length}</span>
          <span className="stat__label">대조한 인원</span>
        </div>
        <div className="stat stat--diff">
          <span className="stat__num">{diffCount}</span>
          <span className="stat__label">차이 있음</span>
        </div>
        <div className="stat">
          <span className="stat__num">{matchCount}</span>
          <span className="stat__label">조건상 일치</span>
        </div>
        {errorCount > 0 && (
          <div className="stat stat--error">
            <span className="stat__num">{errorCount}</span>
            <span className="stat__label">계산 실패</span>
          </div>
        )}
      </section>

      <p className="meta">
        사업장 <strong>{DEMO_WORKPLACE_NAME}</strong> · 기준일{" "}
        <strong>{DEMO_AS_OF}</strong> · 기준 <strong>입사일(실입사)</strong>
      </p>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>입사일</th>
              <th className="num">대장 기재</th>
              <th className="num">계산값</th>
              <th className="num">차이</th>
              <th>판정</th>
              <th>적용 근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={r.verdict === "diff" ? "row--diff" : undefined}>
                <td>{r.name}</td>
                <td>{r.hireDate}</td>
                <td className="num">{r.recordedDays}</td>
                <td className="num">
                  {r.verdict === "error" ? "—" : r.calculatedDays}
                </td>
                <td className="num">
                  {r.verdict === "error"
                    ? "—"
                    : r.diff === 0
                      ? "0"
                      : r.diff > 0
                        ? `+${r.diff}`
                        : r.diff}
                </td>
                <td>
                  {r.verdict === "diff" && <span className="tag tag--diff">차이 있음</span>}
                  {r.verdict === "match" && <span className="tag">조건상 일치</span>}
                  {r.verdict === "error" && (
                    <span className="tag tag--error">계산 실패</span>
                  )}
                </td>
                <td className="basis">
                  {r.verdict === "error" ? r.errorMessage : r.basisLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 제우스 요구사항: 무엇을 안 보는지 먼저 밝힌다. 과장 금지 */}
      <section className="scope">
        <h2>이 데모가 보지 않는 것</h2>
        <ul>
          <li>
            <strong>이월·사용분을 뺀 잔여일수</strong> — 이 도구는 「발생일수」만 봅니다.
            대장의 숫자가 잔여일수라면 애초에 비교 대상이 다릅니다.
          </li>
          <li>회계연도 기준으로 운영하는 사업장</li>
          <li>출근율 80% 미만 구간, 육아휴직·병휴직 등 특수 출결</li>
          <li>회사가 법정 기준에 더해 부여한 추가 연차</li>
        </ul>
        <p className="scope__note">
          실제 대장에는 이 항목들이 섞여 있습니다. 그래서 실파일 지원 단계에서는{" "}
          <strong>「확인 불가」</strong> 판정을 따로 두고, 정보가 부족한 행을 임의로
          「일치」나 「오류」로 밀어넣지 않을 계획입니다.
        </p>
      </section>

      <section className="ask">
        <h2>서식을 보여주실 수 있을까요</h2>
        <p>
          여러분이 실제로 쓰시는 양식에 맞추고 싶습니다. 다만 지금 단계에서는{" "}
          <strong>실제 직원 자료를 받지 않습니다.</strong> 보내주실 때는{" "}
          <strong>직원정보를 모두 지운 빈 양식</strong>이나{" "}
          <strong>가상값으로 바꾼 예시</strong>로 부탁드립니다. 엑셀은 숨김 시트와 메모에도
          정보가 남을 수 있습니다.
        </p>
        <p className="ask__foot">
          문의 · 서식 제공 — <Link href="/">SafeClaw</Link>
        </p>
      </section>

      <footer className="foot">
        <p>
          계산 규칙: 근로기준법 제60조 · 1년 미만 개월당 1일(상한 11일) · 1년 이상 15일 ·
          3년 이상 2년마다 1일 가산(상한 25일)
        </p>
        <p className="foot__verify">
          계산 로직은 Frappe HRMS 한국 연차 엔진과 <strong>독립 구현</strong>하여 8건 표본에서
          교차 대조했습니다. 법적 기준 최종 확인은 공인노무사 검토를 거칩니다.
        </p>
      </footer>
    </main>
  );
}
