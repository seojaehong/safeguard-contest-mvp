import type { Metadata } from "next";
import Link from "next/link";

import { ReportsDownloadCenter } from "@/components/ReportsDownloadCenter";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const metadata: Metadata = {
  title: "SafeClaw 리포트 · 다운로드 센터",
  description: "현재 작업팩의 위험성평가, 개선사항, 기간별 요약을 다운로드합니다."
};

export default function ReportsPage() {
  return (
    <SafeClawModuleShell
      eyebrow="리포트"
      title="개선 리포트."
      description="위험성평가, TBM, 개선사항을 현재 작업팩 기준으로 짧게 정리합니다."
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
