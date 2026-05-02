import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";

export default function WorkerMobilePage() {
  const data = buildSampleWorkpack();

  return (
    <SafeClawModuleShell
      eyebrow="작업자 모바일"
      title="작업자 모바일."
      description="작업자는 긴 문서 대신 오늘의 핵심 위험, 필수조치, 이해 확인만 봅니다."
      status="planned"
      mappedTo="신규 /worker"
      activeHref="/workers"
      actions={<Link href="/dispatch">전파 메시지 보기</Link>}
    >
      <section className="safeclaw-worker-phone">
        <article>
          <span>오늘 작업 안전공지</span>
          <h2>{data.scenario.siteName}</h2>
          <strong>{data.riskSummary.topRisk}</strong>
          <ul>
            {data.riskSummary.immediateActions.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <button type="button">이해했습니다</button>
        </article>
      </section>
    </SafeClawModuleShell>
  );
}
