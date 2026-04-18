import Link from "next/link";
import { CitationList } from "@/components/CitationList";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { runAsk } from "@/lib/search";

const defaultQuestion = "서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 오후 강풍 예보. 오늘 TBM과 위험성평가 초안을 만들어줘.";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || defaultQuestion;
  const data = await runAsk(q);
  const dryrun = getLatestDryrunSnapshot();

  return (
    <main className="container grid">
      <section className="hero grid">
        <div className="row">
          <span className="badge">MVP Demo Flow</span>
          <span className="badge">위험성평가 + TBM + 공유문구</span>
          <span className="badge">Fallback Visible</span>
        </div>
        <h1 className="title">현장 입력 한 줄로 안전 산출물 초안을 바로 만드는 MVP</h1>
        <p className="subtitle">
          대표 시나리오 1개를 기준으로 위험 요약 카드, 위험성평가 초안, TBM 브리핑,
          TBM 일지 초안, 카카오톡 전달용 메시지까지 한 화면에서 데모할 수 있게 구성했습니다.
        </p>
        <form action="/" method="GET" className="card list surface">
          <div className="h3">현장 입력</div>
          <p className="muted">샘플 문장을 그대로 실행하거나 작업 장소·인원·위험요인을 바꿔 데모할 수 있습니다.</p>
          <textarea
            name="q"
            className="textarea"
            defaultValue={q}
            placeholder="예: 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 오후 강풍 예보"
          />
          <div className="row">
            <button type="submit" className="button">MVP 결과 생성</button>
            <a href={`/ask?q=${encodeURIComponent(q)}`} className="button secondary">질문형 화면 보기</a>
            <a href="/search?q=하청 안전보건 책임" className="button secondary">근거 검색 보기</a>
            <Link href="/dryrun" className="button secondary">드라이런 로그</Link>
          </div>
        </form>
      </section>

      {dryrun ? (
        <section className="card list dryrun-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="h3">최근 문서형 드라이런</div>
              <p className="muted">위험성평가, TBM 일지, 작업계획서 등 10개 문서형 케이스를 매일 실행한 최신 결과입니다.</p>
            </div>
            <Link href="/dryrun" className="button secondary">전체 로그 보기</Link>
          </div>
          <div className="mini-grid dryrun-metrics">
            <div className="stat">
              <span className="muted">성공</span>
              <strong>{dryrun.okCount}/{dryrun.totalRuns}</strong>
            </div>
            <div className="stat">
              <span className="muted">실패</span>
              <strong>{dryrun.failCount}</strong>
            </div>
            <div className="stat">
              <span className="muted">평균 응답</span>
              <strong>{dryrun.avgMs}ms</strong>
            </div>
            <div className="stat">
              <span className="muted">P95</span>
              <strong>{dryrun.p95Ms}ms</strong>
            </div>
          </div>
          <p className="lead">{dryrun.qualityNote}</p>
          <div className="three dryrun-preview-grid">
            {dryrun.highlights.slice(0, 3).map((item) => (
              <div key={item.id} className="card list surface dryrun-preview-card">
                <div className="h3">{item.label}</div>
                <p className="muted">{item.answerPreview || "preview unavailable"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="risk-grid">
        <div className="card list risk-card">
          <div className="row">
            <div className="h2">Top Risk Summary</div>
            <span className={`badge badge-risk risk-${data.riskSummary.riskLevel}`}>위험도 {data.riskSummary.riskLevel}</span>
          </div>
          <div className="h3">{data.riskSummary.title}</div>
          <p className="lead">{data.riskSummary.topRisk}</p>
          <div className="mini-grid">
            <div className="stat">
              <span className="muted">현장</span>
              <strong>{data.scenario.siteName}</strong>
            </div>
            <div className="stat">
              <span className="muted">인원</span>
              <strong>{data.scenario.workerCount}명</strong>
            </div>
            <div className="stat">
              <span className="muted">기상/특이사항</span>
              <strong>{data.scenario.weatherNote}</strong>
            </div>
          </div>
          <ul>
            {data.riskSummary.immediateActions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="card list">
          <div className="h3">API / Fallback Status</div>
          <div className="row">
            <span className="badge">Law.go: {data.status.lawgo}</span>
            <span className="badge">AI: {data.status.ai}</span>
            <span className="badge">Mode: {data.mode}</span>
          </div>
          <p className="lead">{data.status.summary}</p>
          <p className="muted">{data.status.detail}</p>
          <hr />
          <div className="h3">현재 입력</div>
          <pre>{data.question}</pre>
        </div>
      </section>

      <section className="three">
        <div className="card list">
          <div className="h3">위험성평가 초안</div>
          <pre>{data.deliverables.riskAssessmentDraft}</pre>
        </div>
        <div className="card list">
          <div className="h3">TBM 브리핑</div>
          <pre>{data.deliverables.tbmBriefing}</pre>
        </div>
        <div className="card list">
          <div className="h3">TBM 일지 초안</div>
          <pre>{data.deliverables.tbmLogDraft}</pre>
        </div>
      </section>

      <section className="two">
        <div className="card list">
          <div className="h3">카카오톡 전달용 메시지</div>
          <pre>{data.deliverables.kakaoMessage}</pre>
        </div>
        <CitationList citations={data.citations} />
      </section>
    </main>
  );
}
