import type { Metadata } from "next";
import Link from "next/link";
import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { runAsk } from "@/lib/search";

export const metadata: Metadata = {
  title: "안전 질의 | SafeClaw",
  description: "현장 상황을 질문하면 법령·기상·교육 근거와 함께 안전 조치 답변을 제공하는 안전 질의 페이지입니다."
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "하청 작업에서 원청의 안전보건 책임을 실무적으로 어떻게 확인해야 하나요?";
  const data = await runAsk(q);

  return (
    <SafeClawModuleShell
      eyebrow="근거 질의"
      title="질문형 확인."
      description="법령·해석례·판례 근거를 먼저 고정하고, 문서팩 작성 전 현장 판단을 보조합니다."
      status="partial"
      mappedTo="근거 검색 · 답변 · 인용 자료"
      activeHref="/ask"
      actions={<Link href="/search">근거 검색</Link>}
    >
      <section className="safeclaw-module-panel">
        <span>현재 질문</span>
        <h2>문서 작성 전에 판단할 쟁점입니다.</h2>
        <pre>{q}</pre>
      </section>
      <section className="safeclaw-module-grid two">
        <AnswerPanel data={data} />
        <CitationList citations={data.citations} question={q} />
      </section>
    </SafeClawModuleShell>
  );
}
