import Link from "next/link";
import { CurrentEvidenceModule } from "@/components/CurrentWorkpackModules";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const data = buildSampleWorkpack();
  const stats = await getSafetyReferenceStats();

  return (
    <SafeClawModuleShell
      eyebrow="근거"
      title="근거 라이브러리."
      description="법령, 해석례, 판례, KOSHA 자료, 재해사례를 문서 문장에 연결하고 어떤 항목에 반영됐는지 확인합니다."
      status="partial"
      mappedTo="CitationList · 지식 DB · 법령/해석례/재해사례"
      activeHref="/evidence"
      actions={<Link href="/knowledge">지식 DB 열기</Link>}
    >
      <section className="safeclaw-module-grid four">
        <article><span>적재 자료</span><strong>{stats.items.toLocaleString("ko-KR")}건</strong></article>
        <article><span>KOSHA 기술지원</span><strong>{stats.technicalTotal.toLocaleString("ko-KR")}건</strong></article>
        <article><span>규정/지침</span><strong>{stats.technicalSupportRegulations}/{stats.technicalGuidelines}</strong></article>
        <article><span>상태</span><strong>{stats.ok ? "연결됨" : "점검 필요"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>마이그레이션 지식 DB</span>
        <h2>{stats.message}</h2>
        <p>문서 보완 생성과 근거 탐색은 이 Supabase 지식 DB를 우선 조회하고, 부족한 경우 기존 법령·KOSHA 근거를 함께 사용합니다.</p>
      </section>
      <CurrentEvidenceModule sample={data} />
    </SafeClawModuleShell>
  );
}
