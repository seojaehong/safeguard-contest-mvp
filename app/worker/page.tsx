import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { WorkerSampleAwareBoard } from "@/components/PublicSampleBoards";

export default function WorkerMobilePage() {
  return (
    <SafeClawModuleShell
      eyebrow="작업자 모바일"
      title="작업자 모바일."
      description="작업자는 긴 문서 대신 오늘의 핵심 위험, 필수조치, 이해 확인만 봅니다."
      status="planned"
      mappedTo="작업자 공지 · 이해 확인 · 언어별 안내"
      activeHref="/worker"
      actions={<Link href="/dispatch">전파 메시지 보기</Link>}
    >
      <WorkerSampleAwareBoard />
    </SafeClawModuleShell>
  );
}
