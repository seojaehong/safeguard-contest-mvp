"use client";

import { useEffect, useState } from "react";
import { ResultCard } from "@/components/ResultCard";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { SearchBox } from "@/components/SearchBox";
import { readPublicAdmissionMessage } from "@/lib/public-page-admission";
import type { SearchResult } from "@/lib/types";

type SearchLoadState =
  | { status: "loading" }
  | { status: "ready"; results: SearchResult[] }
  | { status: "held"; message: string };

function readResults(payload: unknown): SearchResult[] {
  if (typeof payload !== "object" || payload === null || !("results" in payload)) {
    throw new Error("public legal-search response is missing results");
  }
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) throw new Error("public legal-search results are invalid");
  return results as SearchResult[];
}

export function SearchLivePage({ query }: { query: string }) {
  const [state, setState] = useState<SearchLoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const message = await readPublicAdmissionMessage(response);
        if (!controller.signal.aborted) setState({ status: "held", message });
        return;
      }
      const results = readResults(await response.json());
      if (!controller.signal.aborted) setState({ status: "ready", results });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("public legal-search page request failed", error);
      setState({
        status: "held",
        message: "검색 연결을 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.",
      });
    });
    return () => controller.abort(new Error("Search page navigation cancelled provider work"));
  }, [query]);

  const results = state.status === "ready" ? state.results : [];
  return (
    <SafeClawModuleShell
      eyebrow="근거 검색"
      title="근거 검색."
      description="위험성평가, TBM, 안전교육 문구에 연결할 법령·판례·해석례 근거를 확인합니다."
      status="partial"
      mappedTo="법령 · 판례 · 해석례"
      activeHref="/search"
    >
      <SearchBox initialQuery={query} />
      <section className="safeclaw-module-panel">
        <span>검색 결과</span>
        <h2>{state.status === "ready" ? `${results.length}건` : "확인 중"}</h2>
        <p>법제처 법령정보를 우선 확인하고, 설정된 보조 근거가 있으면 판례·해석례를 함께 정리합니다.</p>
      </section>
      {state.status === "ready" ? (
        <section className="safeclaw-module-grid two">
          {results.map((item) => <ResultCard key={item.id} item={item} />)}
        </section>
      ) : state.status === "held" ? (
        <section className="safeclaw-module-panel" role="status" aria-live="polite">
          <span>요청 보호</span>
          <h2>검색 작업을 잠시 보류했습니다.</h2>
          <p>{state.message}</p>
        </section>
      ) : (
        <section className="safeclaw-module-panel" role="status" aria-live="polite" aria-busy="true">
          <span>근거 연결</span>
          <h2>검색 근거를 확인하고 있습니다.</h2>
        </section>
      )}
    </SafeClawModuleShell>
  );
}
