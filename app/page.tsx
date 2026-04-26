import Link from "next/link";
import { CitationList } from "@/components/CitationList";
import { WorkpackEditor } from "@/components/WorkpackEditor";
import { runAsk } from "@/lib/search";

const defaultQuestion = "서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM 초안을 만들어줘.";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || defaultQuestion;
  const data = await runAsk(q);
  const primaryTraining = data.externalData.training.recommendations[0];

  return (
    <main className="product-shell">
      <header className="topbar">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">S</span>
          <span>
            <strong>SafeGuard</strong>
            <small>Safety workpack</small>
          </span>
        </Link>
        <nav className="topnav" aria-label="주요 메뉴">
          <a href="#workpack">문서팩</a>
          <a href="#references">참고자료</a>
          <Link href="/ask">질문</Link>
          <Link href="/search">근거검색</Link>
        </nav>
      </header>

      <section className="workspace-hero">
        <div className="command-panel card">
          <div className="eyebrow">작업 전 10분 정리</div>
          <h1>오늘 작업을 안전 문서팩으로 정리하세요.</h1>
          <p>
            현장 상황을 한 줄로 입력하면 위험성평가표, TBM 브리핑, 회의록,
            안전교육일지, 현장 공유 메시지까지 한 번에 준비합니다.
          </p>
          <form action="/" method="GET" className="command-form">
            <label htmlFor="q">현장 상황</label>
            <textarea
              id="q"
              name="q"
              className="textarea command-textarea"
              defaultValue={q}
              placeholder="예: 외벽 도장, 이동식 비계, 작업자 5명, 오후 강풍, 지게차 동선 혼재"
            />
            <div className="command-actions">
              <button type="submit" className="button">문서팩 생성</button>
              <a href="#workpack" className="button secondary">결과 편집</a>
            </div>
          </form>
        </div>

        <div className="today-panel card list">
          <div className="panel-heading">
            <span className="eyebrow">오늘 작업</span>
            <strong>{data.scenario.companyName}</strong>
          </div>
          <div className="summary-grid">
            <div>
              <span>현장</span>
              <strong>{data.scenario.siteName}</strong>
            </div>
            <div>
              <span>업종</span>
              <strong>{data.scenario.companyType}</strong>
            </div>
            <div>
              <span>인원</span>
              <strong>{data.scenario.workerCount}명</strong>
            </div>
            <div>
              <span>위험도</span>
              <strong>{data.riskSummary.riskLevel}</strong>
            </div>
          </div>
          <div className="risk-brief">
            <span>핵심 위험</span>
            <p>{data.riskSummary.topRisk}</p>
          </div>
        </div>

        <div className="output-panel card list">
          <div className="panel-heading">
            <span className="eyebrow">생성된 문서</span>
            <strong>5종 준비 완료</strong>
          </div>
          {[
            "위험성평가표",
            "TBM 브리핑",
            "TBM 회의록",
            "안전교육일지",
            "현장 공유 메시지"
          ].map((item) => (
            <div key={item} className="output-row">
              <span>{item}</span>
              <strong>편집 가능</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="action-strip">
        {data.riskSummary.immediateActions.map((item, index) => (
          <article key={item} className="action-tile">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item}</strong>
          </article>
        ))}
      </section>

      <WorkpackEditor data={data} />

      <section className="two product-section">
        <article className="card list">
          <div className="eyebrow">Field briefing</div>
          <div className="h2">작업 전 확인 질문</div>
          <div className="question-list">
            {data.deliverables.tbmQuestions.map((item) => (
              <div key={item} className="question-row">{item}</div>
            ))}
          </div>
        </article>
        <article className="card list">
          <div className="eyebrow">Education handoff</div>
          <div className="h2">교육 핵심 문구</div>
          <div className="question-list">
            {data.deliverables.safetyEducationPoints.map((item) => (
              <div key={item} className="question-row">{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="reference-grid" id="references">
        <article className="card list">
          <div className="eyebrow">Weather</div>
          <div className="h2">기상 작업 신호</div>
          <p className="lead">{data.externalData.weather.summary}</p>
          <ul>
            {data.externalData.weather.actions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="card list">
          <div className="eyebrow">Training</div>
          <div className="h2">후속 교육 추천</div>
          {primaryTraining ? (
            <a href={primaryTraining.url} target="_blank" rel="noreferrer" className="training-card">
              <strong>{primaryTraining.title}</strong>
              <span>{primaryTraining.institution}</span>
              <small>{primaryTraining.startDate} ~ {primaryTraining.endDate}</small>
              <small>{primaryTraining.reason}</small>
            </a>
          ) : (
            <p className="muted">추천 교육이 없으면 안전교육일지 초안을 그대로 사용합니다.</p>
          )}
        </article>

        <article className="card list">
          <div className="eyebrow">KOSHA</div>
          <div className="h2">작업 기준 참고</div>
          {data.externalData.kosha.references.slice(0, 2).map((item) => (
            <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="training-card">
              <strong>{item.title}</strong>
              <span>{item.category}</span>
              <small>{item.impact}</small>
            </a>
          ))}
        </article>
      </section>

      <section className="two product-section">
        <CitationList citations={data.citations} question={data.question} />
        <article className="card list">
          <div className="eyebrow">Share</div>
          <div className="h2">현장 공유용 메시지</div>
          <pre>{data.deliverables.kakaoMessage}</pre>
        </article>
      </section>
    </main>
  );
}
