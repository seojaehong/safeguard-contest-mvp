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
import { LeaveInput } from "@/components/leave/LeaveInput";
import { compareRow } from "@/lib/annual-leave";
import {
  DEMO_ROWS,
  DEMO_AS_OF,
  DEMO_WORKPLACE_NAME,
} from "@/lib/leave-demo-sample";

export const metadata = {
  title: "연차 일수 점검 | SafeClaw",
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
        <p className="lv-head__eyebrow">노무사·인사담당자를 위한 연차 점검</p>
        <h1 className="lv-head__title">
          연차 대장, 맞는지 확인하는 데 얼마나 걸리시나요
        </h1>
        <p className="lv-head__lede">
          직원 명단을 한 명씩 계산기에 넣고 엑셀로 옮기는 일을 대신합니다. 입사일만 있으면{" "}
          <strong>대장 전체를 한 번에 대조</strong>하고,{" "}
          <strong>어떤 규정을 적용했는지</strong>까지 함께 보여드립니다.
        </p>
      </header>

      <section className="lv-how">
        <div className="lv-how__item">
          <span className="lv-how__num">누가</span>
          <p>
            고객사 연차를 봐주시는 <strong>노무사</strong>, 사내 대장을 관리하는{" "}
            <strong>인사담당자</strong>
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">언제</span>
          <p>
            연차 부여·정산할 때, <strong>퇴사자 정산</strong>할 때, 노동청 점검이나 문의에
            답할 근거가 필요할 때
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">어떻게</span>
          <p>
            대장의 <strong>이름·입사일·연차일수</strong>만 있으면 됩니다. 결과는 근거와 함께
            나와 그대로 설명 자료로 쓰실 수 있습니다
          </p>
        </div>
      </section>

      <LeaveInput />

      <Foldable summary="예시로 보기 — 대장 8명을 대조하면 이렇게 나옵니다">
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

      </Foldable>

      <Foldable summary="적용 규정 — 근로기준법 제60조">
        <ul className="lv-scope__list">
          <li>1년 미만 — 계속근로 1개월당 1일, 상한 11일</li>
          <li>1년 이상 — 15일</li>
          <li>3년 이상 — 2년마다 1일 가산, 상한 25일</li>
        </ul>
        <p className="lv-scope__footer">
          계산 결과는 고용노동부 행정해석과 실무 기준에 맞춰 검증합니다.
        </p>
      </Foldable>

      <ScopeNote
        items={[
          <>
            <strong>잔여일수</strong> — 이 화면은 「발생 일수」를 봅니다. 대장의 숫자가 이월·사용을
            반영한 잔여일수라면 비교 기준이 다릅니다.
          </>,
          <>회계연도 기준으로 운영하는 사업장 — 퇴직 정산은 별도 화면에서 다룹니다</>,
          <>출근율 80% 미만 구간, 육아휴직·병휴직 등 특수 출결</>,
          <>회사가 법정 기준에 더해 부여한 추가 연차</>,
        ]}
        footer={
          <>
            실제 대장에는 이 항목들이 섞여 있습니다. 확인되지 않은 항목은{" "}
            <strong>「확인 불가」</strong>로 표시하며, 임의로 판정하지 않습니다.
          </>
        }
      />

      <section className="lv-scope">
        <h2 className="lv-scope__title">쓰시는 양식에 맞춰 드립니다</h2>
        <p className="lv-scope__footer" style={{ marginTop: 0 }}>
          사무소마다 대장 양식이 다릅니다. 쓰시는 서식을 보내주시면 그에 맞춰 준비하겠습니다.
          보내실 때는 <strong>직원 정보를 지운 빈 양식</strong>이나{" "}
          <strong>예시값으로 바꾼 파일</strong>로 부탁드립니다. 엑셀은 숨김 시트와 메모에도
          정보가 남을 수 있습니다.
        </p>
      </section>

      <footer className="lv-foot">
        <p>
          <Link href="/tools/leave/settlement">퇴직 정산 →</Link>
          {" · "}
          <Link href="/tools/leave/advanced">사용단위·촉진 점검 →</Link>
        </p>
        <p>최종 판단은 담당 공인노무사의 검토를 거칩니다.</p>
      </footer>
    </main>
  );
}
