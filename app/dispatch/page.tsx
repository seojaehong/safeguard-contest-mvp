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
      description="작업자 언어와 채널별 공지 문안을 미리 보고, 실제 발송 가능 여부와 승인된 접수 결과를 구분해 기록합니다."
      status="partial"
      mappedTo="메일 · 문자 · 전파 기록"
      activeHref="/dispatch"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <CurrentDispatchModule sample={data} />
    </SafeClawModuleShell>
  );
}
