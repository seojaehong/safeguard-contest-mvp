import { notFound } from "next/navigation";
import { loadDetail } from "@/lib/search";

type LawBodySection = {
  title: string;
  lines: string[];
};

function parseLawBody(body: string): LawBodySection[] {
  const sections: LawBodySection[] = [];
  let current: LawBodySection = { title: "법령 원문", lines: [] };

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      if (current.lines.length) sections.push(current);
      current = { title: sectionMatch[1], lines: [] };
      continue;
    }
    if (line.trim()) current.lines.push(line);
  }

  if (current.lines.length) sections.push(current);
  return sections;
}

function lineClassName(line: string) {
  const trimmed = line.trim();
  if (/^제\d+조/.test(trimmed)) return "law-article-heading";
  if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(trimmed)) return "law-paragraph";
  if (/^\d+\./.test(trimmed)) return "law-subitem";
  if (/^[가-힣]\./.test(trimmed)) return "law-mokitem";
  if (/^- /.test(trimmed)) return "law-reflection";
  return "law-body-line";
}

function renderLawLine(line: string) {
  const trimmed = line.trim();
  if (lineClassName(line) === "law-reflection") {
    return trimmed.replace(/^- /, "");
  }
  return trimmed;
}

export default async function LawDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await loadDetail(id);
  if (!item || item.type !== "law") return notFound();
  const sections = parseLawBody(item.body);

  return (
    <main className="container grid">
      <div className="row">
        <span className="badge">법령 상세</span>
        {item.citation ? <span className="badge">{item.citation}</span> : null}
        {item.sourceLabel ? <span className="badge">{item.sourceLabel}</span> : null}
      </div>
      <section className="card list">
        <div className="h2">{item.title}</div>
        <div className="muted">{item.summary}</div>
        <hr />
        <div className="h3">핵심 포인트</div>
        <ul>{item.points.map((p) => <li key={p}>{p}</li>)}</ul>
        <hr />
        <div className="h3">원문 요약 및 문서 반영</div>
        <div className="muted small">위험성평가, TBM, 안전보건교육 기록에 어떻게 반영되는지 먼저 보고, 필요한 경우 원문 출처에서 최신 조문을 확인합니다.</div>
        <div className="law-body-viewer">
          {sections.map((section) => (
            <section className="law-body-section" key={section.title}>
              <div className="law-section-title">{section.title}</div>
              <div className="law-section-lines">
                {section.lines.map((line, lineIndex) => (
                  <p className={lineClassName(line)} key={`${section.title}-${lineIndex}`}>
                    {renderLawLine(line)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        {item.sourceUrl ? <a className="button secondary" href={item.sourceUrl} target="_blank">원문 출처</a> : null}
      </section>
    </main>
  );
}
