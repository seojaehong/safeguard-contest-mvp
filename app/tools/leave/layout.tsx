import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";

import { LeaveNav } from "@/components/leave/LeaveNav";
import { WorkspaceBar } from "@/components/leave/WorkspaceBar";

/**
 * 연차 도구 공통 골격 — 어느 화면에 들어와도 「무엇을 하는 서비스인지」가 보이게 한다.
 * 도구 화면만 덜렁 열리면 처음 온 사람은 여기가 어디인지 모른다.
 *
 * 이용 통계는 이 골격 안에서만 켠다(사이트 전체가 아니라 도구 화면 한정).
 * 무엇을 보내지 않는지는 `lib/leave-analytics.ts` 주석에 적어 두었다.
 */
export default function LeaveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lv-shell">
      <LeaveNav />
      <WorkspaceBar />
      {children}
      <Analytics />
    </div>
  );
}
