"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FieldExample } from "@/lib/field-examples";

type DemoSpeed = "fast" | "normal" | "slow";

type DemoExperienceProps = {
  examples: FieldExample[];
  initialScenarioId: string;
  initialStep: number;
  initialMode: "live" | "offline";
  initialSpeed: DemoSpeed;
};

const demoStages = [
  "시나리오 선택",
  "현장 입력",
  "API 조합",
  "문서팩 생성",
  "핵심 3종",
  "외국인 전송본"
] as const;

const languagePreview = [
  ["vi", "Tiếng Việt", "Gió mạnh. Dừng làm việc nếu giàn giáo rung."],
  ["zh", "中文", "风大时请停止作业，并立即报告负责人。"],
  ["th", "ภาษาไทย", "ถ้าลมแรงหรือพื้นลื่น ให้หยุดงานและแจ้งหัวหน้า"],
  ["uz", "O'zbekcha", "Kuchli shamolda ishni to'xtating va rahbarga xabar bering."],
  ["mn", "Монгол", "Салхи хүчтэй бол ажлаа зогсоож удирдлагад мэдэгдэнэ."],
  ["ne", "नेपाली", "हावा बलियो भए काम रोक्नुहोस् र सुपरभाइजरलाई भन्नुहोस्."]
] as const;

function clampStep(step: number) {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(demoStages.length - 1, step));
}

function speedInterval(speed: DemoSpeed) {
  if (speed === "fast") return 1800;
  if (speed === "slow") return 4200;
  return 2800;
}

function scenarioRisk(example: FieldExample) {
  if (example.id.includes("construction")) return "강풍 중 이동식 비계 추락·전도";
  if (example.id.includes("logistics")) return "젖은 바닥과 지게차 동선 충돌";
  if (example.id.includes("manufacturing")) return "용접 불티 화재와 환기 불량";
  if (example.id.includes("facility")) return "밀폐공간 산소결핍과 감전";
  if (example.id.includes("cleaning")) return "화학세제 피부·호흡기 노출";
  return "작업조건 변화에 따른 현장 위험";
}

function primaryLanguages(example: FieldExample) {
  if (example.id.includes("logistics")) return "우즈베크어 · 몽골어";
  if (example.id.includes("manufacturing")) return "태국어 · 캄보디아어";
  if (example.id.includes("facility")) return "네팔어 · 미얀마어";
  if (example.id.includes("cleaning")) return "인도네시아어 · 영어";
  return "베트남어 · 중국어";
}

export function V2DemoExperience({
  examples,
  initialScenarioId,
  initialStep,
  initialMode,
  initialSpeed
}: DemoExperienceProps) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId);
  const [step, setStep] = useState(clampStep(initialStep));
  const [mode, setMode] = useState<"live" | "offline">(initialMode);
  const [presenterNotes, setPresenterNotes] = useState(false);
  const selectedScenario = useMemo(
    () => examples.find((example) => example.id === scenarioId) || examples[0],
    [examples, scenarioId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % demoStages.length);
    }, speedInterval(initialSpeed));
    return () => window.clearInterval(timer);
  }, [initialSpeed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const scenarioIndex = Number(event.key.replace("F", "")) - 1;
      if (event.key === " " || event.key === "ArrowRight") {
        event.preventDefault();
        setStep((current) => Math.min(demoStages.length - 1, current + 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStep((current) => Math.max(0, current - 1));
      } else if (event.key.toLowerCase() === "r") {
        setStep(0);
      } else if (event.key.toLowerCase() === "o") {
        setMode((current) => current === "offline" ? "live" : "offline");
      } else if (event.key.toLowerCase() === "p") {
        setPresenterNotes((current) => !current);
      } else if (scenarioIndex >= 0 && scenarioIndex < Math.min(5, examples.length)) {
        event.preventDefault();
        setScenarioId(examples[scenarioIndex].id);
        setStep(0);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [examples]);

  const stageProgress = ((step + 1) / demoStages.length) * 100;

  return (
    <main className="v2-shell demo-mode-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeGuard 홈">
          <span className="brand-mark">S</span>
          <span>
            <strong>SafeGuard v2</strong>
            <small>제품 시연 모드</small>
          </span>
        </Link>
        <nav>
          <Link href="/why">차별성</Link>
          <Link href="/preview">핵심 3종</Link>
          <Link href="/trust">신뢰</Link>
          <Link href="/roadmap">로드맵</Link>
        </nav>
      </header>

      <section className="demo-hero-grid">
        <aside className="demo-stage-panel">
          <span className="eyebrow">30초 자동 시연</span>
          <h1>한 줄 입력이 현장 안전 실행팩으로 바뀌는 순간을 보여줍니다.</h1>
          <p>
            발표용 화면입니다. 실제 제품 흐름을 짧게 압축하고, API 지연 시에는 사전 캐시 응답 사용 여부를 화면에 표시합니다.
          </p>
          <div className="demo-progress-track" aria-label={`시연 진행 ${step + 1}/${demoStages.length}`}>
            <span style={{ width: `${stageProgress}%` }} />
          </div>
          <ol className="demo-stage-list">
            {demoStages.map((stage, index) => (
              <li key={stage} className={index === step ? "active" : index < step ? "done" : ""}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage}</strong>
              </li>
            ))}
          </ol>
          <div className="demo-mode-badges">
            <button type="button" onClick={() => setMode(mode === "offline" ? "live" : "offline")}>
              {mode === "offline" ? "사전 캐시 응답" : "실시간 연결 우선"}
            </button>
            <button type="button" onClick={() => setPresenterNotes((current) => !current)}>
              발표자 노트 {presenterNotes ? "닫기" : "보기"}
            </button>
          </div>
        </aside>

        <section className="demo-screen card">
          <div className="demo-screen-top">
            <span>{demoStages[step]}</span>
            <b>{mode === "offline" ? "사전 캐시 응답 표시 중" : "실시간 연결 우선"}</b>
          </div>

          <div className="scenario-strip">
            {examples.slice(0, 5).map((example, index) => (
              <button
                key={example.id}
                type="button"
                className={example.id === selectedScenario.id ? "active" : ""}
                onClick={() => {
                  setScenarioId(example.id);
                  setStep(0);
                }}
              >
                <small>F{index + 1}</small>
                <strong>{example.label}</strong>
              </button>
            ))}
          </div>

          <article className="demo-input-card">
            <span>현장 입력</span>
            <p>{selectedScenario.question}</p>
          </article>

          <div className="api-pulse-grid">
            {["기상청", "Law.go", "Work24", "KOSHA"].map((label, index) => (
              <div key={label} className={step >= 2 || index < step ? "live" : ""}>
                <i aria-hidden="true" />
                <strong>{label}</strong>
                <span>{step >= 2 || index < step ? "문서 반영" : "대기"}</span>
              </div>
            ))}
          </div>

          <section className="primary-triad-grid">
            <article className="triad-card risk">
              <span>위험성평가표</span>
              <strong>{scenarioRisk(selectedScenario)}</strong>
              <p>4M 위험요인과 즉시 조치를 현장 문서 문장으로 정리합니다.</p>
            </article>
            <article className="triad-card tbm">
              <span>TBM</span>
              <strong>{selectedScenario.workType}</strong>
              <p>작업 전 회의에서 읽고 확인할 질문과 조치 기준을 만듭니다.</p>
            </article>
            <article className="triad-card foreign">
              <span>외국인 전송본</span>
              <strong>{primaryLanguages(selectedScenario)}</strong>
              <p>쉬운 한국어와 현장 언어 메시지를 분리해 전파합니다.</p>
            </article>
          </section>

          <div className="language-wall">
            {languagePreview.map(([code, label, line]) => (
              <div key={code}>
                <span>{label}</span>
                <p>{line}</p>
              </div>
            ))}
          </div>
        </section>
      </section>

      {presenterNotes ? (
        <section className="presenter-notes card">
          <strong>발표자 노트</strong>
          <p>Space로 다음 단계, F1~F5로 시나리오 전환, O로 사전 캐시 응답 모드를 전환합니다. API 상태 질문이 나오면 “실시간 연결 우선이며 지연 시 캐시 응답 사용 여부를 표시합니다”라고 설명합니다.</p>
        </section>
      ) : null}
    </main>
  );
}
