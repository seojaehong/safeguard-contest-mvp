import { SearchBox } from "@/components/SearchBox";
import { ResultCard } from "@/components/ResultCard";
import { runSearch } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  const results = await runSearch(q);

  return (
    <main className="container grid">
      <div className="row"><span className="badge">통합 검색</span><span className="badge">Law.go-first + korean-law-mcp 보강</span></div>
      <SearchBox initialQuery={q} />
      <div className="card list">
        <div className="h3">검색 결과 {results.length}건</div>
        <div className="muted">기본 Law.go 흐름을 유지하면서, 설정 시 korean-law-mcp가 법령·판례·해석례를 추가로 보강합니다.</div>
      </div>
      <section className="list">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>
    </main>
  );
}
