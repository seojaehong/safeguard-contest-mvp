import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AnswerPanel } from "@/components/AnswerPanel";
import { CitationList } from "@/components/CitationList";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { runPublicAskOperation } from "@/lib/public-ask-operation";
import { createPublicPageAdmissionRequest, readPublicAdmissionMessage } from "@/lib/public-page-admission";
import { resolveRunAskMode } from "@/lib/run-ask-mode";

export const metadata: Metadata = {
  title: "안전 질의 | SafeClaw",
  description: "현장 상황을 질문하면 법령·기상·교육 근거와 함께 안전 조치 답변을 제공하는 안전 질의 페이지입니다."
};

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q || "하청 작업에서 원청의 안전보건 책임을 실무적으로 어떻게 확인해야 하나요?";
  const incomingHeaders = await headers();
  const request = createPublicPageAdmissionRequest("/ask", incomingHeaders.entries());
  const operation = await runPublicAskOperation({
    request,
    question: q,
    aiMode: resolveRunAskMode({ envDefault: process.env.AI_MODE_DEFAULT }),
  });
  const admissionMessage = operation.ok ? null : await readPublicAdmissionMessage(operation.response);

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
        <pre>{q}</pre>
      </section>
      {operation.ok ? (
        <section className="safeclaw-module-grid two">
          <AnswerPanel data={operation.data} />
          <CitationList citations={operation.data.citations} question={q} />
        </section>
      ) : (
        <section className="safeclaw-module-panel" role="status">
          <span>요청 보호</span>
          <h2>질의 작업을 잠시 보류했습니다.</h2>
          <p>{admissionMessage}</p>
        </section>
      )}
    </SafeClawModuleShell>
  );
}
