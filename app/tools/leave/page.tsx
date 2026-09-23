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
import { compareRow } from "@/lib/annual-leave";
import {
  DEMO_ROWS,
  DEMO_AS_OF,
  DEMO_WORKPLACE_NAME,
} from "@/lib/leave-demo-sample";

export const metadata = {
  title: "연차 발생일수 대조 | SafeClaw",
  description:
    "대장에 적힌 연차일수가 입사일 기준 발생일수와 맞는지 대조하고, 어떤 규칙을 적용했는지 함께 보여주는 데모입니다.",
};

export default function LeaveToolPage() {
  const rows = DEMO_ROWS.map((row) => ({
    ...compareRow(row, DEMO_AS_OF),
    note: row.note,
  }));

  const diff = rows.filter((r) => r.verdict === "diff");
  const errors = rows.filter((r) => r.verdict === "error");
  const maxGap = diff.reduce((m, r) => Math.max(m, Math.abs(r.diff)), 0);

  return (
    <main className="lv-page">
      <DemoNotice />

      <header className="lv-head">
        <p className="lv-head__eyebrow">SafeClaw · 연차 검증</p>
        <h1 className="lv-head__title">연차 발생일수 대조</h1>
        <p className="lv-head__lede">
          대장에 적힌 일수가 <strong>입사일 기준 발생일수</strong>와 맞는지 한 번에
          대조합니다. 숫자만 주지 않고 <strong>어떤 규칙을 적용했는지</strong>를 행마다
          붙입니다.
        </p>
      </header>

      {/* ① 결론 먼저 */}
      <ConclusionBanner
        tone={diff.length > 0 ? "action" : "clear"}
        headline={
          diff.length > 0
            ? `${rows.length}명 중 ${diff.length}명이 대장과 다릅니다`
            : `${rows.length}명 모두 조건상 일치합니다`
        }
        detail={
          diff.length > 0 ? (
            <>
              가장 큰 차이는 <strong>{maxGap}일</strong>입니다. 아래 표에서 차이 나는 행의
              적용 근거를 확인하세요.
            </>
          ) : (
            <>입사일 기준 발생일수와 대장 기재값이 모두 맞습니다.</>
          )
        }
        meta={
          <>
            {DEMO_WORKPLACE_NAME} · 기준일 {DEMO_AS_OF} · 입사일(실입사) 기준
            {errors.length > 0 && ` · 계산 실패 ${errors.length}건`}
          </>
        }
      />

      {/* ② 요약 숫자 */}
      <StatGrid>
        <Stat value={rows.length} label="대조 인원" />
        <Stat value={diff.length} label="차이 있음" emphasis={diff.length > 0} />
        <Stat value={rows.length - diff.length - errors.length} label="조건상 일치" />
        {errors.length > 0 && <Stat value={errors.length} label="계산 실패" emphasis />}
      </StatGrid>

      {/* ③ 상세 */}
      <ResponsiveTable>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>입사일</th>
              <th className="num">대장</th>
              <th className="num">계산</th>
              <th className="num">차이</th>
              <th>판정</th>
              <th>적용 근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} data-diff={r.verdict === "diff" ? "true" : undefined}>
                <td data-label="이름">{r.name}</td>
                <td data-label="입사일">{r.hireDate}</td>
                <td className="num" data-label="대장">
                  {r.recordedDays}
                </td>
                <td className="num" data-label="계산">
                  {r.verdict === "error" ? "—" : r.calculatedDays}
                </td>
                <td className="num" data-label="차이">
                  {r.verdict === "error"
                    ? "—"
                    : r.diff === 0
                      ? "0"
                      : r.diff > 0
                        ? `+${r.diff}`
                        : r.diff}
                </td>
                <td data-label="판정">
                  <StatusBadge
                    status={
                      r.verdict === "diff"
                        ? "diff"
                        : r.verdict === "error"
                          ? "unknown"
                          : "match"
                    }
                  />
                </td>
                <td className="basis" data-label="근거">
                  {r.verdict === "error" ? r.errorMessage : r.basisLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTable>

      <Foldable summary="적용한 계산 규칙 (근로기준법 제60조)">
        <ul className="lv-scope__list">
          <li>1년 미만 — 계속근로 1개월당 1일, 상한 11일</li>
          <li>1년 이상 — 15일</li>
          <li>3년 이상 — 2년마다 1일 가산, 상한 25일</li>
        </ul>
        <p className="lv-scope__footer">
          계산 로직은 Frappe HRMS 한국 연차 엔진과 독립 구현하여 표본 8건에서 교차
          대조했습니다(<code>tests/annual-leave.crosscheck.mts</code>).
        </p>
      </Foldable>

      <ScopeNote
        items={[
          <>
            <strong>이월·사용분을 뺀 잔여일수</strong> — 이 화면은 「발생일수」만 봅니다.
            대장의 숫자가 잔여일수라면 비교 대상이 다릅니다.
          </>,
          <>회계연도 기준으로 운영하는 사업장 — 퇴직 정산은 별도 화면에서 다룹니다</>,
          <>출근율 80% 미만 구간, 육아휴직·병휴직 등 특수 출결</>,
          <>회사가 법정 기준에 더해 부여한 추가 연차</>,
        ]}
        footer={
          <>
            실제 대장에는 이 항목들이 섞여 있습니다. 실파일 지원 단계에서는{" "}
            <strong>「확인 불가」</strong> 판정을 따로 두고, 정보가 부족한 행을 임의로
            「일치」나 「차이」로 밀어넣지 않습니다.
          </>
        }
      />

      <section className="lv-scope">
        <h2 className="lv-scope__title">서식을 보여주실 수 있을까요</h2>
        <p className="lv-scope__footer" style={{ marginTop: 0 }}>
          실제로 쓰시는 양식에 맞추고 싶습니다. 다만 지금 단계에서는{" "}
          <strong>실제 직원 자료를 받지 않습니다.</strong>{" "}
          <strong>직원정보를 모두 지운 빈 양식</strong>이나{" "}
          <strong>가상값으로 바꾼 예시</strong>로 부탁드립니다. 엑셀은 숨김 시트와 메모에도
          정보가 남을 수 있습니다.
        </p>
      </section>

      <footer className="lv-foot">
        <p>
          <Link href="/tools/leave/settlement">퇴직 재정산 화면 →</Link>
        </p>
        <p>법적 기준 최종 확인은 공인노무사 검토를 거칩니다.</p>
      </footer>
    </main>
  );
}
