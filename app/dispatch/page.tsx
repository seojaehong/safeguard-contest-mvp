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
      description="대표 작업 기준으로 메일·문자 전파 흐름과 외국인 안내문 미리보기를 확인합니다. 카카오·밴드는 승인 전까지 준비 중으로 둡니다."
      status="partial"
      mappedTo="메일 · 문자 · 전파 기록"
      activeHref="/dispatch"
      contextLabel="대표 작업 기준"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <CurrentDispatchModule sample={data} />
    </SafeClawModuleShell>
  );
}
