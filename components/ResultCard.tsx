import Link from "next/link";
import { SearchResult } from "@/lib/types";

function getDetailHref(item: SearchResult) {
  if (item.type === "law") return `/law/${item.id}`;
  if (item.type === "precedent") return `/precedent/${item.id}`;
  return `/interpretation/${item.id}`;
}

function getTypeLabel(item: SearchResult) {
  if (item.type === "law") return "법령";
  if (item.type === "precedent") return "판례";
  return "해석례";
}

export function ResultCard({ item }: { item: SearchResult }) {
  const href = getDetailHref(item) as any;
  return (
    <Link href={href} className="card list">
      <div className="row">
        <span className="badge">{getTypeLabel(item)}</span>
        <span className="badge">{item.sourceLabel}</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
      </div>
      <div className="h3">{item.title}</div>
      <div className="muted">{item.summary}</div>
      {item.tags?.length ? <div className="row">{item.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div> : null}
    </Link>
  );
}
