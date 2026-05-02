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
      description="메일과 문자로 현장 공지와 외국인 안내문을 보내고, 채널별 접수 결과를 작업 기록으로 남깁니다."
      status="partial"
      mappedTo="현재 작업 기준 · /api/workflow/dispatch · /api/dispatch-logs"
      activeHref="/dispatch"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <CurrentDispatchModule sample={data} />
    </SafeClawModuleShell>
  );
}
