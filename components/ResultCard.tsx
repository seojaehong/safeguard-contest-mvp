import Link from "next/link";
import type { Route } from "next";
import { SearchResult } from "@/lib/types";
import { isExampleSource, sourceBadgeLabel } from "@/lib/public-screen-sample";

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
  if (isExampleSource(item)) {
    return "법령 원천에 연결되지 않은 예시 자료입니다. 문서 근거로 쓰지 말고 실제 법령·판례를 다시 확인해 주세요.";
  }
  if (item.type === "law") {
    return "현장 조치와 위험성평가 문구를 법령 근거로 고정할 때 먼저 보는 기준입니다.";
  }
  if (item.type === "precedent") {
    return "실제 분쟁·사고 판단 관점을 보여줘 실무 설명력을 높이는 참고 근거입니다.";
  }
  return "유권해석 성격의 참고 자료로, 실무 표현을 더 안전하게 다듬는 데 유용합니다.";
}

function ResultCardBody({ item }: { item: SearchResult }) {
  return (
    <>
      <div className="row">
        <span className="badge">{getTypeLabel(item)}</span>
        <span className="badge">{sourceBadgeLabel(item)}</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
      </div>
      <h3 className="h3">{item.title}</h3>
      <p className="muted result-card-copy">{item.summary}</p>
      <p className="small relevance-note result-card-copy">{getRelevanceText(item)}</p>
      {item.tags?.length ? <div className="row">{item.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div> : null}
    </>
  );
}

export function ResultCard({ item }: { item: SearchResult }) {
  // 예시(mock) 근거는 상세 화면이 없으므로 링크하지 않는다.
  if (isExampleSource(item)) {
    return (
      <article className="card list">
        <ResultCardBody item={item} />
      </article>
    );
  }
  return (
    <Link href={getDetailHref(item)} className="card list">
      <ResultCardBody item={item} />
    </Link>
  );
}
