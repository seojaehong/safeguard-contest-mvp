import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { getLatestDryrunReport, getLatestDryrunSnapshot } from "@/lib/dryrun-status";

export const dynamic = "force-dynamic";

// Internal QA / dry-run log — not for search engines.
export const metadata = {
  robots: { index: false, follow: false }
};

export default async function DryrunPage({
  searchParams,
}: {
  searchParams: Promise<{ __auditBoundary?: string }>;
}) {
  const query = await searchParams;
  if (process.env.SAFECLAW_FRONTEND_AUDIT === "1" && query.__auditBoundary === "error") {
    throw new Error("SafeClaw deterministic frontend audit error boundary probe");
  }
  const snapshot = getLatestDryrunSnapshot();
  const report = getLatestDryrunReport();

  return (
    <SafeClawModuleShell
      eyebrow="운영 점검"
      title="문서 생성 점검."
      description="위험성평가, TBM, 작업계획서 등 문서형 산출물의 생성 상태와 응답 품질을 운영 관점에서 추적합니다."
      status={snapshot ? "live" : "partial"}
      mappedTo="생성 점검 · 로그 · 원문 리포트"
      activeHref="/dryrun"
      actions={<Link href="/ops/api">API 상태</Link>}
    >
      {snapshot ? (
        <section className="safeclaw-module-panel dryrun-card">
          <div className="safeclaw-module-grid four dryrun-metrics">
            <article><span>runId</span><strong>{snapshot.runId}</strong></article>
            <article><span>성공</span><strong>{snapshot.okCount}/{snapshot.totalRuns}</strong></article>
            <article><span>평균 응답</span><strong>{snapshot.avgMs}ms</strong></article>
            <article><span>P95</span><strong>{snapshot.p95Ms}ms</strong></article>
          </div>
          <h2>{snapshot.qualityNote.replaceAll("드라이런", "점검")}</h2>
          <p>
            summary: <code>{snapshot.summaryPath}</code><br />
            report: <code>{snapshot.reportPath}</code>
          </p>
        </section>
      ) : null}

      {snapshot?.highlights?.length ? (
        <section className="safeclaw-module-panel dryrun-card">
          <span>케이스별 결과</span>
          <div className="dryrun-case-list">
            {snapshot.highlights.map((item) => (
              <article key={item.id} className="dryrun-case-item">
                <div className="dryrun-case-head">
                  <strong>{item.label}</strong>
                  <span className={item.ok ? 'status-pill ok' : 'status-pill warn'}>{item.ok ? 'ok' : 'check'}</span>
                </div>
                <p className="muted small">{item.answerPreview || 'preview unavailable'}</p>
                <p className="muted tiny">elapsed {item.elapsedMs} ms · answer {item.answerLength} chars · citations {item.citations}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report ? (
        <section className="safeclaw-module-panel dryrun-card">
          <span>원문 리포트</span>
          <pre className="dryrun-report">{report}</pre>
        </section>
      ) : null}
    </SafeClawModuleShell>
  );
}
