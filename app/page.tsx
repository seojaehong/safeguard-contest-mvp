import Link from "next/link";
import { CitationList } from "@/components/CitationList";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { runAsk } from "@/lib/search";

const defaultQuestion = "서울 성수동 근린생활시설 외벽 도장 작업. 이동식 비계 사용, 작업자 5명, 오후 강풍 예보. 추락과 지게차 동선 위험을 반영해 오늘 위험성평가와 TBM 초안을 만들어줘.";

function getModeBadgeLabel(mode: "mock" | "live" | "fallback") {
  if (mode === "live") return "실데이터 모드";
  if (mode === "fallback") return "Fallback 모드";
  return "데모 모드";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || defaultQuestion;
  const data = await runAsk(q);
  const dryrun = getLatestDryrunSnapshot();
  const sourceMix = data.sourceMix?.counts || {};
  const sourceMixEntries = Object.entries(sourceMix);

  return (
    <main className="container grid">
      <section className="hero grid">
        <div className="row">
          <span className="badge">공모전 골든패스</span>
          <span className="badge">위험성평가 + TBM + 일지 초안</span>
          <span className="badge">{getModeBadgeLabel(data.mode)}</span>
        </div>
        <h1 className="title">오늘 작업 설명 한 줄을 위험성평가와 TBM 초안으로 바꾸는 안전 코파일럿</h1>
        <p className="subtitle">
          심사위원이 한 번에 이해할 수 있도록 대표 시나리오 1개를 기준으로 위험 요약, 즉시 조치, 법령 근거, 위험성평가 초안,
          TBM 브리핑, TBM 일지 초안, 전달용 메시지까지 한 화면에서 이어서 보여줍니다.
        </p>
        <form action="/" method="GET" className="card list surface">
          <div className="h3">문제 상황 입력</div>
          <p className="muted">대표 데모 시나리오를 기본값으로 두고, 장소·인원·위험요인만 바꿔도 같은 흐름으로 재시연할 수 있습니다.</p>
          <textarea
            name="q"
            className="textarea"
            defaultValue={q}
            placeholder="예: 외벽 도장 작업, 이동식 비계 사용, 작업자 5명, 오후 강풍 예보, 추락·지게차 위험"
          />
          <div className="row">
            <button type="submit" className="button">결과 생성</button>
            <a href={`/ask?q=${encodeURIComponent(q)}`} className="button secondary">질문형 보조 화면</a>
            <a href="/search?q=강풍 추락 지게차 안전보건" className="button secondary">근거 탐색 보조 화면</a>
            <Link href="/dryrun" className="button secondary">신뢰성 로그</Link>
          </div>
        </form>
      </section>

      {dryrun ? (
        <section className="card list dryrun-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="h3">최근 검증 상태</div>
              <p className="muted">심사용 신뢰성 증거로, 최근 문서형 드라이런의 성공 여부와 응답 속도만 요약해서 보여줍니다.</p>
            </div>
            <Link href="/dryrun" className="button secondary">세부 로그 보기</Link>
          </div>
          <div className="mini-grid dryrun-metrics">
            <div className="stat">
              <span className="muted">최근 run</span>
              <strong>{dryrun.runId}</strong>
            </div>
            <div className="stat">
              <span className="muted">성공</span>
              <strong>{dryrun.okCount}/{dryrun.totalRuns}</strong>
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
        </section>
      ) : null}

      <section className="risk-grid">
        <div className="card list risk-card">
          <div className="row">
            <div className="h2">오늘 위험 3개</div>
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
          <div className="h3">신뢰성 상태</div>
          <div className="row">
            <span className="badge">Law.go: {data.status.lawgo}</span>
            <span className="badge">AI: {data.status.ai}</span>
            <span className="badge">Mode: {data.mode}</span>
            <span className="badge">근거 {data.citations.length}건</span>
          </div>
          <p className="lead">{data.status.summary}</p>
          <p className="muted">{data.status.detail}</p>
          {data.status.policyNote ? <p className="small muted">{data.status.policyNote}</p> : null}
          {sourceMixEntries.length ? (
            <div className="list">
              <div className="h3">출처 구성</div>
              <div className="row">
                {sourceMixEntries.map(([key, count]) => (
                  <span key={key} className="badge">{key}: {count}</span>
                ))}
              </div>
              <div className="small muted">{data.sourceMix?.koreanLawMcp.summary}</div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card list">
        <div className="h2">즉시 조치</div>
        <div className="three">
          {data.riskSummary.immediateActions.map((item, index) => (
            <div key={item} className="stat action-card">
              <span className="badge">Action {index + 1}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="three">
        <div className="card list">
          <div className="h3">위험성평가 초안</div>
          <div className="muted small">현장 점검표와 위험성평가 문서 초안으로 바로 옮겨 적을 수 있는 형식입니다.</div>
          <pre>{data.deliverables.riskAssessmentDraft}</pre>
        </div>
        <div className="card list">
          <div className="h3">TBM 브리핑</div>
          <div className="muted small">작업반장이 그대로 읽을 수 있는 구두 브리핑 초안입니다.</div>
          <pre>{data.deliverables.tbmBriefing}</pre>
        </div>
        <div className="card list">
          <div className="h3">TBM 일지 초안</div>
          <div className="muted small">기록 남기기 전 바로 정리할 수 있는 일지 초안입니다.</div>
          <pre>{data.deliverables.tbmLogDraft}</pre>
        </div>
      </section>

      <section className="two">
        <div className="card list">
          <div className="h3">카카오톡 전달용 메시지</div>
          <div className="muted small">현장 공유 메시지로 바로 붙여넣을 수 있는 축약본입니다.</div>
          <pre>{data.deliverables.kakaoMessage}</pre>
          <hr />
          <div className="h3">현재 입력</div>
          <pre>{data.question}</pre>
          <div className="small muted">향후 확장: 외국인 근로자용 쉬운 문장 브리핑, 다국어/TTS 안내</div>
        </div>
        <CitationList citations={data.citations} question={data.question} />
      </section>
    </main>
  );
}
