import Link from "next/link";
import { CurrentEvidenceModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function EvidencePage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="Evidence Library"
      title="근거 라이브러리."
      description="법령, 판례, 해석례, KOSHA 자료, 재해사례를 문서 문장에 연결하는 화면입니다."
      status="partial"
      mappedTo="CitationList · law/precedent/interpretation · knowledge"
      actions={<Link href="/knowledge">지식 DB 열기</Link>}
    >
      <CurrentEvidenceModule sample={data} />
    </SafeClawModuleShell>
  );
}
