import Link from "next/link";
import { getLatestDryrunSnapshot } from "@/lib/dryrun-status";
import { getSafetyReferenceStats } from "@/lib/safety-reference-catalog";
import { SafeClawModuleShell } from "@/components/SafeClawModuleShell";
import { toDryrunPresentationSnapshot } from "@/lib/web-safe-presentation";
import {
  assessEngineRuntimeReadiness,
  type EngineRuntimeReadiness,
} from "@/lib/engine-runtime-readiness-policy";

export const dynamic = "force-dynamic";

// Internal operations dashboard — not for search engines.
export const metadata = {
  robots: { index: false, follow: false }
};

function enginePresentation(readiness: EngineRuntimeReadiness): {
  mode: string;
  state: string;
  detail: string;
} {
  const mode = readiness.requestedMode === "experimental-hermes"
    ? "Hermes 로컬 검증"
    : readiness.requestedMode === "remote-hermes"
      ? "Hermes 원격 계약"
      : readiness.requestedMode === "local-openclaw"
        ? "OpenClaw 로컬 검증"
        : readiness.requestedMode === "unsupported"
          ? "지원하지 않는 설정"
          : "연결 전";
  if (readiness.state === "disabled") {
    return {
      mode,
      state: "비활성",
      detail: "SafeClaw 근거·도구는 유지되며, 별도 실행 엔진은 연결하지 않은 상태입니다.",
    };
  }
  if (readiness.state === "configuration-required") {
    return {
      mode,
      state: "설정 점검 필요",
      detail: `${readiness.issueCodes.length.toLocaleString("ko-KR")}개 실행 경계를 확인해야 합니다. 비밀값은 이 화면에 표시하지 않습니다.`,
    };
  }
  if (readiness.state === "remote-contract-ready") {
    return {
      mode,
      state: "실행 계층 연결 필요",
      detail: "원격 계약과 신뢰 전송 계층은 확인됐지만 지속 실행 원장이 연결되지 않아 실행하지 않습니다.",
    };
  }
  return {
    mode,
    state: "로컬 검증 단계",
    detail: "설정은 갖춰졌으며, 요청마다 OAuth·도구 차단·조직·현장 연결을 다시 확인합니다.",
  };
}

export default async function ApiOperationsPage() {
  let snapshot: ReturnType<typeof toDryrunPresentationSnapshot> = null;
  try {
    snapshot = toDryrunPresentationSnapshot(getLatestDryrunSnapshot());
  } catch (error: unknown) {
    console.error("API operations dry-run snapshot presentation read failed", error);
  }
  const safetyDb = await getSafetyReferenceStats();
  const engine = enginePresentation(assessEngineRuntimeReadiness(process.env));

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
        <article><span>실행 ID</span><strong>{snapshot?.runId || "대기"}</strong></article>
        <article><span>성공</span><strong>{snapshot ? `${snapshot.okCount}/${snapshot.totalRuns}` : "미확인"}</strong></article>
        <article><span>평균</span><strong>{snapshot ? `${snapshot.avgMs}밀리초` : "미확인"}</strong></article>
        <article><span>P95</span><strong>{snapshot ? `${snapshot.p95Ms}밀리초` : "미확인"}</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>운영 점검</span>
        <h2>{snapshot?.qualityNote || "최근 점검 결과가 없습니다."}</h2>
        <p>이 화면은 제출·운영용 요약만 보여줍니다. 원문 JSON, 내부 엔드포인트, 적재 경로는 관리자 검증 산출물에서만 확인합니다.</p>
      </section>
      <section className="safeclaw-module-grid four" aria-label="에이전트 엔진 운영 상태">
        <article><span>실행 엔진</span><strong>{engine.mode}</strong></article>
        <article><span>연결 상태</span><strong>{engine.state}</strong></article>
        <article><span>근거 권한</span><strong>SafeClaw 고정</strong></article>
        <article><span>사람 확인</span><strong>항상 필요</strong></article>
      </section>
      <section className="safeclaw-module-panel">
        <span>에이전트 실행 경계</span>
        <h2>{engine.state}</h2>
        <p>{engine.detail}</p>
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
