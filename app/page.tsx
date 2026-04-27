import Link from "next/link";
import { CitationList } from "@/components/CitationList";
import { WorkpackEditor } from "@/components/WorkpackEditor";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { defaultDemoScenario, demoScenarios } from "@/lib/demo-scenarios";
import { runAsk } from "@/lib/search";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; scenario?: string }> }) {
  const params = await searchParams;
  const selectedScenario = demoScenarios.find((scenario) => scenario.id === params.scenario) || defaultDemoScenario;
  const q = params.q || selectedScenario.question;
  const data = await runAsk(q);
  const primaryTraining = data.externalData.training.recommendations[0];
  const primaryKoshaEducation = data.externalData.koshaEducation.recommendations[0];
  const primaryAccidentCase = data.externalData.accidentCases.cases[0];
  const foreignBriefingPreview = data.deliverables.foreignWorkerTransmission.split(/\r?\n/).filter(Boolean).slice(0, 6);

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
          <div className="eyebrow">SafeGuard</div>
          <h1>작업 전 문서팩</h1>
          <p>
            오늘 작업을 입력하면 위험성평가표, TBM, 안전보건교육 기록,
            현장 전파 메시지를 한 번에 준비합니다.
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
              <a href="#workpack" className="button secondary">수정·다운로드</a>
            </div>
          </form>
          <div className="scenario-picker">
            {demoScenarios.map((scenario) => (
              <Link
                key={scenario.id}
                href={`/?scenario=${scenario.id}`}
                className={`scenario-chip ${scenario.id === selectedScenario.id && !params.q ? "active" : ""}`}
              >
                <strong>{scenario.label}</strong>
                <span>{scenario.region} · {scenario.industry} · {scenario.hasForeignWorkers ? "외국인 포함" : "외국인 없음"} · {scenario.skillMix}</span>
              </Link>
            ))}
          </div>
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
            <strong>7종 준비 완료</strong>
          </div>
          {[
            "위험성평가표",
            "TBM 브리핑",
            "TBM 기록",
            "안전보건교육 기록",
            "외국인 출력본",
            "외국인 전송본",
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

      <section className="field-notes">
        <article className="compact-panel">
          <div className="compact-head">
            <span className="eyebrow">Check</span>
            <strong>작업 전 확인 질문</strong>
          </div>
          <div className="compact-list">
            {data.deliverables.tbmQuestions.map((item) => (
              <div key={item} className="compact-row">{item}</div>
            ))}
          </div>
        </article>
        <article className="compact-panel">
          <div className="compact-head">
            <span className="eyebrow">Teach</span>
            <strong>교육 핵심 문구</strong>
          </div>
          <div className="compact-list">
            {data.deliverables.safetyEducationPoints.map((item) => (
              <div key={item} className="compact-row">{item}</div>
            ))}
          </div>
        </article>
        <article className="compact-panel">
          <div className="compact-head">
            <span className="eyebrow">Foreign</span>
            <strong>외국인 전송 미리보기</strong>
          </div>
          <div className="compact-list">
            {foreignBriefingPreview.map((item) => (
              <div key={item} className="compact-row">{item}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="reference-strip" id="references">
        <article className="reference-card">
          <div className="compact-head">
            <span className="eyebrow">Weather</span>
            <strong>{data.externalData.weather.summary}</strong>
          </div>
          <ul className="plain-list">
            {data.externalData.weather.actions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="reference-card">
          <div className="compact-head">
            <span className="eyebrow">Accident</span>
            <strong>유사 재해사례</strong>
          </div>
          {primaryAccidentCase ? (
            <a href={primaryAccidentCase.sourceUrl || "https://www.kosha.or.kr/"} target="_blank" rel="noreferrer" className="training-card">
              <strong>{primaryAccidentCase.title}</strong>
              <em className="fit-pill">{data.externalData.accidentCases.mode === "live" ? "live" : "fallback"}</em>
              <span>{[primaryAccidentCase.industry, primaryAccidentCase.accidentType].filter(Boolean).join(" · ")}</span>
              <small>{primaryAccidentCase.summary}</small>
              <small>{primaryAccidentCase.preventionPoint}</small>
              <small>{primaryAccidentCase.matchedReason}</small>
            </a>
          ) : (
            <p className="muted">유사 재해사례가 없으면 위험성평가와 TBM 문구만 사용합니다.</p>
          )}
        </article>

        <article className="reference-card">
          <div className="compact-head">
            <span className="eyebrow">Training</span>
            <strong>후속 교육</strong>
          </div>
          {primaryTraining ? (
            <a href={primaryTraining.url} target="_blank" rel="noreferrer" className="training-card">
              <strong>{primaryTraining.title}</strong>
              <em className="fit-pill">{primaryTraining.fitLabel || "조건부 후보"}</em>
              <span>{primaryTraining.institution}</span>
              <small>{primaryTraining.startDate} ~ {primaryTraining.endDate}</small>
              <small>{primaryTraining.fitReason || primaryTraining.reason}</small>
            </a>
          ) : (
            <p className="muted">추천 교육이 없으면 안전교육일지 초안을 그대로 사용합니다.</p>
          )}
          {primaryKoshaEducation ? (
            <a href={primaryKoshaEducation.url} target="_blank" rel="noreferrer" className="training-card">
              <strong>{primaryKoshaEducation.title}</strong>
              <em className="fit-pill">{primaryKoshaEducation.fitLabel}</em>
              <span>{primaryKoshaEducation.provider}</span>
              <small>{primaryKoshaEducation.target} · {primaryKoshaEducation.educationMethod}</small>
              <small>{primaryKoshaEducation.fitReason}</small>
            </a>
          ) : null}
        </article>

        <article className="reference-card">
          <div className="compact-head">
            <span className="eyebrow">KOSHA</span>
            <strong>공식 서식 근거</strong>
          </div>
          {data.externalData.kosha.references.slice(0, 2).map((item) => (
            <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="training-card">
              <strong>{item.title}</strong>
              <em className="fit-pill">{item.verified ? "공식 링크 확인" : "사전 매핑"}</em>
              <span>{item.agency || "KOSHA"} · {item.category}</span>
              <small>반영 문서: {(item.appliesTo || item.appliedTo || ["위험성평가", "TBM"]).join(", ")}</small>
              <small>서식 힌트: {(item.templateHints || []).join(", ") || item.category}</small>
              <small>{item.summary}</small>
            </a>
          ))}
        </article>
      </section>

      <section className="handoff-section">
        <div className="evidence-panel">
          <CitationList citations={data.citations} question={data.question} />
        </div>
        <WorkflowSharePanel data={data} />
      </section>
    </main>
  );
}
