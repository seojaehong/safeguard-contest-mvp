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
  key: "input" | "risk" | "pack" | "workers" | "dispatch" | "history";
  id: string;
  label: string;
  caption: string;
};

type StepStatus = "done" | "active" | "pending" | "locked";
type StepAnchor = "command" | "risk" | "workpack" | "workers" | "dispatch" | "history";

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

type WeatherBrief = AskResponse["externalData"]["weather"];

type WeatherBriefResponse = {
  ok: boolean;
  weather?: WeatherBrief;
  message?: string;
};

const workflowSteps: WorkflowStep[] = [
  { id: "01", key: "input", label: "작업 입력", caption: "현장·작업·조건" },
  { id: "02", key: "risk", label: "API 근거 확인", caption: "법령·기상·교육" },
  { id: "03", key: "pack", label: "문서팩 편집", caption: "Excel · HWPX" },
  { id: "04", key: "workers", label: "작업자·교육", caption: "언어·이수" },
  { id: "05", key: "dispatch", label: "현장 전파", caption: "메일 · 문자" },
  { id: "06", key: "history", label: "이력 저장", caption: "문서·교육·전파" }
];

const stepAnchors: Record<WorkflowStep["key"], StepAnchor> = {
  input: "command",
  risk: "risk",
  pack: "workpack",
  workers: "workers",
  dispatch: "dispatch",
  history: "history"
};

const outputItems = [
  "점검결과 요약",
  "위험성평가표",
  "작업계획서",
  "TBM 브리핑",
  "TBM 기록",
  "안전보건교육 기록",
  "비상대응 절차",
  "사진/증빙",
  "외국인 근로자 안내문",
  "외국인 전송본",
  "현장 전파 메시지"
];

const totalDocumentCount = outputItems.length;

function statusCopy(state: GenerationState) {
  if (state === "generating") return "문서 생성 중";
  if (state === "ready") return "문서팩 준비됨";
  if (state === "error") return "연결 점검 필요";
  return "작업 입력 대기";
}

function stepStatusCopy(status: StepStatus) {
  if (status === "done") return "완료";
  if (status === "active") return "진행 중";
  if (status === "locked") return "잠김";
  return "대기";
}

function activeStep(state: GenerationState): WorkflowStep["key"] {
  if (state === "generating") return "risk";
  if (state === "ready") return "pack";
  if (state === "error") return "risk";
  return "input";
}

function stepStatuses(state: GenerationState): Record<WorkflowStep["key"], StepStatus> {
  if (state === "generating") {
    return { input: "done", risk: "active", pack: "pending", workers: "locked", dispatch: "locked", history: "locked" };
  }
  if (state === "ready") {
    return { input: "done", risk: "done", pack: "active", workers: "pending", dispatch: "pending", history: "pending" };
  }
  if (state === "error") {
    return { input: "done", risk: "active", pack: "pending", workers: "locked", dispatch: "locked", history: "locked" };
  }
  return { input: "active", risk: "pending", pack: "pending", workers: "locked", dispatch: "locked", history: "locked" };
}

function lawCount(data: AskResponse | null, state: GenerationState) {
  if (data) return data.citations.length;
  if (state === "generating") return 3;
  return 0;
}

function docProgress(data: AskResponse | null, state: GenerationState) {
  if (data) return totalDocumentCount;
  if (state === "generating") return 3;
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
  return "입력 대기";
}

function weatherStatusLabel(data: AskResponse | null, weather: WeatherBrief | null, loading: boolean) {
  const currentWeather = data?.externalData.weather || weather;
  if (loading) return "확인 중";
  if (currentWeather?.mode === "live") return "현재 반영";
  if (currentWeather) return "보강 필요";
  return "대기";
}

function apiStackLabel(data: AskResponse | null, weather: WeatherBrief | null) {
  if (data) return "7개 조합";
  if (weather?.mode === "live") return "기상 선조회";
  return "생성 시 조합";
}

function statusDetailCopy(state: GenerationState) {
  if (state === "generating") return "법령·기상·교육·재해사례를 확인하고 있습니다.";
  if (state === "ready") return "문서팩 편집, 작업자 교육 확인, 전파, 이력 저장을 진행할 수 있습니다.";
  if (state === "error") return "외부 연결 상태를 확인한 뒤 다시 시도해 주세요.";
  return "현장 상황을 입력하고 문서팩 생성을 시작하세요.";
}

function riskToneClass(level: string) {
  if (level.includes("상")) return "risk-high";
  if (level.includes("중")) return "risk-medium";
  return "risk-low";
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

function buildInputFieldBrief(
  question: string,
  example: FieldExample,
  weather: WeatherBrief | null,
  isWeatherLoading: boolean
): FieldBrief {
  const weatherSummary = weather?.summary || inferWeatherFromText(question, example.weatherSignal);
  return {
    companyName: example.companyName,
    siteName: weather?.locationLabel || inferLocationFromText(question, example.region),
    industry: example.industry,
    workSummary: example.workType,
    workerCount: inferWorkerCountFromText(question),
    weather: isWeatherLoading ? "현재 기상 확인 중" : weatherSummary,
    sourceLabel: isWeatherLoading ? "기상청 확인 중" : weather?.mode === "live" ? "현재 기상 반영" : "입력+기상 보강",
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
  const [checkedActions, setCheckedActions] = useState<boolean[]>([]);
  const [liveWeather, setLiveWeather] = useState<WeatherBrief | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  function scrollToStep(anchor: StepAnchor) {
    const target = document.getElementById(anchor);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
        setCheckedActions(payload.riskSummary.immediateActions.map(() => false));
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
    setLiveWeather(null);
    setState("idle");
    setMessage(`${example.label} 현장 예시를 불러왔습니다. 필요하면 작업 조건을 수정한 뒤 생성하세요.`);
  }

  useEffect(() => {
    const trimmed = question.trim();
    if (data || trimmed.length < 8) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsWeatherLoading(true);
      fetch(`/api/weather?question=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as WeatherBriefResponse;
          if (!response.ok || !payload.ok || !payload.weather) {
            throw new Error(payload.message || `weather request failed: HTTP ${response.status}`);
          }
          setLiveWeather(payload.weather);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.warn("weather brief refresh failed", error);
          setLiveWeather(null);
        })
        .finally(() => setIsWeatherLoading(false));
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [data, question]);

  useEffect(() => {
    if (!autoGenerate) return;
    void generateWorkpack(initialQuestion);
    // Run once for URL-provided queries only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state === "generating" || isPending;
  const currentStep = activeStep(state);
  const statuses = stepStatuses(state);
  const fieldBrief = data ? buildApiFieldBrief(data, selectedExample) : buildInputFieldBrief(question, selectedExample, liveWeather, isWeatherLoading);
  const currentLawCount = lawCount(data, state);
  const currentDocProgress = docProgress(data, state);
  const inputLimit = 600;
  const inputWarning = question.length > Math.floor(inputLimit * 0.9);

  return (
    <main className="command-center-shell">
      <header className="command-topbar">
        <Link href="/" className="brand-lockup safeclaw-lockup" aria-label="SafeGuard 홈으로 이동">
          <span className="brand-mark">S</span>
          <span>
            <strong>SafeGuard</strong>
            <small>현장 안전 문서팩</small>
          </span>
        </Link>
        <nav className="topnav command-stepper" aria-label="작업 단계" role="tablist">
          {workflowSteps.map((step) => (
            <button
              type="button"
              role="tab"
              aria-selected={step.key === currentStep}
              aria-current={step.key === currentStep ? "step" : undefined}
              aria-controls={stepAnchors[step.key]}
              className={step.key === currentStep ? "active" : ""}
              key={step.key}
              onClick={() => scrollToStep(stepAnchors[step.key])}
              title={step.caption}
            >
              <StepDot status={statuses[step.key]} />
              <span className="step-copy">
                <small>{step.id} · {stepStatusCopy(statuses[step.key])}</small>
                <strong>{step.label}</strong>
              </span>
            </button>
          ))}
        </nav>
        <div className="topbar-status" aria-live="polite">
          <span>{statusCopy(state)}</span>
          <b>{operationalStatus(data, state)}</b>
        </div>
      </header>

      <section className="command-viewport" id="command">
        <aside className="command-left-panel">
          <section className="left-panel-card live-status-widget">
            <div className="left-widget-head">
              <span>연결 상태</span>
              <b>{state === "idle" ? "대기" : state === "generating" ? "확인 중" : state === "ready" ? "완료" : "점검"}</b>
            </div>
            <div className="status-row-list">
              <div className={`status-row ${statusRowState(state !== "idle")}`}>
                <span>현재 단계</span>
                <b>{statusCopy(state)}</b>
              </div>
              <div className={`status-row ${statusRowState(Boolean(data?.externalData.weather.mode === "live" || liveWeather?.mode === "live"), isWeatherLoading)}`}>
                <span>기상청 현재</span>
                <b>{weatherStatusLabel(data, liveWeather, isWeatherLoading)}</b>
              </div>
              <div className={`status-row ${statusRowState(currentLawCount > 0)}`}>
                <span>법령 매칭</span>
                <b>{currentLawCount}건</b>
              </div>
              <div className={`status-row ${statusRowState(currentDocProgress > 0)}`}>
                <span>문서 작성</span>
                <b>{currentDocProgress}/{totalDocumentCount}</b>
              </div>
              <div className={`status-row ${statusRowState(Boolean(data || liveWeather?.mode === "live"))}`}>
                <span>API 조합</span>
                <b>{apiStackLabel(data, liveWeather)}</b>
              </div>
            </div>
            <div className="left-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(8, (currentDocProgress / totalDocumentCount) * 100)}%` }} />
            </div>
          </section>

          <section className="left-panel-card field-brief-mini">
            <div className="left-widget-head">
              <span>현장 브리프</span>
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
              <span>최근 문서팩</span>
              <b>{data ? "현재 작업" : "대기"}</b>
            </div>
            <div className="recent-list">
              {data ? (
                <button type="button" onClick={() => scrollToStep("workpack")}>
                  <i aria-hidden="true" />
                  <span>
                    <strong>{data.scenario.workSummary}</strong>
                    <small>방금 생성 · 근거 {data.citations.length}건 · 문서 {totalDocumentCount}/{totalDocumentCount}</small>
                  </span>
                </button>
              ) : <p className="muted small">최근 문서팩이 없습니다. 첫 문서팩을 생성하면 여기에 표시됩니다.</p>}
            </div>
          </section>
        </aside>

        <section className="command-main card command-main-studio">
          <div className="command-copy">
            <span className="eyebrow">현장 문서 작업공간</span>
            <h1>오늘 작업을 한 줄로, 실행 가능한 안전 문서팩으로.</h1>
            <p>
              현장 조건을 입력하면 위험성평가, 작업계획, TBM, 안전교육, 외국인 안내문,
              현장 전파 메시지와 이력 저장까지 하나의 작업공간에서 처리합니다.
            </p>
          </div>

          <form className="command-console" onSubmit={submit}>
            <div className="console-head">
              <label htmlFor="field-command-input">현장 상황 입력</label>
              <span className={inputWarning ? "counter warning" : "counter"}>{question.length}/{inputLimit}자</span>
            </div>
            <textarea
              id="field-command-input"
              className="textarea command-console-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={inputLimit}
              placeholder="오늘 작업 내용을 한 줄로 입력하세요."
              aria-describedby="field-command-tips"
            />
            <p className="input-helper" id="field-command-tips">
              작성 팁: 지역, 업종, 작업인원, 장비, 날씨/조건, 신규·외국인 근로자 여부, 핵심 위험을 포함하면 정확도가 올라갑니다.
            </p>
            <div className="command-actions">
              <button type="submit" className="button command-primary" disabled={busy} aria-busy={busy}>
                {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
                {busy ? "법령 매칭 중" : "선택한 현장으로 생성"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  if (question !== selectedExample.question && !window.confirm("현재 입력한 내용을 예시 문장으로 되돌릴까요?")) {
                    return;
                  }
                  setQuestion(selectedExample.question);
                  setData(null);
                  setState("idle");
                }}
              >
                예시로 되돌리기
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
                aria-pressed={example.id === selectedExample.id}
              >
                {example.id === selectedExample.id ? <span aria-hidden="true">✓</span> : null}
                {example.label}
              </button>
            ))}
          </div>

          <section className="evidence-live-panel" id="risk">
            <div className="compact-head">
              <span className="eyebrow">근거 매칭</span>
              <strong>{currentLawCount ? `${currentLawCount}건 연결` : "생성 후 연결"}</strong>
            </div>
            <p>{message || "기상청은 현재 지역 조건을 먼저 확인하고, 생성 시 법령·해석례·판례·KOSHA·교육·재해사례·AI를 조합합니다."}</p>
            <div className="api-proof-grid" aria-label="API 조합 반영 위치">
              {[
                ["기상청", data?.externalData.weather.mode || liveWeather?.mode, "현장 브리프·TBM·작업중지 기준"],
                ["Law.go", data?.status.lawgo, "위험성평가·TBM·교육 근거"],
                ["Work24", data?.status.work24, "후속 교육 추천"],
                ["KOSHA", data?.status.kosha, "공식자료·재해사례"]
              ].map(([label, mode, impact]) => (
                <div key={label} className={mode === "live" ? "api-proof live" : mode ? "api-proof warn" : "api-proof"}>
                  <strong>{label}</strong>
                  <span>{mode === "live" ? "연결됨" : mode ? "일부 근거 보류" : "생성 후 확인"}</span>
                  <small>{impact}</small>
                </div>
              ))}
            </div>
            <div className={`inline-progress ${busy ? "animated" : ""}`} aria-label={`문서 작성 진행률 ${currentDocProgress}/${totalDocumentCount}`}>
              <span style={{ width: `${Math.max(8, (currentDocProgress / totalDocumentCount) * 100)}%` }} />
            </div>
          </section>

          <section className="output-card-grid" id="workpack">
            <div className="compact-head">
              <span className="eyebrow">생성 문서</span>
              <strong>{currentDocProgress}/{totalDocumentCount}</strong>
            </div>
            <div className="doc-card-list">
              {outputItems.map((item, index) => (
                <article key={item} className={data ? "doc-card done" : busy && index < 2 ? "doc-card active" : "doc-card"}>
                  <span>DOC · {String(index + 1).padStart(2, "0")}</span>
                  <strong>{item}</strong>
                  <p>{data ? "편집·다운로드 준비" : busy && index < 2 ? "작성 중" : "생성 대기"}</p>
                  {data ? (
                    <div className="doc-card-actions">
                      <button type="button" onClick={() => scrollToStep("workpack")}>편집</button>
                      <button type="button" onClick={() => scrollToStep("workpack")}>다운로드</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="dispatch-preview-panel" id="dispatch-overview">
            <div>
              <span className="eyebrow">현장 전파</span>
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
              <strong className={`risk-badge ${riskToneClass(data.riskSummary.riskLevel)}`}>위험도 {data.riskSummary.riskLevel}</strong>
            </article>
            <article>
              <span>핵심 위험</span>
              <strong>{data.riskSummary.topRisk}</strong>
            </article>
            <article>
              <span>연결 상태</span>
              <strong>{data.status.summary}</strong>
              <small className="muted">{statusDetailCopy(state)}</small>
            </article>
          </section>
          <section className="action-strip">
            {data.riskSummary.immediateActions.map((item, index) => (
              <article key={item} className="action-tile">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{item}</strong>
                <label className="action-check">
                  <input
                    type="checkbox"
                    checked={checkedActions[index] || false}
                    onChange={(event) => setCheckedActions((current) => current.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked))}
                  />
                  확인 완료
                </label>
              </article>
            ))}
          </section>
          <FieldOperationsWorkspace data={data} />
        </>
      ) : (
        <section className="empty-workspace card" id="workpack">
          <div>
            <span className="eyebrow">작업공간 준비</span>
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
