import type { Metadata } from "next";
import Link from "next/link";

import { ReportsDownloadCenter } from "@/components/ReportsDownloadCenter";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const metadata: Metadata = {
  title: "SafeClaw 리포트 · 다운로드 센터",
  description: "위험성평가 As-Is/To-Be와 승인된 사진을 기간·분류별로 내려받습니다."
};

export default function ReportsPage() {
  return (
    <SafeClawModuleShell
      eyebrow="리포트"
      title="개선 리포트."
      description="주간·월간·사용자 기간의 위험성평가와 승인된 개선 근거를 분류별로 정리합니다."
      status="partial"
      mappedTo="기간 리포트 · 다운로드"
      activeHref="/reports"
      variant="document"
      actions={<Link href="/workspace">작업공간에서 개선 추가</Link>}
    >
      <ReportsDownloadCenter />
    </SafeClawModuleShell>
  );
}
