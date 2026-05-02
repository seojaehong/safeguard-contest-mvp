import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { WorkpackEditor } from "@/components/WorkpackEditor";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function DocumentsPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="Documents"
      title="문서 편집."
      description="위험성평가표, 작업계획서, TBM, 안전보건교육 기록을 기존 문서팩 편집기와 다운로드 기능에 직접 연결했습니다."
      status="live"
      mappedTo="WorkpackEditor · PDF/XLS/HWPX"
    >
      <WorkpackEditor data={data} />
    </SafeClawModuleShell>
  );
}
