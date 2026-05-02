import Link from "next/link";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const dynamic = "force-dynamic";

export default function ApiOperationsPage() {
  const snapshot = getLatestDryrunSnapshot();

  return (
    <SafeClawModuleShell
      eyebrow="API Operations"
      title="API 연결."
      description="기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결 상태를 제출 전 운영 화면으로 확인합니다."
      status="live"
      mappedTo="/dryrun · smoke reports"
      actions={<Link href="/dryrun">원문 점검 로그</Link>}
    >
      <section className="safeclaw-module-grid four">
        <article><span>Run</span><strong>{snapshot?.runId || "대기"}</strong></article>
        <article><span>성공</span><strong>{snapshot ? `${snapshot.okCount}/${snapshot.totalRuns}` : "미확인"}</strong></article>
        <article><span>평균</span><strong>{snapshot ? `${snapshot.avgMs}ms` : "미확인"}</strong></article>
        <article><span>P95</span><strong>{snapshot ? `${snapshot.p95Ms}ms` : "미확인"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>운영 점검</span>
        <h2>{snapshot?.qualityNote?.replaceAll("드라이런", "점검") || "최근 점검 결과가 없습니다."}</h2>
        <p>상세 JSON과 원문 리포트는 기존 `/dryrun`에서 그대로 확인합니다.</p>
      </section>
    </SafeClawModuleShell>
  );
}
