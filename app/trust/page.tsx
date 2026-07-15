import type { Metadata } from "next";
import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const metadata: Metadata = {
  title: "신뢰와 근거 | SafeClaw",
  description: "SafeClaw가 생성하는 문서의 법령·기상·교육 근거 연결과 데이터 처리 원칙을 소개합니다."
};

const trustItems = [
  ["인터뷰 인사이트", "실제 현장 담당자 인터뷰에서 확인한 반복 문서 작성, 외국인 교육, 제출 부담을 익명화해 정리합니다."],
  ["공식 근거", "법령, 기상, 교육, KOSHA 자료가 어느 문서에 반영됐는지 추적합니다."],
  ["동의 관리", "외부 공개 인용, 로고, 자문 정보는 사전 동의가 있는 항목만 표시합니다."],
  ["면책 고지", "모든 출력물은 공식 근거 기반 보조자료이며 현장 확인 후 사용해야 함을 명시합니다."]
];

const interviewQuestions = ["가장 오래 걸리는 안전 문서 업무", "외국인 교육 전달 방식", "원청 또는 관공서 제출 부담", "새 도구 도입 승인자", "베타 참여 조건"];

export default function TrustPage() {
  return (
    <SafeClawModuleShell
      eyebrow="신뢰 기준"
      title="검증과 고지."
      description="제품에서 확인 가능한 증거와 검증 예정 항목을 분리하고, 인터뷰·근거·동의·면책 기준을 관리합니다."
      status="partial"
      mappedTo="근거 · 동의 · 면책 · 인터뷰"
      activeHref="/trust"
      actions={<Link href="/evidence">근거 확인</Link>}
    >
      <section className="safeclaw-module-grid two trust-grid">
        {trustItems.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="safeclaw-module-panel interview-card">
        <div className="compact-head">
          <span className="eyebrow">인터뷰 스크립트</span>
          <h2>검증할 질문</h2>
        </div>
        <div className="interview-question-list">
          {interviewQuestions.map((question, index) => (
            <span key={question}>{String(index + 1).padStart(2, "0")} · {question}</span>
          ))}
        </div>
      </section>
    </SafeClawModuleShell>
  );
}
