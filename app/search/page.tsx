import { SearchBox } from "@/components/SearchBox";
import { ResultCard } from "@/components/ResultCard";
import { runSearch } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  const results = await runSearch(q);

  return (
    <main className="container grid">
      <section className="hero grid">
        <div className="row">
          <span className="badge">근거 탐색</span>
          <span className="badge">통합 근거 탐색</span>
          <span className="badge">법제처 우선 + 보조 근거</span>
        </div>
        <h1 className="title small-title">근거 검색</h1>
        <p className="subtitle">
          위험성평가, TBM, 안전교육 문구에 연결할 법령·판례·해석례 근거를 확인합니다.
        </p>
      </section>
      <SearchBox initialQuery={q} />
      <div className="card list">
        <div className="h3">검색 결과 {results.length}건</div>
        <div className="muted">법제처 법령정보를 우선 확인하고, 설정된 보조 근거가 있으면 판례·해석례를 함께 정리합니다.</div>
      </div>
      <section className="list">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>
    </main>
  );
}
