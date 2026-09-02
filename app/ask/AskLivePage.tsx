"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { readPublicAdmissionMessage } from "@/lib/public-page-admission";
import type { AskResponse } from "@/lib/types";

type AskLoadState =
  | { status: "loading" }
  | { status: "ready"; data: AskResponse }
  | { status: "held"; message: string };

export function AskLivePage({ question }: { question: string }) {
  const [state, setState] = useState<AskLoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
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
    return () => controller.abort(new Error("Ask page navigation cancelled provider work"));
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
      ) : (
        <section className="safeclaw-module-panel" role="status" aria-live="polite" aria-busy="true">
          <span>근거 연결</span>
          <h2>질의 근거를 확인하고 있습니다.</h2>
        </section>
      )}
    </SafeClawModuleShell>
  );
}
