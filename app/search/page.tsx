import { SearchBox } from "@/components/SearchBox";
import { ResultCard } from "@/components/ResultCard";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { runSearch } from "@/lib/search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  const results = await runSearch(q);

  return (
    <SafeClawModuleShell
      eyebrow="근거 검색"
      title="근거 검색."
      description="위험성평가, TBM, 안전교육 문구에 연결할 법령·판례·해석례 근거를 확인합니다."
      status="partial"
      mappedTo="법령 · 판례 · 해석례"
      activeHref="/search"
    >
      <SearchBox initialQuery={q} />
      <section className="safeclaw-module-panel">
        <span>검색 결과</span>
        <h2>{results.length}건</h2>
        <p>법제처 법령정보를 우선 확인하고, 설정된 보조 근거가 있으면 판례·해석례를 함께 정리합니다.</p>
      </section>
      <section className="safeclaw-module-grid two">
        {results.map((item) => <ResultCard key={item.id} item={item} />)}
      </section>
    </SafeClawModuleShell>
  );
}
