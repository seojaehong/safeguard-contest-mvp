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
          <span className="badge">위험성평가 + TBM + 안전교육</span>
          <span className="badge">{getModeBadgeLabel(data.mode)}</span>
        </div>
        <h1 className="title">오늘 작업 설명 한 줄을 위험성평가·TBM·안전교육 기록으로 바꾸는 안전 코파일럿</h1>
        <p className="subtitle">
          심사위원이 한 번에 이해할 수 있도록 대표 시나리오 1개를 기준으로 위험 요약, 즉시 조치, 법령 근거, 위험성평가 초안,
          TBM 브리핑, TBM 일지 초안, 안전교육 기록 초안, 전달용 메시지까지 한 화면에서 이어서 보여줍니다.
        </p>
        <div className="two channel-grid">
          <div className="card list channel-card primary">
            <div className="h3">시연 채널 1순위: 웹</div>
            <div className="muted small">발표심사 전까지 URL과 화면캡처를 계속 업데이트할 수 있고, 홈 화면에서 전체 가치사슬을 한 번에 보여줄 수 있습니다.</div>
            <ul>
              <li>문제 상황 입력부터 위험성평가, TBM, 안전교육 기록까지 한 번에 시연</li>
              <li>근거 출처, live / partial / mock 상태, fallback 정책을 같은 화면에서 설명</li>
              <li>공모전 제출용 URL과 동영상 시연 파일 제작에 가장 유리한 형태</li>
            </ul>
          </div>
          <div className="card list channel-card secondary">
            <div className="h3">보조 채널: 카카오톡</div>
            <div className="muted small">카카오톡은 메인 제품이 아니라, 생성된 산출물을 현장에 바로 공유하는 마지막 전파 채널로 두는 구성이 적합합니다.</div>
            <ul>
              <li>작업반장과 작업자에게 요약 메시지를 빠르게 전달</li>
              <li>웹 시연 후 현장 적용성을 보여주는 2단계 데모로 사용</li>
              <li>심사위원에게는 실사용 확장성보다 실행 전파 수단으로 설명</li>
            </ul>
          </div>
        </div>
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
              <span className="muted">업체</span>
              <strong>{data.scenario.companyName}</strong>
            </div>
            <div className="stat">
              <span className="muted">현장</span>
              <strong>{data.scenario.siteName}</strong>
            </div>
            <div className="stat">
              <span className="muted">업종</span>
              <strong>{data.scenario.companyType}</strong>
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
            <span className="badge">Weather: {data.status.weather}</span>
            <span className="badge">Work24: {data.status.work24}</span>
            <span className="badge">KOSHA: {data.status.kosha}</span>
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
              <strong>{item.title}</strong>
              <div className="small muted">{item.summary}</div>
            </a>
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
          <div className="h3">안전교육 기록 초안</div>
          <div className="muted small">TBM과 위험성평가 결과를 당일 교육기록까지 연결해 현장 실행의 닫힌 루프를 보여줍니다.</div>
          <pre>{data.deliverables.safetyEducationRecordDraft}</pre>
        </div>
        <div className="card list prompt-card">
          <div className="h3">오늘 팀에 다시 물어야 할 질문 3개</div>
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
          <div className="h3">교육용 핵심 문구 3개</div>
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
