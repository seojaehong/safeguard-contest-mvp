import Link from "next/link";
import { CurrentDispatchModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function DispatchPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="현장 전파"
      title="현장 전파."
      description="메일과 문자 전송은 현재 작업 문서팩이 있을 때 활성화합니다. 카카오와 밴드는 준비 중으로 잠급니다."
      status="partial"
      mappedTo="현재 작업 기준 · /api/workflow/dispatch · /api/dispatch-logs"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <CurrentDispatchModule sample={data} />
    </SafeClawModuleShell>
  );
}
