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

function buildSeedStats(example: FieldExample) {
  return [
    { label: "지역", value: example.region },
    { label: "업종", value: example.industry },
    { label: "작업", value: example.workType },
    { label: "날씨", value: example.weatherSignal }
  ];
}

function statusCopy(state: GenerationState) {
  if (state === "generating") return "생성 중";
  if (state === "ready") return "문서팩 준비";
  if (state === "error") return "연결 점검 필요";
  return "입력 대기";
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
    setMessage("법령, 기상, 교육, 재해사례 근거를 모아 문서팩을 생성하고 있습니다.");
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
        setMessage("문서팩을 준비했습니다. 아래에서 수정, 다운로드, 전파를 이어가세요.");
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
    setMessage(`${example.label} 예시를 불러왔습니다. 필요하면 문구를 수정한 뒤 생성하세요.`);
  }

  useEffect(() => {
    if (!autoGenerate) return;
    void generateWorkpack(initialQuestion);
    // Run once for URL-provided queries only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedStats = buildSeedStats(selectedExample);
  const busy = state === "generating" || isPending;

  return (
    <main className="command-center-shell">
      <header className="command-topbar">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">S</span>
          <span>
            <strong>SafeGuard</strong>
            <small>Field workpack OS</small>
          </span>
        </Link>
        <nav className="topnav" aria-label="주요 메뉴">
          <a href="#command">작업입력</a>
          <a href="#workpack">문서팩</a>
          <a href="#references">근거</a>
          <Link href="/search">근거검색</Link>
        </nav>
      </header>

      <section className="command-viewport" id="command">
        <aside className="mission-rail">
          <div className="rail-kicker">Today</div>
          {[
            ["01", "작업 입력"],
            ["02", "위험 판단"],
            ["03", "문서팩 편집"],
            ["04", "근거 확인"],
            ["05", "현장 전파"]
          ].map(([step, label]) => (
            <div key={step} className="mission-step">
              <span>{step}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </aside>

        <section className="command-main card">
          <div className="command-copy">
            <span className="eyebrow">Field command center</span>
            <h1>오늘 작업을 바로 실행 가능한 안전 문서팩으로.</h1>
            <p>
              현장 설명 한 줄을 위험성평가표, 작업계획서, TBM, 안전보건교육 기록,
              외국인 근로자 안내문, 현장 전파 메시지로 정리합니다.
            </p>
          </div>

          <form className="command-console" onSubmit={submit}>
            <label htmlFor="field-command-input">현장 상황 입력</label>
            <textarea
              id="field-command-input"
              className="textarea command-console-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: 외벽 도장, 이동식 비계, 작업자 5명, 오후 강풍, 신규 투입자, 지게차 동선 혼재"
            />
            <div className="command-actions">
              <button type="submit" className="button command-primary" disabled={busy}>
                {busy ? "생성 중" : "문서팩 생성"}
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
                예시 복원
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
              </button>
            ))}
          </div>
        </section>

        <aside className="command-side">
          <section className="status-board card">
            <div className="compact-head">
              <span className="eyebrow">Status</span>
              <strong>{statusCopy(state)}</strong>
            </div>
            <p>{message || "입력 후 생성하면 근거와 문서팩이 아래 작업공간에 표시됩니다."}</p>
            <div className={`status-orb ${state}`} aria-hidden="true" />
          </section>

          <section className="field-brief-card card">
            <span className="eyebrow">작업 브리프</span>
            <strong>{selectedExample.companyName}</strong>
            <div className="brief-stat-grid">
              {seedStats.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="output-stack card">
            <span className="eyebrow">생성 항목</span>
            {["위험성평가표", "작업계획서", "TBM", "안전보건교육", "외국인 전송본", "현장 전파"].map((item) => (
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
            <span className="eyebrow">Ready</span>
            <h2>문서팩 생성 전입니다.</h2>
            <p>첫 화면은 즉시 열리고, 생성 작업은 버튼을 누른 뒤 진행됩니다. 발표나 현장 시연에서는 이 상태에서 입력 흐름을 먼저 설명할 수 있습니다.</p>
          </div>
          <div className="empty-preview-grid">
            {["문서팩 편집", "근거 확인", "현장 전파"].map((item) => (
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
