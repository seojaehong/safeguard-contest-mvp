import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { TbmSampleAwareBoard } from "@/components/PublicSampleBoards";

export default function TbmFullscreenPage() {
  return (
    <SafeClawModuleShell
      eyebrow="TBM 모드"
      title="TBM 풀스크린."
      description="현장에서 크게 띄워 읽는 작업 전 안전점검회의 화면입니다. TBM 질문과 필수조치를 회의용으로 압축합니다."
      status="planned"
      mappedTo="작업 전 회의 · 확인 질문 · 참석자 확인"
      activeHref="/tbm"
      actions={<Link href="/documents">TBM 문서 편집</Link>}
    >
      <TbmSampleAwareBoard />
    </SafeClawModuleShell>
  );
}
