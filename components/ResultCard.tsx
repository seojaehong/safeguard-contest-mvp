import Link from "next/link";
import type { Route } from "next";
import { SearchResult } from "@/lib/types";

function getDetailHref(item: SearchResult): Route {
  if (item.type === "law") return `/law/${item.id}` as Route;
  if (item.type === "precedent") return `/precedent/${item.id}` as Route;
  return `/interpretation/${item.id}` as Route;
}

function getTypeLabel(item: SearchResult) {
  if (item.type === "law") return "법령";
  if (item.type === "precedent") return "판례";
  return "해석례";
}

function getRelevanceText(item: SearchResult) {
  if (item.type === "law") {
    return "현장 조치와 위험성평가 문구를 법령 근거로 고정할 때 먼저 보는 기준입니다.";
  }
  if (item.type === "precedent") {
    return "실제 분쟁·사고 판단 관점을 보여줘 실무 설명력을 높이는 참고 근거입니다.";
  }
  return "유권해석 성격의 참고 자료로, 실무 표현을 더 안전하게 다듬는 데 유용합니다.";
}

export function ResultCard({ item }: { item: SearchResult }) {
  const href = getDetailHref(item);
  return (
    <Link href={href} className="card list">
      <div className="row">
        <span className="badge">{getTypeLabel(item)}</span>
        <span className="badge">{item.sourceLabel}</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
      </div>
      <div className="h3">{item.title}</div>
      <div className="muted">{item.summary}</div>
      <div className="small relevance-note">{getRelevanceText(item)}</div>
      {item.tags?.length ? <div className="row">{item.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div> : null}
    </Link>
  );
}
