import { SearchBox } from "@/components/SearchBox";
import { ResultCard } from "@/components/ResultCard";
import { runSearch } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  const results = await runSearch(q);

  return (
    <main className="container grid">
      <div className="row"><span className="badge">통합 검색</span><span className="badge">법령 + 판례</span></div>
      <SearchBox initialQuery={q} />
      <div className="card list">
        <div className="h3">검색 결과 {results.length}건</div>
        <div className="muted">현재는 데모 모드 기준 결과를 보여주고, 내일 실데이터 키를 연결하면 같은 화면에서 라이브 검색으로 전환됩니다.</div>
      </div>
      <section className="list">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>
    </main>
  );
}
