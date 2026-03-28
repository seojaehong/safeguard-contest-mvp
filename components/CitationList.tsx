import { SearchResult } from "@/lib/types";
import Link from "next/link";

export function CitationList({ citations }: { citations: SearchResult[] }) {
  return (
    <div className="card list">
      <div className="h3">근거 출처</div>
      {citations.map((c) => {
        const href = (c.type === "law" ? `/law/${c.id}` : `/precedent/${c.id}`) as any;
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
