import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

const triad = [
  {
    label: "01",
    title: "위험성평가표",
    body: "4M 위험요인을 구분하고, 위험도와 감소대책을 현장 확인 가능한 문장으로 정리합니다.",
    points: ["작업조건", "유해·위험요인", "감소대책", "확인 근거"]
  },
  {
    label: "02",
    title: "TBM",
    body: "작업반장이 바로 읽고 확인할 수 있도록 질문, 조치, 참석자 확인 흐름을 분리합니다.",
    points: ["오늘 작업", "핵심 위험", "확인 질문", "참석자 확인"]
  },
  {
    label: "03",
    title: "외국인 전송본",
    body: "쉬운 한국어와 주요 언어 메시지를 분리하고, 관리자 확인 문구를 함께 제공합니다.",
    points: ["쉬운 한국어", "언어별 메시지", "관리자 확인", "전파 문구"]
  }
];

const secondaryDocs = ["점검결과 요약", "작업계획서", "TBM 기록", "안전보건교육 기록", "비상대응", "사진/증빙", "외국인 출력본", "현장 공유 메시지"];

export default function PreviewPage() {
  return (
    <SafeClawModuleShell
      eyebrow="핵심 산출물"
      title="핵심 3종."
      description="위험성평가표, TBM, 외국인 전송본은 운영자가 바로 검토할 수 있는 핵심 산출물입니다."
      status="live"
      mappedTo="위험성평가 · TBM · 현장 전파"
      activeHref="/preview"
      actions={<Link href="/documents">문서 보기</Link>}
    >
      <section className="safeclaw-module-grid three preview-triad">
        {triad.map((item) => (
          <article key={item.title} className="preview-hero-card">
            <span>{item.label}</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <div>
              {item.points.map((point) => <b key={point}>{point}</b>)}
            </div>
          </article>
        ))}
      </section>

      <section className="safeclaw-module-panel secondary-docs-card">
        <div className="compact-head">
          <span className="eyebrow">보조 산출물</span>
          <h2 className="safeclaw-section-title">접어서 제공하는 8종</h2>
        </div>
        <div className="secondary-doc-grid">
          {secondaryDocs.map((doc) => <span key={doc}>{doc}</span>)}
        </div>
      </section>
    </SafeClawModuleShell>
  );
}
