import Link from "next/link";
import { getLatestDryrunReport, getLatestDryrunSnapshot } from "@/lib/dryrun-status";

export const dynamic = "force-dynamic";

export default function DryrunPage() {
  const snapshot = getLatestDryrunSnapshot();
  const report = getLatestDryrunReport();

  return (
    <main className="container grid" style={{ paddingTop: 36, paddingBottom: 48 }}>
      <section className="hero grid" style={{ gap: 18 }}>
        <span className="badge">SafeGuard 운영 점검</span>
        <div className="grid" style={{ gap: 12 }}>
          <h1 className="title">문서 생성 점검 로그</h1>
          <p className="subtitle">
            위험성평가, TBM 일지, 작업계획서 등 문서형 산출물의 생성 상태와 응답 품질을 운영 관점에서 추적합니다.
          </p>
          <div className="row">
            <Link href="/" className="button secondary">홈으로</Link>
          </div>
        </div>
      </section>

      {snapshot ? (
        <section className="card list dryrun-card">
          <div className="mini-grid dryrun-metrics">
            <div className="stat"><span className="muted">runId</span><strong>{snapshot.runId}</strong></div>
            <div className="stat"><span className="muted">성공</span><strong>{snapshot.okCount}/{snapshot.totalRuns}</strong></div>
            <div className="stat"><span className="muted">평균 응답</span><strong>{snapshot.avgMs}ms</strong></div>
            <div className="stat"><span className="muted">P95</span><strong>{snapshot.p95Ms}ms</strong></div>
          </div>
          <p className="lead">{snapshot.qualityNote.replaceAll("드라이런", "점검")}</p>
          <p className="muted small">
            summary: <code>{snapshot.summaryPath}</code><br />
            report: <code>{snapshot.reportPath}</code>
          </p>
        </section>
      ) : null}

      {snapshot?.highlights?.length ? (
        <section className="card list dryrun-card">
          <h2 className="h2">케이스별 결과</h2>
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
        <section className="card list dryrun-card">
          <h2 className="h2">원문 리포트</h2>
          <pre className="dryrun-report">{report}</pre>
        </section>
      ) : null}
    </main>
  );
}
