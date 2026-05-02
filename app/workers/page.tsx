import Link from "next/link";
import { CurrentWorkersModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function WorkersPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="Workers"
      title="작업자·교육."
      description="작업자 최소정보, 언어, 교육 확인 상태를 기존 작업공간 저장 API와 같은 구조로 보여줍니다."
      status="partial"
      mappedTo="/api/workers · /api/education-records"
      actions={<Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <CurrentWorkersModule sample={data} />
    </SafeClawModuleShell>
  );
}
