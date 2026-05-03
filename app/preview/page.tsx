import Link from "next/link";

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
    <main className="v2-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeClaw 홈">
          <span className="brand-mark">S</span>
          <span><strong>SafeClaw</strong><small>핵심 3종</small></span>
        </Link>
        <nav>
          <Link href="/workspace">작업공간</Link>
          <Link href="/why">차별성</Link>
          <Link href="/trust">신뢰</Link>
          <Link href="/roadmap">로드맵</Link>
        </nav>
      </header>

      <section className="v2-hero card">
        <span className="eyebrow">제품 완성도 기준</span>
        <h1>핵심 3종은 완성품처럼, 나머지는 보조 산출물로 명확히 보여줍니다.</h1>
        <p>위험성평가표, TBM, 외국인 전송본은 발표 어느 순간에 보여도 제품의 가치를 전달해야 합니다.</p>
      </section>

      <section className="preview-triad">
        {triad.map((item) => (
          <article key={item.title} className="card preview-hero-card">
            <span>{item.label}</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <div>
              {item.points.map((point) => <b key={point}>{point}</b>)}
            </div>
          </article>
        ))}
      </section>

      <section className="card secondary-docs-card">
        <div className="compact-head">
          <span className="eyebrow">보조 산출물</span>
          <strong>접어서 제공하는 8종</strong>
        </div>
        <div className="secondary-doc-grid">
          {secondaryDocs.map((doc) => <span key={doc}>{doc}</span>)}
        </div>
      </section>
    </main>
  );
}
