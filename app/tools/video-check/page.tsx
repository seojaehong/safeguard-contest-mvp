import type { Metadata } from "next";
import Link from "next/link";

import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { VideoHazardCheck } from "@/components/VideoHazardCheck";

export const metadata: Metadata = {
  title: "동영상 위험 점검 | SafeClaw",
  description: "현장 동영상에서 장면을 골라 위험 후보·장면 시각·근거 조문·현장 확인 목록을 정리합니다. 원본 영상은 서버로 올리지 않습니다.",
  robots: { index: false, follow: false }
};

export default function VideoCheckPage() {
  return (
    <SafeClawModuleShell
      eyebrow="동영상 위험 점검"
      title="현장 동영상에서 위험 장면을 골라 정리합니다."
      description="1~3분 영상을 올리면 브라우저에서 장면을 골라 사진 위험분석으로 보내고, 시각별 위험·조치 표와 현장 확인 목록을 만듭니다."
      status="partial"
      mappedTo="장면 선별 · 사진 위험분석 · 근거 조문 · 현장 확인"
      activeHref="/tools/video-check"
      actions={<Link href="/privacy">개인정보 처리방침</Link>}
    >
      <section className="safeclaw-module-panel">
        <VideoHazardCheck />
      </section>
    </SafeClawModuleShell>
  );
}
