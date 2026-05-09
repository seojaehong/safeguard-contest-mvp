import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { CurrentDocumentsModule } from "@/components/CurrentWorkpackModules";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function DocumentsPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="문서팩"
      title="문서 편집."
      description="대표 작업 기준으로 위험성평가표, 작업계획서, TBM, 안전보건교육 기록을 확인합니다. 실제 문서팩은 작업공간에서 새 작업을 생성하면 이어집니다."
      status="live"
      mappedTo="편집 · 보완 · PDF/XLS/HWPX 출력"
      activeHref="/documents"
      contextLabel="대표 작업 기준"
    >
      <CurrentDocumentsModule sample={data} />
    </SafeClawModuleShell>
  );
}
