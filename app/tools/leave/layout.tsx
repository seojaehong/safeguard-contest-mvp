import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 연차 도구 공통 골격 — 어느 화면에 들어와도 「무엇을 하는 서비스인지」가 보이게 한다.
 * 도구 화면만 덜렁 열리면 처음 온 사람은 여기가 어디인지 모른다.
 */
export default function LeaveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lv-shell">
      <nav className="lv-nav" aria-label="연차 점검 도구">
        <Link href="/tools/leave" className="lv-nav__brand">
          연차 점검 <span>· SafeClaw</span>
        </Link>
        <div className="lv-nav__links">
          <Link href="/tools/leave">연차 일수</Link>
          <Link href="/tools/leave/settlement">퇴직 정산</Link>
          <Link href="/tools/leave/advanced">사용단위·촉진</Link>
        </div>
      </nav>
      {children}
    </div>
  );
}
