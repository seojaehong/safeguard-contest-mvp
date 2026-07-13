import Link from "next/link";
import type { Route } from "next";
import { CurrentWorkersModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import { resolveSafeShareReturnPath } from "@/lib/workspace-pages";

export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const data = buildSampleWorkpack();
  const shareReturn = params.next ? resolveSafeShareReturnPath(params.next, "day") : null;

  return (
    <SafeClawModuleShell
      eyebrow="작업자·교육"
      title="작업자·교육."
      description="작업자 최소정보, 국적, 언어, 신규 여부, 교육 확인 상태를 현장 전파와 안전교육 기록에 연결합니다."
      status="partial"
      mappedTo="작업자 명단 · 교육 확인 · 언어별 안내"
      activeHref="/workers"
      actions={shareReturn
        ? <Link href={shareReturn as Route}>전송으로 돌아가기</Link>
        : <Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <CurrentWorkersModule sample={data} />
    </SafeClawModuleShell>
  );
}
