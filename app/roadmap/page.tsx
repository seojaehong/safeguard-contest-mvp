import Link from "next/link";

const roadmap = [
  ["1단계", "데모 레이어", "/demo, /why, /preview, /trust, /roadmap으로 제품 설명력을 확보합니다."],
  ["2단계", "재방문", "Site와 DailyEntry로 같은 현장을 다음 날 다시 열 수 있게 합니다."],
  ["3단계", "SSOT", "SharedContext에서 공통 필드를 한 번 수정하고 문서에 반영합니다."],
  ["4단계", "증빙", "EvidenceLibrary와 AuditTrail로 기록과 확인 흐름을 남깁니다."],
  ["5단계", "팀 운영", "결재선, 다현장 대시보드, 월간 리포트로 확장합니다."]
];

export default function RoadmapPage() {
  return (
    <main className="v2-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeGuard 홈">
          <span className="brand-mark">S</span>
          <span><strong>SafeGuard</strong><small>실행 로드맵</small></span>
        </Link>
        <nav>
          <Link href="/demo">데모</Link>
          <Link href="/why">차별성</Link>
          <Link href="/preview">핵심 3종</Link>
          <Link href="/trust">신뢰</Link>
        </nav>
      </header>

      <section className="v2-hero card">
        <span className="eyebrow">투자 이후 실행계획</span>
        <h1>v2는 제품 설명력을 만들고, v1 운영 로드맵은 재방문과 이력을 완성합니다.</h1>
        <p>이번 업그레이드는 과장된 기능 목록이 아니라 후속 개발 우선순위를 제품 안에서 확인할 수 있게 만드는 작업입니다.</p>
      </section>

      <section className="roadmap-list">
        {roadmap.map(([label, title, body]) => (
          <article key={label} className="card roadmap-item">
            <span>{label}</span>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="v2-link-band card">
        <strong>첫 화면에서 바로 보여줄 것은 데모입니다.</strong>
        <Link className="button" href="/demo">30초 시연 열기</Link>
      </section>
    </main>
  );
}
