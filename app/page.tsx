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

function buildStatusTone(mode: "mock" | "live" | "fallback") {
  if (mode === "live") return "ok";
  if (mode === "fallback") return "warn";
  return "neutral";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || defaultQuestion;
  const data = await runAsk(q);
  const dryrun = getLatestDryrunSnapshot();
  const sourceMix = data.sourceMix?.counts || {};
  const sourceMixEntries = Object.entries(sourceMix);
  const statusCards = [
    { label: "Law.go", value: data.status.lawgo },
    { label: "AI", value: data.status.ai },
    { label: "Weather", value: data.status.weather },
    { label: "Work24", value: data.status.work24 },
    { label: "KOSHA", value: data.status.kosha }
  ];

  return (
    <main className="container grid page-shell">
      <section className="hero hero-split">
        <div className="hero-main list">
          <div className="row">
            <span className="badge">공모전 골든패스</span>
            <span className="badge">실행 문서 생성형 코파일럿</span>
            <span className="badge">{getModeBadgeLabel(data.mode)}</span>
          </div>
          <h1 className="title hero-title">오늘 작업 한 줄을 위험성평가·TBM·안전교육 기록으로 바꾸는 SafeGuard</h1>
          <p className="subtitle">
            심사위원이 첫 화면에서 바로 이해할 수 있도록, 현장 설명 입력 한 번으로 위험 판단, 법령 근거, 위험성평가 초안,
            TBM 브리핑, 안전교육 기록, 카카오 전파까지 하나의 흐름으로 압축해 보여줍니다.
          </p>
          <div className="hero-points">
            <div className="hero-point">
              <span className="hero-kicker">문제</span>
              <strong>작업 전 판단과 문서화가 늦어져 사고예방이 뒤로 밀립니다.</strong>
            </div>
            <div className="hero-point">
              <span className="hero-kicker">해결</span>
              <strong>위험요약, 위험성평가, TBM, 교육기록을 동시에 생성해 바로 실행합니다.</strong>
            </div>
            <div className="hero-point">
              <span className="hero-kicker">효과</span>
              <strong>법령 근거, 기상 신호, 교육 연계를 한 화면에서 설명 가능한 시연으로 만듭니다.</strong>
            </div>
          </div>
          <form action="/" method="GET" className="card list hero-form">
            <div className="h3">문제 상황 입력</div>
            <p className="muted">대표 시나리오를 기본값으로 두고, 장소·인원·위험요인만 바꿔도 같은 흐름으로 재시연할 수 있습니다.</p>
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
        </div>

        <aside className="hero-rail list">
          <div className="card rail-card signal-card">
            <div className="row">
              <span className="badge">대표 시나리오</span>
              <span className={`status-pill ${buildStatusTone(data.mode)}`}>{data.mode}</span>
            </div>
            <div className="h3">오늘 시연 포인트</div>
            <div className="rail-metric-grid">
              <div className="stat compact">
                <span className="muted">업체</span>
                <strong>{data.scenario.companyName}</strong>
              </div>
              <div className="stat compact">
                <span className="muted">업종</span>
                <strong>{data.scenario.companyType}</strong>
              </div>
              <div className="stat compact">
                <span className="muted">인원</span>
                <strong>{data.scenario.workerCount}명</strong>
              </div>
              <div className="stat compact">
                <span className="muted">근거</span>
                <strong>{data.citations.length}건</strong>
              </div>
            </div>
            <p className="lead">{data.riskSummary.topRisk}</p>
          </div>

          <div className="card rail-card">
            <div className="h3">실데이터 상태</div>
            <div className="status-grid">
              {statusCards.map((item) => (
                <div key={item.label} className={`status-chip ${buildStatusTone(item.value)}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <p className="small muted">{data.status.detail}</p>
          </div>

          <div className="card rail-card">
            <div className="h3">시연 채널 전략</div>
            <div className="list">
              <div className="channel-line">
                <span className="badge">웹 메인</span>
                <span>전체 가치사슬과 증빙을 한 화면에서 시연</span>
              </div>
              <div className="channel-line">
                <span className="badge">카카오 보조</span>
                <span>현장 전파 메시지로 실제 사용성을 마무리</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="card process-card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="h2">시연 흐름</div>
            <p className="muted">심사위원이 이해해야 하는 핵심은 검색이 아니라 실행 문서 생성입니다.</p>
          </div>
          <span className="badge">입력 1회 → 산출물 5종</span>
        </div>
        <div className="process-strip">
          {["문제 입력", "위험 판단", "근거 확인", "문서 생성", "현장 전파"].map((item, index) => (
            <div key={item} className="process-step">
              <span className="process-index">0{index + 1}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      {dryrun ? (
        <section className="card list dryrun-card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="h3">최근 검증 상태</div>
              <p className="muted">심사용 신뢰성 증거로, 최근 드라이런 성공 여부와 응답 속도만 요약합니다.</p>
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

      <section className="dashboard-grid">
        <div className="card list risk-card highlight-card">
          <div className="row">
            <div className="h2">오늘 위험 3개</div>
            <span className={`badge badge-risk risk-${data.riskSummary.riskLevel}`}>위험도 {data.riskSummary.riskLevel}</span>
          </div>
          <div className="h3">{data.riskSummary.title}</div>
          <p className="lead">{data.riskSummary.topRisk}</p>
          <div className="mini-grid">
            <div className="stat">
              <span className="muted">업체</span>
              <strong>{data.scenario.companyName}</strong>
            </div>
            <div className="stat">
              <span className="muted">현장</span>
              <strong>{data.scenario.siteName}</strong>
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

        <div className="card list judge-card">
          <div className="h3">심사 포인트 요약</div>
          <div className="judge-grid">
            <div className="stat compact">
              <span className="muted">완성도</span>
              <strong>입력부터 전파까지 1개 흐름</strong>
            </div>
            <div className="stat compact">
              <span className="muted">데이터·AI 활용</span>
              <strong>Law.go, 기상청, 고용24, Gemini</strong>
            </div>
            <div className="stat compact">
              <span className="muted">실용성</span>
              <strong>위험성평가·TBM·교육기록 즉시 생성</strong>
            </div>
            <div className="stat compact">
              <span className="muted">차별성</span>
              <strong>검색형이 아닌 실행 문서 생성형</strong>
            </div>
          </div>
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

      <section className="card list action-panel">
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

      <section className="three data-panels">
        <div className="card list">
          <div className="h3">기상청 위험 신호</div>
          <div className="muted small">{data.externalData.weather.detail}</div>
          <p className="lead">{data.externalData.weather.summary}</p>
          <div className="small muted">지역: {data.externalData.weather.locationLabel}{data.externalData.weather.forecastTime ? ` · 예보시각 ${data.externalData.weather.forecastTime}` : ""}</div>
          <ul>
            {data.externalData.weather.actions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="card list">
          <div className="h3">고용24 추천 교육</div>
          <div className="muted small">{data.externalData.training.detail}</div>
          {data.externalData.training.recommendations.length ? data.externalData.training.recommendations.map((item) => (
            <div key={`${item.title}-${item.startDate}`} className="stat">
              <strong>{item.title}</strong>
              <span className="muted">{item.institution}</span>
              <span className="small">{item.startDate} ~ {item.endDate}</span>
              {item.cost ? <span className="small">{item.cost}</span> : null}
              <span className="small muted">{item.reason}</span>
            </div>
          )) : <p className="muted">추천 교육 결과가 없으면 안전교육 기록 초안 중심으로 시연합니다.</p>}
        </div>
        <div className="card list">
          <div className="h3">KOSHA 공식 가이드</div>
          <div className="muted small">{data.externalData.kosha.detail}</div>
          {data.externalData.kosha.references.map((item) => (
            <a key={item.url} href={item.url} className="citation-item" target="_blank" rel="noreferrer">
              <div className="row">
                <span className="badge">{item.category}</span>
                <span className="badge">KOSHA</span>
              </div>
              <strong>{item.title}</strong>
              <div className="small muted">{item.summary}</div>
              <div className="small relevance-note">{item.impact}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="three deliverable-grid">
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
          <div className="h3">안전교육 기록 초안</div>
          <div className="muted small">TBM과 위험성평가 결과를 당일 교육기록까지 연결해 현장 실행의 닫힌 루프를 보여줍니다.</div>
          <pre>{data.deliverables.safetyEducationRecordDraft}</pre>
        </div>
        <div className="card list prompt-card">
          <div className="h3">현장 대화 유도 질문</div>
          <div className="muted small">문서 자동생성에 그치지 않고, 작업 전 대화를 다시 열어주는 질문형 가이드입니다.</div>
          <div className="list">
            {data.deliverables.tbmQuestions.map((item, index) => (
              <div key={item} className="stat">
                <span className="badge">Question {index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
          <hr />
          <div className="h3">교육용 핵심 문구</div>
          <div className="list">
            {data.deliverables.safetyEducationPoints.map((item, index) => (
              <div key={item} className="education-point">
                <span className="badge">Point {index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="small muted">
            확장 포인트: 외국인 근로자용 쉬운 문장 브리핑, 다국어 안내, 취업·안전교육 연계 정보
          </div>
        </div>
      </section>

      <section className="two">
        <div className="card list">
          <div className="h3">현장 전파용 카카오톡 메시지</div>
          <div className="muted small">웹에서 생성한 산출물을 현장에 바로 전파하는 보조 채널용 축약본입니다.</div>
          <pre>{data.deliverables.kakaoMessage}</pre>
          <hr />
          <div className="h3">현재 입력</div>
          <pre>{data.question}</pre>
          <div className="small muted">향후 확장: 외국인 근로자용 쉬운 문장 브리핑, 다국어/TTS 안내, 교육기관 정보 연계</div>
        </div>
        <CitationList citations={data.citations} question={data.question} />
      </section>
    </main>
  );
}
