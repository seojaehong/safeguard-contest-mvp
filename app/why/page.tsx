import Link from "next/link";

const comparisonRows = [
  ["한 줄 입력에서 문서팩 생성", "지원", "부분 지원", "직접 작성", "프롬프트 의존"],
  ["법령·기상·교육 근거 연결", "문서 문장에 연결", "제한적", "별도 검색", "별도 확인 필요"],
  ["외국인 전송본", "주요 언어 제공", "제한적", "직접 번역", "프롬프트 의존"],
  ["TBM 실행 흐름", "질문·확인·전파", "기록 중심", "수기", "별도 정리 필요"],
  ["증빙과 이력 확장성", "로드맵 포함", "제품별 상이", "파일 관리", "별도 구축"]
];

const apiCards = [
  ["기상청", "현재·예보·특보 신호를 작업중지 기준과 TBM 문구에 반영합니다."],
  ["Law.go", "법령, 판례, 해석례를 문서 반영 근거로 연결합니다."],
  ["Work24", "작업과 대상에 맞는 후속 교육 후보를 제안합니다."],
  ["KOSHA", "공식자료, 교육, 재해사례를 위험성평가와 교육기록에 연결합니다."]
];

export default function WhyPage() {
  return (
    <main className="v2-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeClaw 홈">
          <span className="brand-mark">S</span>
          <span><strong>SafeClaw</strong><small>차별성</small></span>
        </Link>
        <nav>
          <Link href="/demo">데모</Link>
          <Link href="/preview">핵심 3종</Link>
          <Link href="/trust">신뢰</Link>
          <Link href="/roadmap">로드맵</Link>
        </nav>
      </header>

      <section className="v2-hero card">
        <span className="eyebrow">왜 SafeClaw인가</span>
        <h1>검색기나 템플릿이 아니라, 현장 실행 문서팩을 만드는 작업공간입니다.</h1>
        <p>SafeClaw의 차별성은 공공데이터를 보여주는 데서 끝나지 않고, 그 근거를 위험성평가표, TBM, 교육기록, 전파 메시지의 문장으로 연결하는 데 있습니다.</p>
      </section>

      <section className="api-pulse-showcase">
        {apiCards.map(([title, body]) => (
          <article key={title} className="card api-proof-card">
            <i aria-hidden="true" />
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="card comparison-card">
        <div className="compact-head">
          <span className="eyebrow">비교</span>
          <strong>대안별 차이</strong>
        </div>
        <div className="comparison-table" role="table" aria-label="대안별 기능 비교">
          <div className="comparison-head" role="row">
            <span>기준</span>
            <span>SafeClaw</span>
            <span>안전관리 SaaS</span>
            <span>한글·엑셀 양식</span>
            <span>일반 AI</span>
          </div>
          {comparisonRows.map((row) => (
            <div key={row[0]} role="row">
              {row.map((cell) => <span key={cell}>{cell}</span>)}
            </div>
          ))}
        </div>
      </section>

      <section className="v2-link-band card">
        <strong>차별성을 30초 안에 보려면</strong>
        <Link className="button" href="/demo?speed=fast">자동 시연 열기</Link>
      </section>
    </main>
  );
}
