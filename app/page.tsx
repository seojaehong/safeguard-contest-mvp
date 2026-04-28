import Link from "next/link";
import { FieldOperationsWorkspace } from "@/components/FieldOperationsWorkspace";
import { defaultFieldExample, fieldExamples } from "@/lib/field-examples";
import { runAsk } from "@/lib/search";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; scenario?: string }> }) {
  const params = await searchParams;
  const selectedExample = fieldExamples.find((example) => example.id === params.scenario) || defaultFieldExample;
  const q = params.q || selectedExample.question;
  const data = await runAsk(q);

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
            {fieldExamples.map((scenario) => (
              <Link
                key={scenario.id}
                href={`/?scenario=${scenario.id}`}
                className={`scenario-chip ${scenario.id === selectedExample.id && !params.q ? "active" : ""}`}
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
            <strong>11종 준비 완료</strong>
          </div>
          {[
            "위험성평가표",
            "작업계획서",
            "TBM 브리핑",
            "TBM 기록",
            "안전보건교육 기록",
            "비상대응 절차",
            "사진/증빙",
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

      <FieldOperationsWorkspace data={data} />
    </main>
  );
}
