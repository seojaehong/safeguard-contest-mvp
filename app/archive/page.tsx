import Link from "next/link";
import { CurrentArchiveModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function ArchivePage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="이력"
      title="이력·아카이브."
      description="최근 문서팩, 근거 확인, 전파 로그를 다시 열어 제출 전 기록 흐름을 확인합니다."
      status="partial"
      mappedTo="문서팩 이력 · 근거 확인 · 전파 로그"
      activeHref="/archive"
      actions={<Link href="/workspace#history">작업공간 이력 저장</Link>}
    >
      <CurrentArchiveModule sample={data} />
    </SafeClawModuleShell>
  );
}
