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
  key: "input" | "risk" | "pack" | "evidence" | "dispatch";
  label: string;
  caption: string;
};

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
  { key: "input", label: "작업 입력", caption: "현장·인원·조건" },
  { key: "risk", label: "위험 판단", caption: "위험요인·즉시조치" },
  { key: "pack", label: "문서팩", caption: "편집·다운로드" },
  { key: "evidence", label: "근거", caption: "법령·KOSHA·사례" },
  { key: "dispatch", label: "전파", caption: "메일·문자·다국어" }
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
  "외벽 도장 · 이동식 비계",
  "지게차 상하차 · 보행동선",
  "용접·절단 화기작업",
  "밀폐공간 펌프 점검"
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
  if (state === "error") return "evidence";
  return "input";
}

function progressWidth(state: GenerationState) {
  if (state === "ready") return "100%";
  if (state === "generating") return "48%";
  if (state === "error") return "74%";
  return "16%";
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
  const fieldBrief = data ? buildApiFieldBrief(data, selectedExample) : buildInputFieldBrief(question, selectedExample);

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
          {workflowSteps.map((step, index) => (
            <a
              href={step.key === "input" ? "#command" : step.key === "pack" ? "#workpack" : "#references"}
              className={step.key === currentStep ? "active" : ""}
              key={step.key}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {step.label}
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
          <section className="left-panel-card current-site-card">
            <span className="eyebrow">Current site</span>
            <strong>{selectedExample.companyName}</strong>
            <p>{selectedExample.region} · {selectedExample.industry}</p>
            <div className="site-tag-grid">
              <span>{selectedExample.skillMix}</span>
              <span>{selectedExample.hasForeignWorkers ? "외국인 포함" : "국내 인력"}</span>
            </div>
          </section>

          <section className="left-panel-card">
            <div className="compact-head">
              <span className="eyebrow">Recent</span>
              <small>작업 이력</small>
            </div>
            <div className="recent-list">
              {recentWorkpacks.map((item) => (
                <button type="button" key={item}>
                  <strong>{item}</strong>
                  <span>문서팩 6종 · 근거 연결</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="command-main card command-main-studio">
          <div className="workflow-progress" aria-hidden="true">
            <span style={{ width: progressWidth(state) }} />
          </div>

          <div className="command-copy">
            <span className="eyebrow">Inspection-ready workspace</span>
            <h1>작업 설명을 안전 문서팩으로 정리하세요.</h1>
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

          <div className="quick-scenario-grid" aria-label="현장 예시">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className={`quick-scenario ${example.id === selectedExample.id ? "active" : ""}`}
                onClick={() => selectExample(example)}
              >
                <strong>{example.label}</strong>
                <span>{example.region} · {example.industry} · {example.skillMix}</span>
                <small>선택 후 API 생성</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="command-side">
          <section className="status-board card">
            <div className="compact-head">
              <span className="eyebrow">Run state</span>
              <strong>{statusCopy(state)}</strong>
            </div>
            <p>{message || "입력 후 생성하면 문서팩, 근거, 근로자 안내, 전파 상태가 작업공간에 표시됩니다."}</p>
            <div className={`status-orb ${state}`} aria-hidden="true" />
          </section>

          <section className="field-brief-card card">
            <div className="compact-head">
              <span className="eyebrow">필드 브리프</span>
              <small>{fieldBrief.sourceLabel}</small>
            </div>
            <strong>{fieldBrief.workSummary}</strong>
            <div className="brief-stat-grid">
              <div>
                <span>업체</span>
                <b>{fieldBrief.companyName}</b>
              </div>
              <div>
                <span>현장</span>
                <b>{fieldBrief.siteName}</b>
              </div>
              <div>
                <span>인원</span>
                <b>{fieldBrief.workerCount}</b>
              </div>
              <div>
                <span>날씨/조건</span>
                <b>{fieldBrief.weather}</b>
              </div>
            </div>
            <div className="brief-signal-row">
              <span>{fieldBrief.industry}</span>
              <span>{fieldBrief.foreignWorkerSignal}</span>
            </div>
          </section>

          <section className="output-stack card">
            <span className="eyebrow">문서팩 항목</span>
            {outputItems.map((item) => (
              <div key={item} className={data ? "output-line ready" : "output-line"}>
                <span>{item}</span>
                <strong>{data ? "준비" : "대기"}</strong>
              </div>
            ))}
          </section>
        </aside>
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
