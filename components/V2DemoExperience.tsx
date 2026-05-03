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

function riskControls(example: FieldExample) {
  if (example.id.includes("logistics")) {
    return ["출입구 젖은 구간 즉시 표시", "지게차·보행자 동선 분리", "피킹 구역 신호수 배치"];
  }
  if (example.id.includes("manufacturing")) {
    return ["가연물 제거와 방염포 설치", "화재감시자 지정", "환기·소화기 위치 확인"];
  }
  if (example.id.includes("facility")) {
    return ["산소농도 측정 후 진입", "전기판넬 차단·잠금 확인", "2인 1조 연락체계 유지"];
  }
  if (example.id.includes("cleaning")) {
    return ["화학세제 MSDS 확인", "보안경·장갑 착용", "환기 후 미끄럼 구역 통제"];
  }
  if (example.id.includes("heat")) {
    return ["물·그늘 휴식 기준 공유", "고중량 운반 2인 작업", "온열질환 초기 증상 확인"];
  }
  return ["비계 고정핀·바퀴 잠금 확인", "강풍 시 작업중지 기준 공유", "지게차 접근금지 구역 표시"];
}

function coreDocuments(example: FieldExample) {
  const controls = riskControls(example);
  return [
    {
      code: "DOC·01",
      title: "점검결과 요약",
      body: `${example.region} ${example.workType}의 주요 위험은 ${scenarioRisk(example)}입니다. ${controls[0]}을 첫 조치로 지정합니다.`
    },
    {
      code: "DOC·02",
      title: "위험성평가표",
      body: `4M 기준으로 ${scenarioRisk(example)}을 위험도 상으로 분류하고, ${controls.join(" / ")}를 감소대책으로 둡니다.`
    },
    {
      code: "DOC·03",
      title: "작업계획서",
      body: `${example.companyName} ${example.region} 현장의 ${example.workType} 순서, 장비, 작업중지 기준, 확인자를 정리합니다.`
    },
    {
      code: "DOC·04",
      title: "TBM 브리핑",
      body: `작업 전 회의에서 “${controls[0]}을 누가 확인했는가”와 “작업중지 판단자는 누구인가”를 확인합니다.`
    },
    {
      code: "DOC·05",
      title: "TBM 기록",
      body: "참석자 확인, 보호구 착용, 미조치 위험요인, 사진·영상 기록 메모를 남기는 사후 기록입니다."
    },
    {
      code: "DOC·06",
      title: "안전보건교육 기록",
      body: `${example.skillMix} 조건을 반영해 작업중지 기준, 보호구, 위험구역 통제를 교육 확인 항목으로 둡니다.`
    },
    {
      code: "DOC·07",
      title: "비상대응 절차",
      body: "최초 발견자, 작업반장, 관리감독자, 현장소장 순서의 보고체계와 현장보존 기준을 정리합니다."
    },
    {
      code: "DOC·08",
      title: "사진·증빙",
      body: "작업 전 사진, 조치 전후 사진, TBM·교육 증빙, 확인자 기록 위치를 제공합니다."
    },
    {
      code: "DOC·09",
      title: "외국인 근로자 출력본",
      body: `${primaryLanguages(example)} 중심으로 쉬운 문장 안전 안내문을 생성합니다.`
    },
    {
      code: "DOC·10",
      title: "외국인 근로자 전송본",
      body: "문자·메신저로 보낼 수 있게 핵심 위험과 중지 기준을 짧은 문장으로 압축합니다."
    },
    {
      code: "DOC·11",
      title: "현장 공유 메시지",
      body: "관리자·작업자에게 전달할 현장, 작업, 핵심위험, 필수조치, TBM 안내 메시지입니다."
    }
  ];
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
  const controls = riskControls(selectedScenario);
  const documents = coreDocuments(selectedScenario);
  const isResultsVisible = step >= 3;

  return (
    <main className="v2-shell demo-mode-shell">
      <header className="v2-nav">
        <Link href="/" className="brand-lockup" aria-label="SafeClaw 홈">
          <span className="brand-mark">SC</span>
          <span>
            <strong>SafeClaw</strong>
            <small>작업 흐름</small>
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
          <span className="eyebrow">작업 흐름 미리보기</span>
          <h1>한 줄 입력이 현장 안전 실행팩으로 바뀌는 순간을 보여줍니다.</h1>
          <p>
            실제 제품 흐름을 짧게 압축하고, API 지연 시에는 사전 캐시 응답 사용 여부를 화면에 표시합니다.
          </p>
          <div className="demo-progress-track" aria-label={`작업 흐름 진행 ${step + 1}/${demoStages.length}`}>
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

          <section className="demo-result-brief" aria-label="생성 결과 요약">
            <div>
              <span>현장</span>
              <strong>{selectedScenario.region}</strong>
            </div>
            <div>
              <span>업종</span>
              <strong>{selectedScenario.industry}</strong>
            </div>
            <div>
              <span>날씨·조건</span>
              <strong>{selectedScenario.weatherSignal}</strong>
            </div>
            <div>
              <span>작업자 구성</span>
              <strong>{selectedScenario.skillMix}</strong>
            </div>
          </section>

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
              <p>{controls[0]} / {controls[1]} / {controls[2]}</p>
            </article>
            <article className="triad-card tbm">
              <span>TBM</span>
              <strong>{selectedScenario.workType}</strong>
              <p>작업 전 회의 질문: 작업중지 기준, 보호구 확인자, 위험구역 통제 담당자를 지정합니다.</p>
            </article>
            <article className="triad-card foreign">
              <span>외국인 전송본</span>
              <strong>{primaryLanguages(selectedScenario)}</strong>
              <p>위험하면 멈추고 관리자에게 말하세요. 이해하지 못하면 다시 설명을 요청하세요.</p>
            </article>
          </section>

          <section className={`demo-generated-pack ${isResultsVisible ? "visible" : ""}`}>
            <div className="demo-section-heading">
              <span>생성 결과</span>
              <strong>11종 문서팩</strong>
              <p>{isResultsVisible ? "선택한 현장 조건으로 생성된 산출물 요약입니다." : "문서팩 생성 단계에서 결과 요약이 열립니다."}</p>
            </div>
            <div className="demo-document-list">
              {documents.map((document, index) => (
                <article key={document.code} className={index < 3 ? "primary" : ""}>
                  <span>{document.code}</span>
                  <strong>{document.title}</strong>
                  <p>{document.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="demo-evidence-map">
            <div className="demo-section-heading">
              <span>문서 반영 근거</span>
              <strong>API 조합이 산출물에 들어가는 위치</strong>
            </div>
            <ul>
              <li><b>기상청</b><span>{selectedScenario.weatherSignal}을 작업중지 기준과 TBM 확인 질문에 반영</span></li>
              <li><b>Law.go</b><span>위험성평가표와 안전보건교육 기록의 법령 근거 문장에 반영</span></li>
              <li><b>Work24</b><span>{selectedScenario.hasForeignWorkers ? "외국인·신규 작업자 후속 교육 추천에 반영" : "작업자 후속 교육 후보에 반영"}</span></li>
              <li><b>KOSHA</b><span>공식자료와 재해사례를 사진·증빙, 비상대응, TBM 기록에 반영</span></li>
            </ul>
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
