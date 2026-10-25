"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { readPublicAdmissionMessage } from "@/lib/public-page-admission";
import type { AskResponse } from "@/lib/types";

type AskLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: AskResponse }
  | { status: "held"; message: string };

// 화면을 여는 것만으로는 질의를 보내지 않는다. 사용자가 「질의 실행」을 눌렀을 때만
// /api/ask 를 부른다(검색 엔진·미리보기 방문이 AI 작업을 일으키지 않도록).
export function AskLivePage({ question }: { question: string }) {
  const [state, setState] = useState<AskLoadState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  // 화면을 떠나면 진행 중인 질의만 취소한다(열 때 질의를 시작하지 않는다).
  useEffect(() => () => controllerRef.current?.abort(new Error("Ask page navigation cancelled provider work")), []);

  const runAsk = useCallback(() => {
    controllerRef.current?.abort(new Error("Ask page request replaced"));
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });
    void fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const message = await readPublicAdmissionMessage(response);
        if (!controller.signal.aborted) setState({ status: "held", message });
        return;
      }
      const payload = await response.json() as AskResponse;
      if (!controller.signal.aborted) setState({ status: "ready", data: payload });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("public Ask page request failed", error);
      setState({
        status: "held",
        message: "질의 연결을 완료하지 못했습니다. 잠시 후 다시 확인해 주세요.",
      });
    });
  }, [question]);

  return (
    <SafeClawModuleShell
      eyebrow="근거 질의"
      title="질문형 확인."
      description="법령·해석례·판례 근거를 먼저 고정하고, 문서팩 작성 전 현장 판단을 보조합니다."
      status="partial"
      mappedTo="근거 검색 · 답변 · 인용 자료"
      activeHref="/ask"
      actions={<Link href="/search">근거 검색</Link>}
    >
      <section className="safeclaw-module-panel">
        <span>현재 질문</span>
        <h2>문서 작성 전에 판단할 쟁점입니다.</h2>
        <pre>{question}</pre>
        <button type="button" className="button" onClick={runAsk} disabled={state.status === "loading"}>
          {state.status === "loading" ? "질의 중" : state.status === "idle" ? "질의 실행" : "다시 질의"}
        </button>
      </section>
      {state.status === "ready" ? (
        <section className="safeclaw-module-grid two">
          <AnswerPanel data={state.data} />
          <CitationList citations={state.data.citations} question={question} />
        </section>
      ) : state.status === "held" ? (
        <section className="safeclaw-module-panel" role="status" aria-live="polite">
          <span>요청 보호</span>
          <h2>질의 작업을 잠시 보류했습니다.</h2>
          <p>{state.message}</p>
        </section>
      ) : state.status === "loading" ? (
        <section className="safeclaw-module-panel" role="status" aria-live="polite" aria-busy="true">
          <span>근거 연결</span>
          <h2>질의 근거를 확인하고 있습니다.</h2>
        </section>
      ) : (
        <section className="safeclaw-module-panel" role="status" aria-live="polite">
          <span>질의 대기</span>
          <h2>「질의 실행」을 누르면 근거 확인을 시작합니다.</h2>
          <p>화면을 여는 것만으로는 질의를 보내지 않습니다.</p>
        </section>
      )}
    </SafeClawModuleShell>
  );
}
