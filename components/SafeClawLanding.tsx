"use client";

import Link from "next/link";

const navItems = [
  ["시스템", "system"],
  ["선언", "manifesto"],
  ["실행", "execution"],
  ["언어", "language"],
  ["도입사례", "proof"],
  ["작업공간", "workspace"]
] as const;

const pipeline = [
  { code: "01 · CAPTURE", title: "캡처", body: "현장 작업 한 줄을 캡처합니다.", metric: "입력" },
  { code: "02 · CITE", title: "인용", body: "산안법·KOSHA·공공 API 근거를 연결합니다.", metric: "근거" },
  { code: "03 · GENERATE", title: "생성", body: "같은 사실관계로 문서팩을 동시 생성합니다.", metric: "11종" },
  { code: "04 · BROADCAST", title: "전파", body: "작업자 언어와 채널에 맞게 나눠 보냅니다.", metric: "10개 언어" },
  { code: "05 · SEAL", title: "봉인", body: "서명·시각·전파 이력을 기록합니다.", metric: "제출 준비" }
];

const proofSources = [
  ["L.14991", "산업안전보건법", "법령 조항"],
  ["KOSHA-2024", "KOSHA Guide", "공식자료"],
  ["MOEL", "고용노동부 고시", "교육·지침"],
  ["KMA", "기상청", "현재·예보"],
  ["WORK24", "고용24", "후속 교육"],
  ["AI", "Gemini", "문서 초안"]
];

const languages = [
  ["KO", "한국어", "오늘의 안전 수칙"],
  ["VI", "Tiếng Việt", "Quy tắc an toàn hôm nay"],
  ["TH", "ภาษาไทย", "กฎความปลอดภัยวันนี้"],
  ["UZ", "O'zbek", "Bugungi xavfsizlik qoidalari"],
  ["MN", "Монгол", "Өнөөдрийн аюулгүй"],
  ["ZH", "中文", "今日安全守则"],
  ["KM", "ភាសាខ្មែរ", "ច្បាប់សុវត្ថិភាពថ្ងៃនេះ"],
  ["NE", "नेपाली", "आजको सुरक्षा नियम"],
  ["ID", "Bahasa", "Aturan keselamatan"],
  ["MY", "မြန်မာ", "ယနေ့ဘေးကင်းရေး"]
];

function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SafeClawLanding() {
  return (
    <main className="safeclaw-landing" aria-label="SafeClaw 회사 홈페이지">
      <header className="safeclaw-landing-nav">
        <Link href="/" className="safeclaw-os-brand" aria-label="SafeClaw OS 홈">
          <span className="safeclaw-os-mark">SC</span>
          <strong>safeclaw/<em>os</em></strong>
        </Link>
        <nav aria-label="SafeClaw 홈페이지 메뉴">
          {navItems.map(([label, id]) => (
            id === "workspace"
              ? <Link key={id} href="/workspace">{label}</Link>
              : <button key={id} type="button" onClick={() => jumpTo(id)}>{label}</button>
          ))}
        </nav>
        <div className="safeclaw-landing-actions">
          <Link href="/workspace" className="safeclaw-login">로그인</Link>
          <Link href="/workspace" className="safeclaw-contact">도입 문의 →</Link>
        </div>
      </header>

      <section className="safeclaw-os-hero" id="system">
        <div className="safeclaw-os-status">
          <span><i /> 시스템 · 정상 가동</span>
          <b>REGION · KR-CENTRAL</b>
          <b>V2.4.0-STABLE</b>
          <b>UTC+9 · 2026-05-02</b>
        </div>
        <div className="safeclaw-os-hero-body">
          <div>
            <span className="safeclaw-os-tag">산업안전 · 현장 운영 체제</span>
            <h1>
              서류는<br />
              <mark>안전이 아니다.</mark><br />
              실행만이 안전이다.
            </h1>
            <p>safeclaw는 산업 현장의 운영 체제입니다.</p>
            <p>한 줄 입력으로 위험성평가, TBM, 안전교육, 외국인 전파, 증빙 이력까지 연결합니다.</p>
            <div className="safeclaw-os-cta">
              <Link href="/workspace" className="primary">14일 무료 체험 →</Link>
              <Link href="/demo">30초 데모</Link>
            </div>
          </div>
          <aside className="safeclaw-os-console" aria-label="실행 콘솔">
            <span>safeclaw@field-os ~ %</span>
            <b># 버튼을 눌러 실제 작업공간을 여세요.</b>
            <Link href="/workspace">작업공간 열기</Link>
          </aside>
        </div>
      </section>

      <section className="safeclaw-os-section" id="manifesto">
        <div className="safeclaw-os-section-head">
          <span>§ 01</span>
          <b>선언</b>
        </div>
        <h2>한 줄 입력에서 봉인된 영수증까지,<br /><mark>5단계 파이프라인</mark>으로.</h2>
        <div className="safeclaw-pipeline-grid">
          {pipeline.map((item) => (
            <article key={item.code}>
              <span>{item.code}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <b>{item.metric}</b>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section compact" id="execution">
        <div className="safeclaw-os-section-head">
          <span>§ 02</span>
          <b>학습된 코퍼스 · 인용 가능 근거</b>
        </div>
        <div className="safeclaw-proof-matrix">
          {proofSources.map(([code, title, meta]) => (
            <article key={code}>
              <span>{code}</span>
              <h3>{title}</h3>
              <p>{meta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section" id="language">
        <div className="safeclaw-os-section-head">
          <span>§ 03</span>
          <b>언어</b>
        </div>
        <h2>외국인 작업자에게<br /><mark>"알아서 통역"</mark>은 끝났습니다.</h2>
        <div className="safeclaw-language-matrix">
          {languages.map(([code, title, sub]) => (
            <article key={code}>
              <span>{code}</span>
              <h3>{title}</h3>
              <p>{sub}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section terminal" id="proof">
        <div className="safeclaw-os-section-head">
          <span>§ 04</span>
          <b>실행</b>
        </div>
        <h2>작업 명령. <mark>실행.</mark></h2>
        <div className="safeclaw-terminal">
          <div><span /> <span /> <span /> <b>safeclaw@field-os ~ %</b><em>접속됨</em></div>
          <pre>{`# 샘플 작업을 실제 API 조합으로 생성합니다
질문: 서울 성수동 외벽 도장 · 이동식 비계 · 강풍 · 신규 작업자
출력: 위험성평가표 / TBM / 안전교육 / 외국인 전송본 / 현장 전파 메시지`}</pre>
          <Link href="/workspace?scenario=seoul-construction-windy">샘플 작업 생성으로 이동 →</Link>
        </div>
      </section>
    </main>
  );
}
