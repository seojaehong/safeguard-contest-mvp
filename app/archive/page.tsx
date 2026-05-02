import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

const archiveRows = [
  ["문서팩", "/api/workpacks", "관리자 로그인 후 생성 결과 저장"],
  ["전파 이력", "/api/dispatch-logs", "메일·문자 provider 결과 저장"],
  ["교육 기록", "/api/education-records", "작업자별 교육 확인 상태 저장"]
] as const;

export default function ArchivePage() {
  return (
    <SafeClawModuleShell
      eyebrow="Archive"
      title="이력·아카이브."
      description="과거 문서팩, 교육 확인, 전파 로그를 조회하는 화면입니다. 현재는 저장 API 연결 상태와 작업공간 진입을 먼저 제공합니다."
      status="partial"
      mappedTo="workpacks · dispatch_logs · education_records"
      actions={<Link href="/workspace#history">작업공간 이력 저장</Link>}
    >
      <section className="safeclaw-module-panel">
        <span>연결된 저장소</span>
        <h2>조회 화면으로 승격할 API 계약.</h2>
        <div className="safeclaw-archive-list">
          {archiveRows.map(([title, endpoint, description]) => (
            <article key={endpoint}>
              <strong>{title}</strong>
              <code>{endpoint}</code>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </SafeClawModuleShell>
  );
}
