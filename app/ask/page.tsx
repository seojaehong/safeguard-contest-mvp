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
          <span className="badge">보조 화면</span>
          <span className="badge">질문형 응답 데모</span>
        </div>
        <h1 className="title small-title">질문형 확인 화면</h1>
        <p className="subtitle">
          메인 홈 데모에서 생성한 산출물을 보완하는 화면입니다. 심사 시에는 복잡한 질의도 근거 기반으로 정리할 수 있다는 점을 보여주는 보조 흐름으로 사용합니다.
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
