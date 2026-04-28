"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { FieldOperationsWorkspace } from "@/components/FieldOperationsWorkspace";
import type { AskResponse } from "@/lib/types";
import type { FieldExample } from "@/lib/field-examples";

type SafeGuardCommandCenterProps = {
  examples: FieldExample[];
  initialScenarioId: string;
  initialQuestion: string;
  autoGenerate: boolean;
};

type GenerationState = "idle" | "generating" | "ready" | "error";

type WorkflowStep = {
  key: "input" | "risk" | "pack" | "workers" | "dispatch";
  id: string;
  label: string;
  caption: string;
};

type StepStatus = "done" | "active" | "pending" | "locked";

type FieldBrief = {
  companyName: string;
  siteName: string;
  industry: string;
  workSummary: string;
  workerCount: string;
  weather: string;
  sourceLabel: string;
  foreignWorkerSignal: string;
};

const workflowSteps: WorkflowStep[] = [
  { id: "01", key: "input", label: "작업 입력", caption: "현장·작업·조건" },
  { id: "02", key: "risk", label: "위험 판단", caption: "법령 매칭" },
  { id: "03", key: "pack", label: "문서팩 생성", caption: "6종 산출물" },
  { id: "04", key: "workers", label: "작업자 선택", caption: "언어·채널" },
  { id: "05", key: "dispatch", label: "현장 전파", caption: "Email · SMS" }
];

const outputItems = [
  "위험성평가표",
  "작업계획서",
  "TBM 기록",
  "안전보건교육 기록",
  "외국인 근로자 안내문",
  "현장 전파 메시지"
];

const recentWorkpacks = [
  { title: "외벽 도장 · 이동식 비계", time: "오늘 08:14", law: 12, docs: 6 },
  { title: "지게차 상하차 · 보행동선", time: "어제 16:22", law: 8, docs: 6 },
  { title: "용접·절단 화기작업", time: "어제 10:05", law: 14, docs: 6 },
  { title: "밀폐공간 펌프 점검", time: "04.27 09:18", law: 9, docs: 5 }
];

function statusCopy(state: GenerationState) {
  if (state === "generating") return "문서 생성 중";
  if (state === "ready") return "작업공간 준비됨";
  if (state === "error") return "연결 점검 필요";
  return "작업 입력 대기";
}

function activeStep(state: GenerationState): WorkflowStep["key"] {
  if (state === "generating") return "risk";
  if (state === "ready") return "pack";
  if (state === "error") return "risk";
  return "input";
}

function stepStatuses(state: GenerationState): Record<WorkflowStep["key"], StepStatus> {
  if (state === "generating") {
    return { input: "done", risk: "active", pack: "pending", workers: "locked", dispatch: "locked" };
  }
  if (state === "ready") {
    return { input: "done", risk: "done", pack: "active", workers: "pending", dispatch: "pending" };
  }
  if (state === "error") {
    return { input: "done", risk: "active", pack: "pending", workers: "locked", dispatch: "locked" };
  }
  return { input: "active", risk: "pending", pack: "pending", workers: "locked", dispatch: "locked" };
}

function lawCount(data: AskResponse | null, state: GenerationState) {
  if (data) return data.citations.length;
  if (state === "generating") return 3;
  return 0;
}

function docProgress(data: AskResponse | null, state: GenerationState) {
  if (data) return 6;
  if (state === "generating") return 2;
  return 0;
}

function elapsedLabel(state: GenerationState) {
  if (state === "generating") return "진행 중";
  if (state === "ready") return "완료";
  if (state === "error") return "점검";
  return "대기";
}

function operationalStatus(data: AskResponse | null, state: GenerationState) {
  if (state === "error") return "연결 점검 필요";
  if (data) return data.status.summary || "근거 연결됨";
  return "입력 후 확인";
}

function inferLocationFromText(text: string, fallback: string) {
  const locationMatch = text.match(/(서울|인천|경기|안산|부산|대구|광주|대전|울산|창원|천안|청주|수원|성수동|남동공단|하남산단|달서구|해운대)[^\s,.]*/);
  return locationMatch?.[0] || fallback;
}

function inferWorkerCountFromText(text: string) {
  const countMatch = text.match(/(?:작업자|근로자|인력|참석|총)?\s*(\d+)\s*명/);
  return countMatch ? `${countMatch[1]}명` : "입력 필요";
}

function inferWeatherFromText(text: string, fallback: string) {
  const weatherKeywords = ["강풍", "우천", "폭염", "고온", "환기", "집중호우", "눈", "결빙", "실내", "밀폐"];
  const found = weatherKeywords.filter((keyword) => text.includes(keyword));
  return found.length ? found.join(" · ") : fallback;
}

function inferForeignSignal(text: string, fallback: boolean) {
  if (/외국인|베트남|중국|몽골|태국|필리핀|우즈벡|캄보디아|네팔|다국어/.test(text)) return "외국인/다국어 확인";
  return fallback ? "외국인 포함 가능" : "국내 인력 중심";
}

function buildInputFieldBrief(question: string, example: FieldExample): FieldBrief {
  return {
    companyName: example.companyName,
    siteName: inferLocationFromText(question, example.region),
    industry: example.industry,
    workSummary: example.workType,
    workerCount: inferWorkerCountFromText(question),
    weather: inferWeatherFromText(question, example.weatherSignal),
    sourceLabel: "입력문 자동 추출",
    foreignWorkerSignal: inferForeignSignal(question, example.hasForeignWorkers)
  };
}

function buildApiFieldBrief(data: AskResponse, fallbackExample: FieldExample): FieldBrief {
  return {
    companyName: data.scenario.companyName || fallbackExample.companyName,
    siteName: data.scenario.siteName || fallbackExample.region,
    industry: data.scenario.companyType || fallbackExample.industry,
    workSummary: data.scenario.workSummary || fallbackExample.workType,
    workerCount: `${data.scenario.workerCount}명`,
    weather: data.externalData.weather.summary || data.scenario.weatherNote || fallbackExample.weatherSignal,
    sourceLabel: data.externalData.weather.mode === "live" ? "API 반영 브리프" : "입력+보강 브리프",
    foreignWorkerSignal: inferForeignSignal(data.question, fallbackExample.hasForeignWorkers)
  };
}

function statusRowState(active: boolean, warning = false) {
  if (warning) return "warn";
  return active ? "live" : "pending";
}

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="step-dot done" aria-hidden="true">
        ✓
      </span>
    );
  }
  if (status === "locked") {
    return (
      <span className="step-dot locked" aria-hidden="true">
        ▣
      </span>
    );
  }
  return <span className={`step-dot ${status}`} aria-hidden="true" />;
}

export function SafeGuardCommandCenter({
  examples,
  initialScenarioId,
  initialQuestion,
  autoGenerate
}: SafeGuardCommandCenterProps) {
  const initialExample = examples.find((example) => example.id === initialScenarioId) || examples[0];
  const [selectedExampleId, setSelectedExampleId] = useState(initialExample.id);
  const selectedExample = useMemo(
    () => examples.find((example) => example.id === selectedExampleId) || examples[0],
    [examples, selectedExampleId]
  );
  const [question, setQuestion] = useState(initialQuestion || selectedExample.question);
  const [data, setData] = useState<AskResponse | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<GenerationState>("idle");
  const [isPending, startTransition] = useTransition();

  async function generateWorkpack(nextQuestion = question) {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      setMessage("현장 상황을 입력해 주세요.");
      return;
    }

    setState("generating");
    setMessage("법령, 기상, 교육, 재해사례 근거를 확인하며 문서팩을 작성하고 있습니다.");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed })
      });
      if (!response.ok) {
        throw new Error(`문서팩 생성 요청 실패: HTTP ${response.status}`);
      }
      const payload = await response.json() as AskResponse;
      startTransition(() => {
        setData(payload);
        setState("ready");
        setMessage("문서팩을 준비했습니다. 편집, 다운로드, 근거 확인, 현장 전파를 이어가세요.");
      });
    } catch (error) {
      console.error("workpack generation failed", error);
      setState("error");
      setMessage("문서팩 생성 중 연결을 확인해야 합니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateWorkpack();
  }

  function selectExample(example: FieldExample) {
    setSelectedExampleId(example.id);
    setQuestion(example.question);
    setData(null);
    setState("idle");
    setMessage(`${example.label} 현장 예시를 불러왔습니다. 필요하면 작업 조건을 수정한 뒤 생성하세요.`);
  }

  useEffect(() => {
    if (!autoGenerate) return;
    void generateWorkpack(initialQuestion);
    // Run once for URL-provided queries only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state === "generating" || isPending;
  const currentStep = activeStep(state);
  const statuses = stepStatuses(state);
  const fieldBrief = data ? buildApiFieldBrief(data, selectedExample) : buildInputFieldBrief(question, selectedExample);
  const currentLawCount = lawCount(data, state);
  const currentDocProgress = docProgress(data, state);

  return (
    <main className="command-center-shell">
      <header className="command-topbar">
        <Link href="/" className="brand-lockup safeclaw-lockup">
          <span className="brand-mark">S</span>
          <span>
            <strong>SafeGuard</strong>
            <small>Safety workpack OS</small>
          </span>
        </Link>
        <nav className="topnav command-stepper" aria-label="작업 단계">
          {workflowSteps.map((step) => (
            <a
              href={step.key === "input" ? "#command" : step.key === "pack" ? "#workpack" : "#references"}
              className={step.key === currentStep ? "active" : ""}
              key={step.key}
            >
              <StepDot status={statuses[step.key]} />
              <span className="step-copy">
                <small>{step.id} · {statuses[step.key] === "done" ? "완료" : statuses[step.key] === "active" ? "진행 중" : step.caption}</small>
                <strong>{step.label}</strong>
              </span>
            </a>
          ))}
        </nav>
        <div className="topbar-status">
          <span>{statusCopy(state)}</span>
          <b>{operationalStatus(data, state)}</b>
        </div>
      </header>

      <section className="command-viewport" id="command">
        <aside className="command-left-panel">
          <section className="left-panel-card live-status-widget">
            <div className="left-widget-head">
              <span>LIVE STATUS</span>
              <b>{state === "idle" ? "READY" : state === "generating" ? "MATCHING" : state === "ready" ? "COMPLETE" : "CHECK"}</b>
            </div>
            <div className="status-row-list">
              <div className={`status-row ${statusRowState(state !== "idle")}`}>
                <span>현재 단계</span>
                <b>{statusCopy(state)}</b>
              </div>
              <div className="status-row pending">
                <span>경과</span>
                <b>{elapsedLabel(state)}</b>
              </div>
              <div className={`status-row ${statusRowState(currentLawCount > 0)}`}>
                <span>법령 매칭</span>
                <b>{currentLawCount}건</b>
              </div>
              <div className={`status-row ${statusRowState(currentDocProgress > 0)}`}>
                <span>문서 작성</span>
                <b>{currentDocProgress}/6</b>
              </div>
            </div>
            <div className="left-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (currentDocProgress / 6) * 100)}%` }} />
            </div>
          </section>

          <section className="left-panel-card field-brief-mini">
            <div className="left-widget-head">
              <span>FIELD BRIEF</span>
              <b>{fieldBrief.sourceLabel}</b>
            </div>
            <div className="brief-mini-grid">
              <div>
                <span>현장</span>
                <b>{fieldBrief.siteName}</b>
              </div>
              <div>
                <span>업종</span>
                <b>{fieldBrief.industry}</b>
              </div>
              <div>
                <span>작업</span>
                <b>{fieldBrief.workSummary}</b>
              </div>
              <div>
                <span>날씨</span>
                <b className="amber">{fieldBrief.weather}</b>
              </div>
              <div>
                <span>인원</span>
                <b>{fieldBrief.workerCount}</b>
              </div>
              <div>
                <span>언어</span>
                <b>{fieldBrief.foreignWorkerSignal}</b>
              </div>
            </div>
            <div className="site-tag-grid">
              <span>{selectedExample.skillMix}</span>
              <span>{fieldBrief.companyName}</span>
            </div>
          </section>

          <section className="left-panel-card">
            <div className="left-widget-head">
              <span>RECENT WORKPACKS</span>
              <b>전체</b>
            </div>
            <div className="recent-list">
              {recentWorkpacks.map((item) => (
                <button type="button" key={item.title}>
                  <i aria-hidden="true" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.time} · {item.law}건 · {item.docs}/6</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="command-main card command-main-studio">
          <div className="command-copy">
            <span className="eyebrow">Inspection-ready workspace</span>
            <h1>오늘 작업을 한 줄로, 실행 가능한 안전 문서팩으로.</h1>
            <p>
              현장 조건을 입력하면 위험성평가, 작업계획, TBM, 안전교육, 외국인 안내문,
              현장 전파 메시지를 하나의 작업공간에서 편집하고 내보낼 수 있습니다.
            </p>
          </div>

          <form className="command-console" onSubmit={submit}>
            <div className="console-head">
              <label htmlFor="field-command-input">현장 상황 입력</label>
              <span>{question.length}자</span>
            </div>
            <textarea
              id="field-command-input"
              className="textarea command-console-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: 외벽 도장, 이동식 비계, 작업자 5명, 오후 강풍, 신규 투입자, 지게차 동선 혼재"
            />
            <div className="command-actions">
              <button type="submit" className="button command-primary" disabled={busy}>
                {busy ? "근거 확인 중" : "선택한 현장으로 생성"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setQuestion(selectedExample.question);
                  setData(null);
                  setState("idle");
                }}
              >
                현재 예시 복원
              </button>
            </div>
          </form>

          <div className="quick-scenario-chips" aria-label="현장 예시">
            <span>예시 불러오기 →</span>
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className={`quick-chip ${example.id === selectedExample.id ? "active" : ""}`}
                onClick={() => selectExample(example)}
              >
                {example.label}
              </button>
            ))}
          </div>

          <section className="evidence-live-panel" id="references">
            <div className="compact-head">
              <span className="eyebrow">Evidence matching</span>
              <strong>{currentLawCount ? `${currentLawCount}건 연결` : "생성 후 연결"}</strong>
            </div>
            <p>{message || "선택한 현장 설명을 기준으로 법령, 기상, KOSHA 자료, 교육 추천을 연결합니다."}</p>
          </section>

          <section className="output-card-grid" id="workpack">
            <div className="compact-head">
              <span className="eyebrow">Generated documents</span>
              <strong>{currentDocProgress}/6</strong>
            </div>
            <div className="doc-card-list">
              {outputItems.map((item, index) => (
                <article key={item} className={data ? "doc-card done" : busy && index < 2 ? "doc-card active" : "doc-card"}>
                  <span>DOC · 0{index + 1}</span>
                  <strong>{item}</strong>
                  <p>{data ? "편집과 다운로드 가능" : busy && index < 2 ? "작성 중" : "대기"}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="dispatch-preview-panel">
            <div>
              <span className="eyebrow">Dispatch</span>
              <strong>현장 전파 준비</strong>
            </div>
            <p>문서팩 생성 후 작업자 언어와 채널을 선택해 메일·문자 전송을 요청합니다.</p>
          </section>
        </section>
      </section>

      {data ? (
        <>
          <section className="result-ribbon" aria-label="생성 결과 요약">
            <article>
              <span>위험도</span>
              <strong>{data.riskSummary.riskLevel}</strong>
            </article>
            <article>
              <span>핵심 위험</span>
              <strong>{data.riskSummary.topRisk}</strong>
            </article>
            <article>
              <span>연결 상태</span>
              <strong>{data.status.summary}</strong>
            </article>
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
        </>
      ) : (
        <section className="empty-workspace card" id="workpack">
          <div>
            <span className="eyebrow">Workspace ready</span>
            <h2>생성 버튼을 누르면 작업공간이 열립니다.</h2>
            <p>
              첫 화면은 즉시 열리고, 라이브 근거 확인은 문서팩 생성 시점에 실행됩니다.
              현장관리자는 생성된 문서를 바로 수정하고 파일로 내보낼 수 있습니다.
            </p>
          </div>
          <div className="empty-preview-grid">
            {["문서 편집", "근거 매핑", "현장 전파"].map((item) => (
              <article key={item}>
                <strong>{item}</strong>
                <span>생성 후 활성화</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
