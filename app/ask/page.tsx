import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { runAsk } from "@/lib/search";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "하청 작업에서 원청의 안전보건 책임을 실무적으로 어떻게 확인해야 하나요?";
  const data = await runAsk(q);

  return (
    <main className="container grid">
      <div className="card list">
        <div className="h3">질문형 데모</div>
        <div className="muted">질문 예시</div>
        <pre>{q}</pre>
      </div>
      <div className="two">
        <AnswerPanel data={data} />
        <CitationList citations={data.citations} />
      </div>
    </main>
  );
}
