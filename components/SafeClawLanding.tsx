"use client";

import Link from "next/link";

const navItems = [
  ["제품", "system"],
  ["문제", "manifesto"],
  ["작동 방식", "execution"],
  ["외국인 안내", "language"],
  ["근거", "proof"],
  ["기능 구성", "product-map"],
  ["작업 시작", "workspace"]
] as const;

const pipeline = [
  { code: "01 · INPUT", title: "입력", body: "오늘 작업 내용을 한 줄로 정리합니다.", metric: "작업" },
  { code: "02 · CHECK", title: "확인", body: "법령, 기상, KOSHA, 교육 근거를 함께 확인합니다.", metric: "근거" },
  { code: "03 · DRAFT", title: "초안", body: "위험성평가, TBM, 안전교육 기록 초안을 만듭니다.", metric: "문서팩" },
  { code: "04 · SHARE", title: "전파", body: "작업자 언어와 채널에 맞는 공지 문안을 준비합니다.", metric: "다국어" },
  { code: "05 · RECORD", title: "기록", body: "전파 결과와 확인 내용을 작업 이력으로 남깁니다.", metric: "이력" }
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

const productModules = [
  { code: "01", title: "작업공간", body: "오늘 작업을 입력하고 API 근거와 문서팩 생성을 시작합니다.", href: "/workspace", state: "운영" },
  { code: "02", title: "문서", body: "위험성평가, 작업계획서, TBM, 안전교육 기록을 편집하고 출력합니다.", href: "/documents", state: "운영" },
  { code: "03", title: "근거", body: "법령, 해석례, 판례, KOSHA 자료를 문서 문장과 연결합니다.", href: "/evidence", state: "연결" },
  { code: "04", title: "인원·교육", body: "작업자, 국적, 언어, 교육 확인 상태를 최소 정보로 관리합니다.", href: "/workers", state: "연결" },
  { code: "05", title: "전파", body: "메일과 문자 전송 요청, 외국인 공지, 전파 결과를 확인합니다.", href: "/dispatch", state: "운영" },
  { code: "06", title: "기록", body: "생성한 문서팩과 전파 로그를 작업 이력으로 찾습니다.", href: "/archive", state: "정리" },
  { code: "07", title: "지식 DB", body: "법령 전문, KOSHA 자료, API 스냅샷을 지식층으로 관리합니다.", href: "/knowledge", state: "운영" },
  { code: "08", title: "API 상태", body: "기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결을 점검합니다.", href: "/ops/api", state: "점검" }
] as const;

function jumpTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SafeClawLanding() {
  return (
    <main className="safeclaw-landing" aria-label="SafeClaw 회사 홈페이지">
      <header className="safeclaw-landing-nav">
        <Link href="/" className="safeclaw-os-brand" aria-label="SafeClaw 홈">
          <span className="safeclaw-os-mark">SC</span>
          <strong>safeclaw/<em>work</em></strong>
        </Link>
        <nav aria-label="SafeClaw 홈페이지 메뉴">
          {navItems.map(([label, id]) => (
            id === "workspace"
              ? <Link key={id} href="/workspace">{label}</Link>
              : <button key={id} type="button" onClick={() => jumpTo(id)}>{label}</button>
          ))}
        </nav>
        <div className="safeclaw-landing-actions">
          <Link href="/workspace" className="safeclaw-login">작업공간</Link>
          <Link href="/workspace" className="safeclaw-contact">도입 문의 →</Link>
        </div>
      </header>

      <section className="safeclaw-os-hero" id="system">
        <div className="safeclaw-os-status">
          <span><i /> 제품 · 운영 준비</span>
          <b>REGION · KR-CENTRAL</b>
          <b>PUBLIC API · CONNECTED</b>
          <b>UPDATED · 2026-05-02</b>
        </div>
        <div className="safeclaw-os-hero-body">
          <div>
            <span className="safeclaw-os-tag">산업안전 · 현장 문서 작업공간</span>
            <h1>
              <span className="safeclaw-hero-line">오늘 작업을</span>
              <span className="safeclaw-hero-line"><mark>안전 문서팩으로</mark></span>
              <span className="safeclaw-hero-line">정리합니다.</span>
            </h1>
            <p>safeclaw는 현장관리자가 작업 전 필요한 안전 문서를 빠르게 준비하도록 돕는 웹 작업공간입니다.</p>
            <p>한 줄 입력으로 위험성평가, TBM, 안전교육, 외국인 안내문, 현장 전파 메시지 초안을 함께 생성합니다.</p>
            <div className="safeclaw-os-cta">
              <Link href="/workspace" className="primary">14일 무료 체험 →</Link>
              <Link href="/demo">30초 데모</Link>
            </div>
          </div>
          <aside className="safeclaw-os-console" aria-label="실행 콘솔">
            <span>safeclaw@workspace ~ %</span>
            <b># 버튼을 눌러 문서팩 생성 화면을 여세요.</b>
            <Link href="/workspace">작업공간 열기</Link>
          </aside>
        </div>
      </section>

      <section className="safeclaw-os-section" id="manifesto">
        <div className="safeclaw-os-section-head">
          <span>§ 01</span>
          <b>문제</b>
        </div>
        <h2>작업 전 문서와 공지를<br /><mark>한 화면에서 잇습니다.</mark></h2>
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
          <b>근거 연결</b>
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
          <b>외국인 안내</b>
        </div>
        <h2>외국인 작업자에게<br /><mark>쉬운 문장으로 전달합니다.</mark></h2>
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
          <b>근거</b>
        </div>
        <h2>법령과 공식자료를<br /><mark>문서 문장에 연결합니다.</mark></h2>
        <div className="safeclaw-terminal">
          <div><span /> <span /> <span /> <b>safeclaw@evidence ~ %</b><em>연결됨</em></div>
          <pre>{`# 근거는 별도 장식이 아니라 문서 반영 위치에 붙습니다
- 산업안전보건법: 위험성평가와 작업중지 기준
- KOSHA: 위험성평가 절차, TBM, 안전교육 항목
- 기상청: 옥외작업, 강풍, 폭염, 자외선 작업조건
- Work24: 후속 교육 추천`}</pre>
          <Link href="/evidence">근거 화면 열기 →</Link>
        </div>
      </section>

      <section className="safeclaw-os-section compact" id="product-map">
        <div className="safeclaw-os-section-head">
          <span>§ 05</span>
          <b>기능 구성</b>
        </div>
        <h2>제품 화면은<br /><mark>실제 기능 탭으로 연결합니다.</mark></h2>
        <div className="safeclaw-module-map">
          {productModules.map((module) => (
            <Link key={module.href} href={module.href}>
              <span>{module.code}</span>
              <em>{module.state}</em>
              <h3>{module.title}</h3>
              <p>{module.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="safeclaw-os-section terminal" id="start">
        <div className="safeclaw-os-section-head">
          <span>§ 06</span>
          <b>작업 시작</b>
        </div>
        <h2>샘플 작업으로<br /><mark>바로 확인합니다.</mark></h2>
        <div className="safeclaw-terminal">
          <div><span /> <span /> <span /> <b>safeclaw@workspace ~ %</b><em>준비됨</em></div>
          <pre>{`# 샘플 작업을 실제 API 조합으로 생성합니다
질문: 서울 성수동 외벽 도장 · 이동식 비계 · 강풍 · 신규 작업자
출력: 위험성평가표 / TBM / 안전교육 / 외국인 전송본 / 현장 전파 메시지`}</pre>
          <Link href="/workspace?scenario=seoul-construction-windy">샘플 작업 생성으로 이동 →</Link>
        </div>
      </section>
    </main>
  );
}
