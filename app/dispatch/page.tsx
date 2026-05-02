import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { WorkflowSharePanel } from "@/components/WorkflowSharePanel";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  buildDefaultWorkers,
  buildRecipientSuggestions,
  buildWorkerDispatchTargets
} from "@/lib/workspace";

export default function DispatchPage() {
  const data = buildSampleWorkpack();
  const workers = buildDefaultWorkers(data);

  return (
    <SafeClawModuleShell
      eyebrow="Dispatch"
      title="현장 전파."
      description="메일과 문자 전송 흐름을 기존 n8n dispatch API와 전파 로그 API에 연결합니다. 카카오와 밴드는 준비 중으로 잠급니다."
      status="live"
      mappedTo="WorkflowSharePanel · /api/workflow/dispatch · /api/dispatch-logs"
      actions={<Link href="/workspace#dispatch">작업공간 전파 패널</Link>}
    >
      <section className="safeclaw-module-grid two">
        <WorkflowSharePanel
          data={data}
          recipientSuggestions={buildRecipientSuggestions(workers)}
          targetWorkers={buildWorkerDispatchTargets(workers)}
        />
        <article className="safeclaw-module-panel">
          <span>제출 기준 채널</span>
          <h2>메일·문자 우선.</h2>
          <p>전송 전 수신자, 채널, 언어, 메시지 미리보기를 확인한 뒤 provider 결과를 채널별로 표시합니다.</p>
          <ul>
            <li>메일: 관리자·원청 보고</li>
            <li>문자: 작업자 즉시 공지</li>
            <li>카카오·밴드: 승인 후 연결</li>
          </ul>
        </article>
      </section>
    </SafeClawModuleShell>
  );
}
