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
      description="작업자 최소정보, 국적, 언어, 신규 여부, 교육 확인 상태를 현장 전파와 안전교육 기록에 연결합니다."
      status="partial"
      mappedTo="현재 작업 기준 · /api/workers · /api/education-records"
      activeHref="/workers"
      actions={<Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <CurrentWorkersModule sample={data} />
    </SafeClawModuleShell>
  );
}
