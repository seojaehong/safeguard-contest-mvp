import Link from "next/link";
import { SearchResult } from "@/lib/types";

export function ResultCard({ item }: { item: SearchResult }) {
  const href = (item.type === "law" ? `/law/${item.id}` : `/precedent/${item.id}`) as any;
  return (
    <Link href={href} className="card list">
      <div className="row">
        <span className="badge">{item.type === "law" ? "법령" : "판례"}</span>
        <span className="badge">{item.sourceLabel}</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
      </div>
      <div className="h3">{item.title}</div>
      <div className="muted">{item.summary}</div>
      {item.tags?.length ? <div className="row">{item.tags.map((tag) => <span key={tag} className="badge">{tag}</span>)}</div> : null}
    </Link>
  );
}
