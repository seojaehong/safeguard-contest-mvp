import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function TbmFullscreenPage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="TBM 모드"
      title="TBM 풀스크린."
      description="현장에서 크게 띄워 읽는 작업 전 안전점검회의 화면입니다. TBM 질문과 필수조치를 회의용으로 압축합니다."
      status="planned"
      mappedTo="tbmBriefing · tbmQuestions"
      activeHref="/documents"
      actions={<Link href="/documents">TBM 문서 편집</Link>}
    >
      <section className="safeclaw-module-panel safeclaw-tbm-board">
        <span>작업 전 확인</span>
        <h2>{data.riskSummary.topRisk}</h2>
        <div>
          {data.deliverables.tbmQuestions.map((item, index) => (
            <article key={item}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>
    </SafeClawModuleShell>
  );
}
