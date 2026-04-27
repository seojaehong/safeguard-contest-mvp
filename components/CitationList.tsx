import { SearchResult } from "@/lib/types";
import Link from "next/link";
import type { Route } from "next";

function getCitationHref(item: SearchResult): Route {
  if (item.type === "law") return `/law/${item.id}` as Route;
  if (item.type === "precedent") return `/precedent/${item.id}` as Route;
  return `/interpretation/${item.id}` as Route;
}

function describeRelevance(item: SearchResult, question?: string) {
  const normalizedQuestion = (question || "").toLowerCase();
  const tags = item.tags || [];

  if (item.type === "precedent") {
    if (tags.some((tag) => tag.includes("작업위험 매핑") || tag.includes("Law.go 판례검색"))) {
      return "Law.go 판례검색으로 현재 작업의 위험요인과 유사한 안전조치·교육·보호구 쟁점을 매핑한 근거입니다.";
    }
    return "사고 이후 책임 판단에서 어떤 안전조치가 문제 되는지 확인해 문서 문구를 보강하는 근거입니다.";
  }
  if (normalizedQuestion.includes("강풍") || normalizedQuestion.includes("돌풍")) {
    return "오늘 작업의 기상 위험과 연결해 즉시 조치 기준을 설명하는 근거입니다.";
  }
  if (normalizedQuestion.includes("비계") || normalizedQuestion.includes("추락")) {
    return "추락·전도 위험을 위험성평가와 TBM 문안으로 번역할 때 참고하는 근거입니다.";
  }
  if (tags.some((tag) => tag.includes("보강검색"))) {
    return "기본 Law.go 흐름에 추가로 보강된 근거로, 설명 가능성을 높이는 역할을 합니다.";
  }
  return "현재 작업 조건과 유사한 위험 판단 기준을 빠르게 확인하기 위한 근거입니다.";
}

export function CitationList({ citations, question }: { citations: SearchResult[]; question?: string }) {
  return (
    <div className="card list">
      <div className="h3">근거 출처</div>
      <div className="muted small">법령, 판례, 해석례를 묶어 현재 작업의 위험 판단과 산출물 문구를 뒷받침합니다.</div>
      {citations.map((c) => {
        const href = getCitationHref(c);
        return (
          <Link key={c.id} href={href} className="list citation-item">
            <div className="row">
              <span className="badge">{c.type === "law" ? "법령" : c.type === "precedent" ? "판례" : "해석례"}</span>
              <span className="badge">{c.sourceLabel}</span>
              {c.tags?.some((tag) => tag.includes("작업위험 매핑")) ? <span className="badge">작업위험 매핑</span> : null}
            </div>
            <strong>{c.title}</strong>
            <span className="muted">{c.summary}</span>
            <span className="small relevance-note">{describeRelevance(c, question)}</span>
          </Link>
        );
      })}
    </div>
  );
}
