"use client";

import { useEffect, useState } from "react";
import { AgentConsole } from "./AgentConsole";
import { stagePersonaCopy, docPersonaCopy, type AgentConsoleLine } from "@/lib/agent-console-copy";

// Fixed replay of a real /api/ask/stream run. Labels are pulled from the same
// persona copy the live workspace console uses (lib/agent-console-copy.ts) — no
// invented features, identical wording to the real screen.
const SEQUENCE: Array<{ id: string; label: string }> = [
  { id: "stage:weather", label: stagePersonaCopy("weather") },
  { id: "stage:lawgo", label: stagePersonaCopy("lawgo") },
  { id: "stage:kosha", label: stagePersonaCopy("kosha") },
  { id: "stage:accidentCases", label: stagePersonaCopy("accidentCases") },
  { id: "stage:training", label: stagePersonaCopy("training") },
  { id: "doc:riskAssessment", label: docPersonaCopy("riskAssessment") },
  { id: "doc:tbmBriefingStructured", label: docPersonaCopy("tbmBriefingStructured") },
  { id: "doc:educationRecordStructured", label: docPersonaCopy("educationRecordStructured") },
  { id: "doc:foreign", label: docPersonaCopy("foreign") }
];

const FINAL: AgentConsoleLine = { id: "final", label: "문서팩 준비 완료 — 특이사항 0건", status: "ok" };

// One extra frame reveals the final summary; HOLD frames keep the full view
// before the loop restarts.
const TOTAL = SEQUENCE.length + 1;
const HOLD = 3;
const STEP_MS = 1400;

function framesFor(count: number): AgentConsoleLine[] {
  const complete = count > SEQUENCE.length;
  const revealed = Math.min(count, SEQUENCE.length);
  const lines: AgentConsoleLine[] = SEQUENCE.slice(0, revealed).map((line, index) => {
    const isNewest = index === revealed - 1;
    const status: AgentConsoleLine["status"] = !complete && isNewest ? "active" : "ok";
    return { ...line, status };
  });
  if (complete) lines.push(FINAL);
  return lines;
}

export function HeroConsoleReplay() {
  // Start at 1 so the first line is visible immediately and the loop never
  // flashes an empty console.
  const [tick, setTick] = useState(1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    if (media.matches) return;
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % (TOTAL + HOLD + 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const count = reduced ? TOTAL : Math.max(1, Math.min(tick, TOTAL));
  const lines = framesFor(count);
  const active = !reduced && count < TOTAL;

  return (
    <aside className="hero-console-replay" aria-label="AI 안전관리자 콘솔 데모">
      <div className="hero-console-frame">
        <div className="hero-console-titlebar">
          <span className="hero-console-dot" aria-hidden="true" />
          <span className="hero-console-dot" aria-hidden="true" />
          <span className="hero-console-dot" aria-hidden="true" />
          <b>safeclaw · AI 안전관리자</b>
          <em>{active ? "생성 중" : "생성 완료"}</em>
        </div>
        <div className="hero-console-prompt">
          <span>작업 입력</span>
          <p>세이프건설 서울 성수동 외벽 도장 · 이동식 비계 · 오후 강풍 · 신규 작업자 1명</p>
        </div>
        <AgentConsole lines={lines} active={active} />
      </div>
    </aside>
  );
}
