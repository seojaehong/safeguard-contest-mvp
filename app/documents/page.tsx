import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { CurrentDocumentsModule } from "@/components/CurrentWorkpackModules";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function DocumentsPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="문서팩"
      title="문서 편집."
      description="위험성평가표, 작업계획서, TBM, 안전보건교육 기록을 한 화면에서 편집하고 PDF, XLS, HWPX 제출본으로 출력합니다."
      status="live"
      mappedTo="편집 · 보완 · PDF/XLS/HWPX 출력"
      activeHref="/documents"
    >
      <CurrentDocumentsModule sample={data} />
    </SafeClawModuleShell>
  );
}
