import Link from "next/link";
import { CurrentWorkersModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function WorkersPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="작업자·교육"
      title="작업자·교육."
      description="대표 작업 기준으로 작업자 최소정보, 국적, 언어, 신규 여부, 교육 확인 상태가 전파와 교육 기록에 어떻게 연결되는지 확인합니다."
      status="partial"
      mappedTo="작업자 명단 · 교육 확인 · 언어별 안내"
      activeHref="/workers"
      contextLabel="대표 작업 기준"
      actions={<Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <CurrentWorkersModule sample={data} />
    </SafeClawModuleShell>
  );
}
