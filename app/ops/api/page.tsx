import Link from "next/link";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";

export const dynamic = "force-dynamic";

// Internal operations dashboard — not for search engines.
export const metadata = {
  robots: { index: false, follow: false }
};

export default async function ApiOperationsPage() {
  const snapshot = getLatestDryrunSnapshot();
  const safetyDb = await getSafetyReferenceStats();
  const publicDataSources = [
    {
      label: "기상청",
      title: "현재·예보 신호",
      body: "현장 브리프와 위험성평가·TBM의 작업중지 기준에 반영합니다."
    },
    {
      label: "Law.go",
      title: "법령·해석례",
      body: "산업안전보건법, 시행령, 시행규칙과 해석례를 직접·보조 근거로 분리합니다."
    },
    {
      label: "KOSHA",
      title: "자료·재해사례",
      body: "안전보건자료, 재해사례, 기술지원규정을 문서 반영 위치와 함께 연결합니다."
    },
    {
      label: "고용24 / Work24",
      title: "후속 교육 후보",
      body: "안전보건교육 기록과 외국인 브리핑에 교육 주제·이해확인 문구로 반영합니다."
    }
  ];

  return (
    <SafeClawModuleShell
      eyebrow="API 상태"
      title="API 연결."
      description="기상청, Law.go, KOSHA, Work24, Gemini, n8n 연결 상태와 최근 점검 결과를 운영자가 확인합니다."
      status="live"
      mappedTo="공공 API · 전파 채널 · 지식베이스 상태"
      activeHref="/ops/api"
      actions={<Link href="/knowledge">지식 DB 보기</Link>}
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
        <p>이 화면은 제출·운영용 요약만 보여줍니다. 원문 JSON, 내부 엔드포인트, 적재 경로는 관리자 검증 산출물에서만 확인합니다.</p>
      </section>
      <section className="safeclaw-module-grid four">
        {publicDataSources.map((source) => (
          <article key={source.label}>
            <span>{source.label}</span>
            <strong>{source.title}</strong>
            <p>{source.body}</p>
          </article>
        ))}
      </section>
      <section className="safeclaw-module-panel">
        <span>교육 API 반영</span>
        <h2>고용24와 KOSHA 교육포털은 별도 교육 근거로 표시합니다.</h2>
        <p>
          교육 추천은 문서 본문에 긴 근거 목록으로 덤프하지 않고, 안전보건교육 기록·외국인 브리핑의 교육 주제와 확인 질문에 연결합니다.
          근거 화면에서는 교육 연계 근거 그룹으로 분리해 심사자가 API 활용 여부를 바로 확인할 수 있습니다.
        </p>
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
          사용자 화면에는 연결 상태와 반영 위치만 표시하고, 내부 점검 주소는 노출하지 않습니다.
        </p>
      </section>
    </SafeClawModuleShell>
  );
}
