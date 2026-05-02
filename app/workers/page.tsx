import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { buildSampleWorkpack } from "@/lib/sample-workpack";
import {
  buildDefaultWorkers,
  buildEducationRecordDrafts,
  maskPhone,
  summarizeWorkers
} from "@/lib/workspace";

export default function WorkersPage() {
  const data = buildSampleWorkpack();
  const workers = buildDefaultWorkers(data);
  const records = buildEducationRecordDrafts(workers, data.scenario.workSummary);
  const summary = summarizeWorkers(workers);

  return (
    <SafeClawModuleShell
      eyebrow="Workers"
      title="작업자·교육."
      description="작업자 최소정보, 언어, 교육 확인 상태를 기존 작업공간 저장 API와 같은 구조로 보여줍니다."
      status="partial"
      mappedTo="/api/workers · /api/education-records"
      actions={<Link href="/workspace#workers">작업공간에서 편집</Link>}
    >
      <section className="safeclaw-module-grid four">
        <article><span>선택</span><strong>{summary.selectedCount}명</strong></article>
        <article><span>외국인</span><strong>{summary.foreignCount}명</strong></article>
        <article><span>신규</span><strong>{summary.newCount}명</strong></article>
        <article><span>교육 확인</span><strong>{summary.educationPendingCount ? "필요" : "완료"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>작업 투입 적합성 카드</span>
        <h2>최소정보만 표시합니다.</h2>
        <div className="safeclaw-worker-table">
          {workers.map((worker) => {
            const record = records.find((item) => item.workerId === worker.id);
            return (
              <article key={worker.id}>
                <strong>{worker.displayName}</strong>
                <p>{worker.role} · {worker.nationality} · {worker.languageLabel}</p>
                <small>{worker.phone ? `문자 가능 ${maskPhone(worker.phone)}` : "연락처 필요"} · {record?.memo || worker.trainingSummary}</small>
              </article>
            );
          })}
        </div>
      </section>
    </SafeClawModuleShell>
  );
}
