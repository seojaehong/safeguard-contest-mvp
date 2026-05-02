import Link from "next/link";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const dynamic = "force-dynamic";

export default async function ApiOperationsPage() {
  const snapshot = getLatestDryrunSnapshot();
  const safetyDb = await getSafetyReferenceStats();

  return (
    <SafeClawModuleShell
      eyebrow="API 상태"
      title="API 연결."
      description="기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결 상태와 최근 점검 결과를 운영자가 확인합니다."
      status="live"
      mappedTo="/dryrun · smoke 리포트 · 지식 DB 상태"
      activeHref="/ops/api"
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
      <section className="safeclaw-module-grid four">
        <article><span>안전 지식 DB</span><strong>{safetyDb.ok ? "연결됨" : "점검 필요"}</strong></article>
        <article><span>전체 항목</span><strong>{safetyDb.items.toLocaleString("ko-KR")}건</strong></article>
        <article><span>기술지원규정</span><strong>{safetyDb.technicalTotal.toLocaleString("ko-KR")}건</strong></article>
        <article><span>적재 실행</span><strong>{safetyDb.ingestionRuns.toLocaleString("ko-KR")}회</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>지식 DB 연결</span>
        <h2>{safetyDb.message}</h2>
        <p>
          보완 생성, 근거 라이브러리, 지식 DB 화면은 같은 Supabase 카탈로그를 조회합니다.
          직접 점검은 <Link href="/api/safety-reference/status">/api/safety-reference/status</Link>에서 확인합니다.
        </p>
      </section>
    </SafeClawModuleShell>
  );
}
