import Link from "next/link";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { getLatestDryrunReport, getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { toDryrunPresentationSnapshot } from "@/lib/web-safe-presentation";

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

  let snapshot: ReturnType<typeof toDryrunPresentationSnapshot> = null;
  try {
    snapshot = toDryrunPresentationSnapshot(getLatestDryrunSnapshot());
  } catch (error: unknown) {
    console.error("dry-run snapshot presentation read failed", error);
  }
  const report = getLatestDryrunReport();

  return (
    <SafeClawModuleShell
      eyebrow="운영 점검"
      title="문서 생성 점검."
      description="위험성평가, TBM, 작업계획서 등 문서형 산출물의 생성 상태와 응답 품질을 운영 관점에서 추적합니다."
      status={snapshot ? "live" : "partial"}
      mappedTo="생성 점검 · 기록 · 상세 결과"
      activeHref="/dryrun"
      actions={<Link href="/ops/api">연결 상태</Link>}
    >
      {snapshot ? (
        <section className="safeclaw-module-panel dryrun-card">
          <div className="safeclaw-module-grid four dryrun-metrics">
            <article><span>실행 ID</span><strong>{snapshot.runId}</strong></article>
            <article><span>성공</span><strong>{snapshot.okCount}/{snapshot.totalRuns}</strong></article>
            <article><span>평균 응답</span><strong>{snapshot.avgMs}밀리초</strong></article>
            <article><span>P95</span><strong>{snapshot.p95Ms}밀리초</strong></article>
          </div>
          <h2>{snapshot.qualityNote}</h2>
          <details>
            <summary>상세 점검 기록</summary>
            <p>
              요약: <code>{snapshot.summaryPath}</code><br />
              보고서: <code>{snapshot.reportPath}</code>
            </p>
          </details>
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
                  <span className={item.ok ? 'status-pill ok' : 'status-pill warn'}>{item.ok ? '정상' : '확인 필요'}</span>
                </div>
                <p className="muted small">{item.answerPreview || '미리보기 없음'}</p>
                <p className="muted tiny">소요 {item.elapsedMs}밀리초 · 답변 {item.answerLength}자 · 인용 {item.citations}건</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report ? (
        <details className="safeclaw-module-panel dryrun-card">
          <summary>상세 점검 기록</summary>
          <pre className="dryrun-report">{report}</pre>
        </details>
      ) : null}
    </SafeClawModuleShell>
  );
}
