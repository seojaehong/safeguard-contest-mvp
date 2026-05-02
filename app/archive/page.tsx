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
      description="작업공간에서 생성한 최신 문서팩 스냅샷을 기준으로 이력, 근거, 전파 흐름을 다시 여는 화면입니다."
      status="partial"
      mappedTo="최근 작업 스냅샷 · 로그인 후 workpacks/dispatch_logs"
      actions={<Link href="/workspace#history">작업공간 이력 저장</Link>}
    >
      <CurrentArchiveModule sample={data} />
    </SafeClawModuleShell>
  );
}
