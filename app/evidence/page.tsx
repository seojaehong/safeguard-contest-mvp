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
      description="대표 작업 기준으로 법령, 해석례, 판례, KOSHA 자료, 재해사례가 문서 문장에 어떻게 연결되는지 확인합니다."
      status="partial"
      mappedTo="법령 · KOSHA · 재해사례 반영 위치"
      activeHref="/evidence"
      contextLabel="대표 작업 기준"
      actions={<Link href="/knowledge">지식 DB 열기</Link>}
    >
      <section className="safeclaw-module-grid four">
        <article><span>적재 자료</span><strong>{stats.items.toLocaleString("ko-KR")}건</strong></article>
        <article><span>KOSHA 기술지원</span><strong>{stats.technicalTotal.toLocaleString("ko-KR")}건</strong></article>
        <article><span>규정/지침</span><strong>{stats.technicalSupportRegulations}/{stats.technicalGuidelines}</strong></article>
        <article><span>상태</span><strong>{stats.ok ? "연결됨" : "점검 필요"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>안전 지식 DB</span>
        <h2>{stats.message}</h2>
        <p>문서 보완 생성과 근거 탐색은 안전 지식 DB를 우선 조회하고, 부족한 경우 기존 법령·KOSHA 근거를 함께 사용합니다.</p>
      </section>
      <section className="safeclaw-module-panel">
        <span>근거 역할 기준</span>
        <h2>직접 근거는 문서 문구, 보조 근거는 현장 판단에만 씁니다.</h2>
        <p>
          법령·KOSHA 기준과 내장 지식은 위험성평가표, 작업계획서, TBM 문구를 직접 보완하는 근거로 표시합니다.
          재해사례, 기상, 교육 추천은 유사 상황 확인과 전달 방식 조정에만 쓰며 원문 목록을 문서에 붙이지 않습니다.
        </p>
      </section>
      <CurrentEvidenceModule sample={data} />
    </SafeClawModuleShell>
  );
}
