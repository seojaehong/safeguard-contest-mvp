import Link from "next/link";
import { CurrentDispatchModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function DispatchPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="Dispatch"
      title="현장 전파."
      description="메일과 문자 전송 흐름을 기존 n8n dispatch API와 전파 로그 API에 연결합니다. 카카오와 밴드는 준비 중으로 잠급니다."
      status="live"
      mappedTo="WorkflowSharePanel · /api/workflow/dispatch · /api/dispatch-logs"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <CurrentDispatchModule sample={data} />
    </SafeClawModuleShell>
  );
}
