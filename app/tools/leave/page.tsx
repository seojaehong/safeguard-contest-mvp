import Link from "next/link";

import { LeaveInput } from "@/components/leave/LeaveInput";

export const metadata = {
  title: "연차 일수 계산 | SafeClaw",
  description:
    "이름과 입사일만 붙여넣으면 입사일 기준 연차 발생일수를 한 번에 계산합니다. 대장 값을 함께 넣으면 차이까지 대조합니다.",
};

export default function LeaveToolPage() {
  return (
    <main className="lv-page">
      <header className="lv-head">
        <p className="lv-head__eyebrow">노무사·인사담당자를 위한 연차 계산</p>
        <h1 className="lv-head__title">이름과 입사일만 붙여넣으세요</h1>
        <p className="lv-head__lede">
          한 명씩 계산기에 넣고 엑셀로 옮기는 일을 없앱니다. 명단을 그대로 붙여넣으면{" "}
          <strong>입사일 기준 연차일수</strong>를 한 번에 계산하고, 대장 값을 함께 넣으면{" "}
          <strong>어디가 다른지</strong>까지 짚어드립니다.
        </p>
      </header>

      <LeaveInput />

      <section className="lv-how">
        <div className="lv-how__item">
          <span className="lv-how__num">계산 기준</span>
          <p>
            근로기준법 제60조 — 1년 미만 개월당 1일(상한 11일), 1년 이상 15일, 3년 이상
            2년마다 1일 가산(상한 25일)
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">개인정보</span>
          <p>
            입력한 내용은 <strong>이 브라우저에서만</strong> 계산됩니다. 서버로 전송하지
            않고 저장하지도 않습니다
          </p>
        </div>
        <div className="lv-how__item">
          <span className="lv-how__num">이어서</span>
          <p>
            <Link href="/tools/leave/settlement">퇴직자 정산</Link> ·{" "}
            <Link href="/tools/leave/advanced">반차·출근율·사용촉진</Link>
          </p>
        </div>
      </section>

      <section className="lv-scope">
        <h2 className="lv-scope__title">이 화면의 계산 범위와 전제</h2>
        <ul className="lv-scope__list">
          <li>
            <strong>상시 5인 이상 사업장</strong>의 <strong>1주 소정근로시간 15시간 이상</strong>
            근로자를 전제로 합니다. 이 전제가 다르면 먼저 적용 여부를 확인해야 합니다
          </li>
          <li>
            입사일 기준 <strong>발생일수</strong>를 계산합니다. 이월·사용분을 뺀{" "}
            <strong>잔여일수</strong>는 다릅니다
          </li>
          <li>
            회계연도로 운영하는 사업장의 퇴직 정산은{" "}
            <Link href="/tools/leave/settlement">퇴직자 정산</Link>에서 다룹니다
          </li>
          <li>출근율 80% 미만, 육아휴직 등 특수 출결은 조건이 달라집니다</li>
          <li>회사가 법정 기준에 더해 부여한 추가 연차는 반영되지 않습니다</li>
        </ul>
        <p className="lv-scope__footer">
          이 화면은 입력값 기준의 참고 계산입니다. 개별 사안의 법적 판단이나 임금채권 확정은
          담당 공인노무사 검토를 거치시기 바랍니다.
        </p>
      </section>

      <footer className="lv-foot">
        <p>
          쓰시는 대장 양식에 맞춰 드립니다. 직원 정보를 지운 빈 양식이나 예시값으로 바꾼
          파일을 보내주시면 그에 맞춰 준비하겠습니다.
        </p>
      </footer>
    </main>
  );
}
