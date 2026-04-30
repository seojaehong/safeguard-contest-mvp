import Link from "next/link";

const trustItems = [
  ["인터뷰 인사이트", "실제 현장 담당자 인터뷰에서 확인한 반복 문서 작성, 외국인 교육, 제출 부담을 익명화해 정리합니다."],
  ["공식 근거", "법령, 기상, 교육, KOSHA 자료가 어느 문서에 반영됐는지 추적합니다."],
  ["동의 관리", "외부 공개 인용, 로고, 자문 정보는 사전 동의가 있는 항목만 표시합니다."],
  ["면책 고지", "모든 출력물은 공식 근거 기반 보조자료이며 현장 확인 후 사용해야 함을 명시합니다."]
];

const interviewQuestions = ["가장 오래 걸리는 안전 문서 업무", "외국인 교육 전달 방식", "원청 또는 관공서 제출 부담", "새 도구 도입 승인자", "베타 참여 조건"];

export default function TrustPage() {
  return (
    <main className="v2-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeGuard 홈">
          <span className="brand-mark">S</span>
          <span><strong>SafeGuard</strong><small>신뢰 기준</small></span>
        </Link>
        <nav>
          <Link href="/demo">데모</Link>
          <Link href="/why">차별성</Link>
          <Link href="/preview">핵심 3종</Link>
          <Link href="/roadmap">로드맵</Link>
        </nav>
      </header>

      <section className="v2-hero card">
        <span className="eyebrow">검증과 고지</span>
        <h1>제품에서 확인 가능한 증거와 검증 예정 항목을 분리합니다.</h1>
        <p>신뢰 페이지는 과장된 장식이 아니라, 인터뷰·근거·동의·면책을 관리하는 공개 기준입니다.</p>
      </section>

      <section className="trust-grid">
        {trustItems.map(([title, body]) => (
          <article key={title} className="card">
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="card interview-card">
        <div className="compact-head">
          <span className="eyebrow">인터뷰 스크립트</span>
          <strong>검증할 질문</strong>
        </div>
        <div className="interview-question-list">
          {interviewQuestions.map((question, index) => (
            <span key={question}>{String(index + 1).padStart(2, "0")} · {question}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
