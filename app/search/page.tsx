import { headers } from "next/headers";
import { SearchBox } from "@/components/SearchBox";
import { ResultCard } from "@/components/ResultCard";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { createPublicPageAdmissionRequest, readPublicAdmissionMessage } from "@/lib/public-page-admission";
import { runPublicLegalSearchOperation } from "@/lib/public-search-operation";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "";
  const incomingHeaders = await headers();
  const request = createPublicPageAdmissionRequest("/search", incomingHeaders.entries());
  const operation = await runPublicLegalSearchOperation({ request, query: q });
  const admissionMessage = operation.ok ? null : await readPublicAdmissionMessage(operation.response);
  const results = operation.ok ? operation.results : [];

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
      {operation.ok ? (
        <section className="safeclaw-module-grid two">
          {results.map((item) => <ResultCard key={item.id} item={item} />)}
        </section>
      ) : (
        <section className="safeclaw-module-panel" role="status">
          <span>요청 보호</span>
          <h2>검색 작업을 잠시 보류했습니다.</h2>
          <p>{admissionMessage}</p>
        </section>
      )}
    </SafeClawModuleShell>
  );
}
