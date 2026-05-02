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
      description="작업자 최소정보, 언어, 교육 확인 상태를 현재 작업 기준으로 보여줍니다. 실제 저장은 작업공간 저장 흐름과 같은 API를 사용합니다."
      status="partial"
      mappedTo="현재 작업 기준 · /api/workers · /api/education-records"
      actions={<Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <CurrentWorkersModule sample={data} />
    </SafeClawModuleShell>
  );
}
