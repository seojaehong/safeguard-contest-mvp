import { SearchResult } from "@/lib/types";
import Link from "next/link";

function getCitationHref(item: SearchResult) {
  if (item.type === "law") return `/law/${item.id}`;
  if (item.type === "precedent") return `/precedent/${item.id}`;
  return `/interpretation/${item.id}`;
}

export function CitationList({ citations }: { citations: SearchResult[] }) {
  return (
    <div className="card list">
      <div className="h3">근거 출처</div>
      {citations.map((c) => {
        const href = getCitationHref(c) as any;
        return (
          <Link key={c.id} href={href} className="list">
            <strong>{c.title}</strong>
            <span className="muted">{c.summary}</span>
          </Link>
        );
      })}
    </div>
  );
}
