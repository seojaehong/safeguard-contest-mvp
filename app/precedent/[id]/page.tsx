import { notFound } from "next/navigation";
import { loadDetail } from "@/lib/search";

export default async function PrecedentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadDetail(id);
  if (!item || item.type !== "precedent") return notFound();

  return (
    <main className="container grid">
      <div className="row"><span className="badge">판례 상세</span>{item.citation ? <span className="badge">{item.citation}</span> : null}</div>
      <section className="card list">
        <div className="h2">{item.title}</div>
        <div className="muted">{item.summary}</div>
        <hr />
        <div className="h3">판단 포인트</div>
        <ul>{item.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <hr />
        <div className="h3">요약 본문</div>
        <pre>{item.body}</pre>
        {item.sourceUrl ? <a className="button secondary" href={item.sourceUrl} target="_blank">원문 출처</a> : null}
      </section>
    </main>
  );
}
