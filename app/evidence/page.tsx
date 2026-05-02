import Link from "next/link";
import { CitationList } from "@/components/CitationList";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function EvidencePage() {
  const data = buildSampleWorkpack();
  const koshaReferences = data.externalData.kosha.references.slice(0, 3);
  const accidentCases = data.externalData.accidentCases.cases.slice(0, 3);

  return (
    <SafeClawModuleShell
      eyebrow="Evidence Library"
      title="근거 라이브러리."
      description="법령, 판례, 해석례, KOSHA 자료, 재해사례를 문서 문장에 연결하는 화면입니다."
      status="partial"
      mappedTo="CitationList · law/precedent/interpretation · knowledge"
      actions={<Link href="/knowledge">지식 DB 열기</Link>}
    >
      <section className="safeclaw-module-grid two">
        <article className="safeclaw-module-panel">
          <span>문서 반영 근거</span>
          <h2>KOSHA·재해사례</h2>
          <div className="safeclaw-module-list">
            {koshaReferences.length ? koshaReferences.map((item) => (
              <a key={item.title} href={item.url} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </a>
            )) : (
              <Link href="/knowledge">KOSHA 공식자료는 지식 DB와 작업공간 근거 패널에서 확인합니다.</Link>
            )}
            {accidentCases.map((item) => (
              <a key={item.title} href={item.sourceUrl || "/knowledge"} target="_blank" rel="noreferrer">
                <strong>{item.title}</strong>
                <small>{item.preventionPoint}</small>
              </a>
            ))}
          </div>
        </article>
        <CitationList citations={data.citations} question={data.question} />
      </section>
    </SafeClawModuleShell>
  );
}
