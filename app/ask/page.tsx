import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { runAsk } from "@/lib/search";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "하청 작업에서 원청의 안전보건 책임을 실무적으로 어떻게 확인해야 하나요?";
  const data = await runAsk(q);

  return (
    <main className="container grid">
      <section className="hero grid">
        <div className="row">
          <span className="badge">근거 기반 질의</span>
          <span className="badge">현장 판단 보조</span>
        </div>
        <h1 className="title small-title">질문형 확인 화면</h1>
        <p className="subtitle">
          복잡한 현장 질문을 법령·해석례·판례 근거와 함께 정리해 문서팩 작성 전 판단을 보조합니다.
        </p>
        <div className="card list surface">
          <div className="h3">질문 예시</div>
          <pre>{q}</pre>
        </div>
      </section>
      <div className="two">
        <AnswerPanel data={data} />
        <CitationList citations={data.citations} question={q} />
      </div>
    </main>
  );
}
