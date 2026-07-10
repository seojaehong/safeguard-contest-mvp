import { notFound } from "next/navigation";
import { loadDetail } from "@/lib/search";

export default async function PrecedentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadDetail(id);
  if (!item || item.type !== "precedent") return notFound();

  return (
    <main className="container grid">
      <div className="row">
        <span className="badge">판례 상세</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
        {item.sourceLabel ? <span className="badge">{item.sourceLabel}</span> : null}
      </div>
      <section className="card list">
        <h1 className="title small-title">{item.title}</h1>
        <div className="muted">{item.summary}</div>
        <hr />
        <h2 className="h3">판단 포인트</h2>
        <ul>{item.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <hr />
        <h2 className="h3">요약 본문</h2>
        <pre>{item.body}</pre>
        {item.sourceUrl ? <a className="button secondary" href={item.sourceUrl} target="_blank">원문 출처</a> : null}
      </section>
    </main>
  );
}
