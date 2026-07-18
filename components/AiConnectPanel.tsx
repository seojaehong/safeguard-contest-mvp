"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import {
  MCP_ENDPOINT_URL,
  buildOpenClawHarnessAgentCommand,
  buildOpenClawInstallCommand,
  buildOpenClawModelStatusCommand,
  buildOpenClawOauthLoginCommand,
  buildOpenClawProbeCommand,
} from "@/lib/mcp-connect";
import {
  buildPhotoFlowPresentation,
  formatCustomerFacingLabel,
  formatPhotoFileValidationMode,
  formatPhotoInputLimit,
  formatPhotoVisionStatus,
  formatSifApprovalDecisionForPresentation,
  formatSifApprovalStepStatusForPresentation,
  formatSifArtifactLabelForPresentation,
  formatSifChecklistStatusForPresentation,
  formatSifGateIdForPresentation,
  formatSifPreflightLabelForPresentation,
  formatSifRuntimeStatusForPresentation,
  formatSifTextForPresentation,
  readPhotoVisionPresentationPayload,
  type PhotoVisionPresentationPayload
} from "@/lib/web-safe-presentation";

let browserClient: SupabaseClient | null = null;

function getBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!browserClient) browserClient = createClient(url, anonKey);
  return browserClient;
}

type AiConnectTab = "harness" | "openclaw" | "claude" | "api";

type McpTokenSummary = {
  id: string;
  label: string;
  siteName: string;
  scopes: unknown;
  disabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

type TokenListResponse = {
  ok: boolean;
  configured: boolean;
  tokens: McpTokenSummary[];
  limit?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  message?: string;
};

type TokenIssueResponse = {
  ok: boolean;
  configured: boolean;
  plaintextToken?: string;
  token?: McpTokenSummary | null;
  message?: string;
};

type ActionResponse = {
  ok: boolean;
  configured?: boolean;
  message?: string;
};

type SifEmbeddingGateStatusResponse = {
  ok: boolean;
  stage: "ready-for-approval" | "degraded";
  message: string;
  generatedAt: string;
  approvalHeld: boolean;
  dbMutationPerformed: boolean;
  embeddingGenerated: boolean;
  uploaded: boolean;
  commandHeldUntilApproval: string;
  corpus: {
    itemCount: number;
    skippedCount: number;
    corpusCount: number;
    batchSize: number;
    batchCount: number;
    corpusHash: string;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddedCount: number;
    uploadedCount: number;
  };
  validation: {
    emptyEmbeddingTextCount: number;
    missingControlsCount: number;
    missingPrimaryDocumentsCount: number;
    duplicateContentHashCount: number;
  };
  approvalRequirements: {
    requiresDbMigrationApproval: boolean;
    requiresEmbeddingCostApproval: boolean;
    requiresApprovedUploadFlag: boolean;
  };
  runtime: {
    openaiApiKeyPresent: boolean;
    supabaseUrlPresent: boolean;
    supabaseServiceRolePresent: boolean;
    vectorFeatureFlagEnabled: boolean;
    executionReadyAfterApproval: boolean;
  };
  canary: {
    performed: boolean;
    label: string;
    answer: string;
    reportPath: string;
    vectorsPath: string | null;
    corpusCount: number;
    embeddedCount: number;
    uploadedCount: number;
    mode: string;
    embeddingModel: string;
    embeddingDimensions: number;
    corpusHash: string;
    dbMutationPerformed: boolean;
    artifactIntegrity: {
      label: string;
      path: string;
      exists: boolean;
      byteSize: number;
      sha256?: string;
      contentHash?: string;
      recordCount?: number;
      role: string;
    }[];
  };
  learningLifecycle: {
    productTerm: "retrieval_embedding_index";
    label: string;
    answer: string;
    modelFineTuningPerformed: false;
    corpusPrepared: boolean;
    fullEmbeddingGenerated: boolean;
    dbUploadVerified: boolean;
    vectorSearchUsable: boolean;
    nextGateId: "apply-sif-only-migration" | "prepare-runtime-env" | "approve-embedding-generation" | "approve-upload" | "enable-vector-search" | "disable-vector-flag" | "complete";
    nextGateLabel: string;
  };
  readinessVerdict: {
    state:
      | "corpus-ready-migration-required"
      | "runtime-env-required"
      | "embedding-awaits-approval"
      | "upload-awaits-approval"
      | "vector-activation-ready"
      | "vector-active"
      | "blocked";
    label: string;
    answer: string;
    nextAction: string;
    embeddingAlreadyRun: boolean;
    dbUploadAlreadyRun: boolean;
  };
  vectorGuard: {
    status: "locked" | "blocked" | "ready" | "active";
    label: string;
    message: string;
    flagEnabled: boolean;
    uploadVerified: boolean;
    uploadedCount: number;
    requiredUploadCount: number;
  };
  preflightChecks: {
    id: string;
    label: string;
    passed: boolean;
    evidenceSummary: string;
  }[];
  approvalSteps: {
    id: string;
    label: string;
    status: "waiting" | "blocked" | "ready" | "done";
    detail: string;
  }[];
  runtimeDbProbe: {
    status: string;
    message: string;
    tableReady: boolean;
    rpcReady: boolean;
    checkedAt: string;
  };
  nextApprovalGate: {
    id: "apply-sif-only-migration" | "prepare-runtime-env" | "approve-embedding-generation" | "approve-upload" | "enable-vector-search" | "disable-vector-flag" | "complete";
    label: string;
    status: "waiting" | "blocked" | "ready" | "done";
    detail: string;
    action: string;
    artifactPath?: string;
    command?: string;
  };
  operatorGate: {
    status: "approval-request-open" | "blocked" | "ready-to-execute" | "complete";
    gateId: "apply-sif-only-migration" | "prepare-runtime-env" | "approve-embedding-generation" | "approve-upload" | "enable-vector-search" | "disable-vector-flag" | "complete";
    title: string;
    approvalQuestion: string;
    evidenceSummary: string[];
    migrationArtifact: {
      path: string;
      exists: boolean;
      sha256: string | null;
    };
    canaryEvidence: {
      performed: boolean;
      embeddedCount: number;
      uploadedCount: number;
      mode: string;
      vectorsPath: string | null;
    };
    allowedBeforeApproval: string[];
    forbiddenBeforeApproval: string[];
    checklist: {
      id: string;
      label: string;
      status: "done" | "required" | "blocked";
      evidence: string;
    }[];
    postApprovalSequence: string[];
    heldCommands: string[];
    nonApprovalFallback: string;
  };
  postMigrationVerification: {
    reportPath: string;
    ok: boolean;
    status: string;
    expectedCorpusCount: number;
    uploadedCount: number;
    tableReady: boolean;
    rpcReady: boolean;
    vectorFeatureFlagEnabled: boolean;
    failedCheckIds: string[];
    nextAction: string;
    dbMutationPerformed: boolean;
  };
  approvalPacket: {
    scope: "sif_embedding_next_approval_gate";
    decisionCount: number;
    approvalFingerprint: string;
    decisions: string[];
    requiredArtifacts: {
      label: string;
      path: string;
      role: string;
    }[];
    safetyLocks: {
      label: string;
      locked: boolean;
      detail: string;
    }[];
    artifactIntegrity: {
      label: string;
      path: string;
      exists: boolean;
      byteSize: number;
      sha256?: string;
      contentHash?: string;
      recordCount?: number;
      role: string;
    }[];
  };
  failedCheckIds: string[];
  nextApprovalDecisions: string[];
  artifacts: {
    reportPath: string;
    manifestPath: string;
    corpusPath: string;
    migrationPath: string;
    scriptPath: string;
  };
};

const tabs: { id: AiConnectTab; label: string; body: string }[] = [
  {
    id: "harness",
    label: "근거 고정",
    body: "OpenClaw가 SafeClaw의 검증 근거를 먼저 확인하도록 연결합니다.",
  },
  {
    id: "openclaw",
    label: "OpenClaw/Codex",
    body: "상주 AI 안전관리자에 SafeClaw 도구를 연결합니다.",
  },
  {
    id: "claude",
    label: "Claude Desktop",
    body: "Claude 쪽 MCP 설정에 같은 엔드포인트와 토큰을 붙입니다.",
  },
  {
    id: "api",
    label: "API/MCP 직접 연결",
    body: "파트너 시스템이나 자동화에서 직접 호출할 때 사용합니다.",
  },
];

function formatDate(value: string | null) {
  if (!value) return "아직 사용 전";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function commandForTab(tab: AiConnectTab, token: string) {
  if (tab === "harness") {
    return [
      buildOpenClawOauthLoginCommand(),
      buildOpenClawModelStatusCommand(),
      buildOpenClawInstallCommand(token),
      buildOpenClawProbeCommand(),
      buildOpenClawHarnessAgentCommand(),
    ].join("\n");
  }
  if (tab === "openclaw") {
    return `${buildOpenClawInstallCommand(token)}\n${buildOpenClawProbeCommand()}`;
  }
  if (tab === "claude") {
    return `claude mcp add --transport http safeclaw ${MCP_ENDPOINT_URL} -H "Authorization: Bearer ${token}"`;
  }
  return `curl -s -X POST ${MCP_ENDPOINT_URL} \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json, text/event-stream" \\\n  -H "Authorization: Bearer ${token}" \\\n  --data-binary @payload.json`;
}

export function AiConnectPanel() {
  const client = getBrowserSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [tokens, setTokens] = useState<McpTokenSummary[]>([]);
  const [activeTab, setActiveTab] = useState<AiConnectTab>("harness");
  const [oneTimeToken, setOneTimeToken] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tokenListLimit, setTokenListLimit] = useState(25);
  const [tokenListHasMore, setTokenListHasMore] = useState(false);
  const [nextTokenCursor, setNextTokenCursor] = useState<string | null>(null);
  const [sifGate, setSifGate] = useState<SifEmbeddingGateStatusResponse | null>(null);
  const [sifGateMessage, setSifGateMessage] = useState("");
  const [photoVision, setPhotoVision] = useState<PhotoVisionPresentationPayload | null>(null);
  const [photoVisionMessage, setPhotoVisionMessage] = useState("");

  useEffect(() => {
    if (!client) {
      setSessionChecked(true);
      return;
    }

    client.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error: unknown) => console.warn("ai connect session load failed", error))
      .finally(() => setSessionChecked(true));

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [client]);

  const loadTokens = useCallback(async (accessToken: string, cursor?: string, append = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/mcp-tokens${params.size ? `?${params.toString()}` : ""}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json() as TokenListResponse;
      setTokens((current) => append ? [...current, ...(payload.tokens || [])] : payload.tokens || []);
      setTokenListLimit(payload.limit || 25);
      setTokenListHasMore(Boolean(payload.hasMore));
      setNextTokenCursor(payload.nextCursor || null);
      if (!payload.ok && payload.message) setMessage(payload.message);
    } catch (error) {
      console.warn("ai connect token load failed", error);
      setMessage("연결 토큰 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.access_token) void loadTokens(session.access_token);
  }, [session?.access_token, loadTokens]);

  useEffect(() => {
    fetch("/api/sif-embedding-gate/status")
      .then(async (response) => {
        const payload = await response.json() as SifEmbeddingGateStatusResponse;
        setSifGate(payload);
        if (!response.ok) setSifGateMessage(payload.message || "SIF 임베딩 승인 게이트 상태를 확인해야 합니다.");
      })
      .catch((error: unknown) => {
        console.warn("sif embedding gate status load failed", error);
        setSifGateMessage("SIF 임베딩 승인 게이트 상태를 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    fetch("/api/input-photos/hazard-analysis")
      .then(async (response) => {
        const payload: unknown = await response.json();
        const presentation = readPhotoVisionPresentationPayload(payload);
        if (!presentation) {
          console.warn("photo vision readiness payload was not an object");
          setPhotoVisionMessage("사진 분석/OCR 준비 응답 형식을 확인해야 합니다.");
          return;
        }
        setPhotoVision(presentation);
        if (!response.ok) setPhotoVisionMessage("사진 분석/OCR 준비 상태를 확인해야 합니다.");
      })
      .catch((error: unknown) => {
        console.warn("photo vision readiness load failed", error);
        setPhotoVisionMessage("사진 분석/OCR 준비 상태를 불러오지 못했습니다.");
      });
  }, []);

  const commandText = useMemo(() => (
    oneTimeToken ? commandForTab(activeTab, oneTimeToken) : ""
  ), [activeTab, oneTimeToken]);
  const photoFlow = useMemo(
    () => photoVision ? buildPhotoFlowPresentation(photoVision.flow, photoVision.maxInputPhotos) : [],
    [photoVision]
  );

  async function issueToken() {
    if (!session?.access_token) return;
    setIsIssuing(true);
    setMessage("");
    try {
      const response = await fetch("/api/mcp-tokens", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(activeTab === "harness" ? { label: "SafeClaw Harness Agent" } : {}),
      });
      const payload = await response.json() as TokenIssueResponse;
      if (payload.ok && payload.plaintextToken && payload.token) {
        setOneTimeToken(payload.plaintextToken);
        setTokens((current) => [payload.token as McpTokenSummary, ...current].slice(0, tokenListLimit));
      }
      setMessage(payload.message || (payload.ok ? "연결 토큰을 발급했습니다." : "토큰 발급에 실패했습니다."));
    } catch (error) {
      console.error("ai connect token issue failed", error);
      setMessage("연결 토큰 발급 요청 중 오류가 발생했습니다.");
    } finally {
      setIsIssuing(false);
    }
  }

  async function disableToken(id: string) {
    if (!session?.access_token) return;
    setMessage("");
    try {
      const response = await fetch(`/api/mcp-tokens/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json() as ActionResponse;
      if (payload.ok) {
        setTokens((current) => current.map((token) => (
          token.id === id ? { ...token, disabled: true } : token
        )));
      }
      setMessage(payload.message || (payload.ok ? "연결 토큰을 비활성화했습니다." : "토큰 변경에 실패했습니다."));
    } catch (error) {
      console.error("ai connect token disable failed", error);
      setMessage("연결 토큰 비활성화 요청 중 오류가 발생했습니다.");
    }
  }

  async function copyCommand() {
    if (!commandText) return;
    await navigator.clipboard.writeText(commandText);
    setMessage("설치 명령을 복사했습니다.");
  }

  async function testConnection() {
    if (!oneTimeToken) {
      setMessage("연결 테스트는 방금 발급한 토큰으로만 실행할 수 있습니다.");
      return;
    }
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/mcp/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${oneTimeToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "safeclaw-ai-connect", version: "1.0.0" },
          },
        }),
      });
      setMessage(response.ok ? "연결 테스트가 응답했습니다. 이제 설치 명령으로 AI 도구에 붙이면 됩니다." : "연결 테스트 응답을 확인하지 못했습니다.");
    } catch (error) {
      console.error("ai connect probe failed", error);
      setMessage("연결 테스트 중 오류가 발생했습니다.");
    } finally {
      setTesting(false);
    }
  }

  if (!client || (sessionChecked && !session)) {
    return (
      <section className="safeclaw-module-panel ai-connect-empty">
        <span>로그인 필요</span>
        <h2>관리자 로그인 후 연결 토큰을 발급할 수 있습니다.</h2>
        <p>SafeClaw 도구 연결은 현장 문서와 증빙 파일철에 접근할 수 있으므로 로그인한 관리자에게만 열립니다.</p>
        <Link href="/login?next=/settings/ai-connect" className="button">관리자 로그인</Link>
      </section>
    );
  }

  return (
    <div className="ai-connect-workspace">
      <section className="ai-connect-tabs" aria-label="AI 연결 방식">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <strong>{tab.label}</strong>
            <span>{tab.body}</span>
          </button>
        ))}
      </section>

      <section className="safeclaw-module-panel ai-connect-command">
        <span>{activeTab === "harness" ? "근거 고정" : "연결 토큰"}</span>
        <h2>{activeTab === "harness" ? "내 OAuth와 SafeClaw 검증 근거를 분리해 연결합니다." : "내 AI에 SafeClaw 도구를 붙입니다."}</h2>
        <p>
          {activeTab === "harness"
            ? "OpenClaw의 모델 사용은 내 OpenAI OAuth 프로필이 담당하고, SafeClaw 데이터 접근은 이 연결 토큰이 담당합니다. 작업을 시작하면 SIF·KOSHA·작업 이력을 먼저 확인하고, 실제 문서 생성은 SafeClaw 승인 흐름에서만 실행됩니다."
            : "토큰은 발급 직후 한 번만 표시됩니다. 화면을 떠난 뒤에는 기존 토큰을 다시 볼 수 없고, 새로 발급하거나 기존 토큰을 끌 수 있습니다."}
        </p>
        <div className="ai-connect-actions">
          <button type="button" onClick={issueToken} disabled={isIssuing}>
            {isIssuing ? "발급 중" : "연결 토큰 발급"}
          </button>
          <button type="button" className="secondary" onClick={testConnection} disabled={!oneTimeToken || testing}>
            {testing ? "확인 중" : "연결 테스트"}
          </button>
        </div>
        <dl className="ai-connect-meta">
          <div>
            <dt>엔드포인트</dt>
            <dd>{MCP_ENDPOINT_URL}</dd>
          </div>
          <div>
            <dt>상태</dt>
            <dd>{oneTimeToken ? "방금 발급됨" : isLoading ? "불러오는 중" : "발급 대기"}</dd>
          </div>
        </dl>
        {oneTimeToken ? (
          <div className="ai-connect-secret">
            <label htmlFor="ai-connect-token">이번에만 표시되는 토큰</label>
            <textarea id="ai-connect-token" readOnly rows={2} value={oneTimeToken} />
          </div>
        ) : null}
        {commandText ? (
          <div className="ai-connect-command-box">
            <div>
              <strong>설치 명령</strong>
              <button type="button" className="secondary" onClick={copyCommand}>복사</button>
            </div>
            <pre>{commandText}</pre>
          </div>
        ) : null}
        {message ? <p className="muted">{message}</p> : null}
      </section>

      <section className="safeclaw-module-panel ai-connect-sif-gate">
        <div className="ai-connect-section-head">
          <div>
            <span>SIF 임베딩 승인 단계</span>
            <h2>SIF 코퍼스는 준비됐고, 임베딩은 승인 전 보류합니다.</h2>
          </div>
          <strong className={sifGate?.ok ? "ready" : "hold"}>
            {sifGate ? (sifGate.ok ? "승인 대기" : "점검 필요") : "확인 중"}
          </strong>
        </div>
        <p>
          {sifGate ? formatSifTextForPresentation(sifGate.message) : sifGateMessage || "SIF 코퍼스, 배치 목록, 승인 플래그 상태를 확인하고 있습니다."}
        </p>
        {sifGate ? (
          <>
            <dl className="ai-connect-sif-metrics">
              <div>
                <dt>SIF 원본</dt>
                <dd>{sifGate.corpus.itemCount.toLocaleString("ko-KR")}건</dd>
              </div>
              <div>
                <dt>임베딩 후보</dt>
                <dd>{sifGate.corpus.corpusCount.toLocaleString("ko-KR")}건</dd>
              </div>
              <div>
                <dt>배치</dt>
                <dd>{sifGate.corpus.batchCount.toLocaleString("ko-KR")}개</dd>
              </div>
              <div>
                <dt>생성/업로드</dt>
                <dd>{sifGate.corpus.embeddedCount.toLocaleString("ko-KR")} / {sifGate.corpus.uploadedCount.toLocaleString("ko-KR")}건</dd>
              </div>
            </dl>
            <div className="ai-connect-sif-state-grid">
              <article className={`ai-connect-sif-verdict ${sifGate.readinessVerdict.state}`}>
                <span>현재 결론</span>
                <strong>{formatSifTextForPresentation(sifGate.readinessVerdict.label)}</strong>
                <p>{formatSifTextForPresentation(sifGate.readinessVerdict.answer)}</p>
                <small>{formatSifTextForPresentation(sifGate.readinessVerdict.nextAction)}</small>
              </article>
              <article>
                <strong>품질 게이트</strong>
                <p>
                  빈 텍스트 {sifGate.validation.emptyEmbeddingTextCount}건 · 관리대책 누락 {sifGate.validation.missingControlsCount}건 · 중복 해시 {sifGate.validation.duplicateContentHashCount}건
                </p>
              </article>
              <article>
                <strong>승인 조건</strong>
                <p>
                  DB 마이그레이션 승인 · 임베딩 비용 승인 · 업로드 승인 플래그가 모두 필요합니다.
                </p>
              </article>
              <article>
                <strong>런타임 실행 준비</strong>
                <p>
                  {sifGate.runtime.executionReadyAfterApproval
                    ? "승인 후 실행 환경이 준비되어 있습니다."
                    : "승인 후 실행 전 OpenAI 키와 Supabase 서비스 역할 상태를 다시 확인해야 합니다."}
                </p>
              </article>
              <article>
                <strong>SIF 코퍼스/임베딩</strong>
                <p>{formatSifTextForPresentation(sifGate.learningLifecycle.answer)}</p>
                <small>
                  {formatSifTextForPresentation(sifGate.learningLifecycle.label)} · 모델 가중치 변경 {sifGate.learningLifecycle.modelFineTuningPerformed ? "있음" : "없음"}
                </small>
              </article>
              <article>
                <strong>소규모 검증 임베딩</strong>
                <p>{formatSifTextForPresentation(sifGate.canary.answer)}</p>
                <small>
                  {sifGate.canary.embeddedCount.toLocaleString("ko-KR")} / {sifGate.canary.corpusCount.toLocaleString("ko-KR")}건 · DB 업로드 {sifGate.canary.dbMutationPerformed ? "있음" : "없음"}
                </small>
              </article>
              <article>
                <strong>벡터 검색</strong>
                <p>{formatSifTextForPresentation(sifGate.vectorGuard.label)} · {sifGate.runtime.vectorFeatureFlagEnabled ? "기능 플래그 켜짐" : "기능 플래그 꺼짐"}</p>
              </article>
            </div>
            <div className={`ai-connect-sif-vector-guard ${sifGate.vectorGuard.status}`}>
              <div>
                <strong>{formatSifTextForPresentation(sifGate.vectorGuard.label)}</strong>
                <span>
                  업로드 {sifGate.vectorGuard.uploadedCount.toLocaleString("ko-KR")} / {sifGate.vectorGuard.requiredUploadCount.toLocaleString("ko-KR")}건
                </span>
              </div>
              <p>{formatSifTextForPresentation(sifGate.vectorGuard.message)}</p>
            </div>
            <div className={`ai-connect-sif-next-gate ${sifGate.nextApprovalGate.status}`}>
              <div>
                <span>다음 승인</span>
                <strong>{formatSifGateIdForPresentation(sifGate.nextApprovalGate.id)}</strong>
              </div>
              <p>{formatSifTextForPresentation(sifGate.nextApprovalGate.detail)}</p>
              <small>{formatSifTextForPresentation(sifGate.nextApprovalGate.action)}</small>
              {sifGate.nextApprovalGate.artifactPath ? (
                <code>{sifGate.nextApprovalGate.artifactPath}</code>
              ) : null}
              {sifGate.nextApprovalGate.command ? (
                <pre>{sifGate.nextApprovalGate.command}</pre>
              ) : null}
              <div className="ai-connect-sif-packet-actions">
                <a
                  href="/api/sif-embedding-gate/approval-packet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  승인 패킷 열기
                </a>
                <a
                  href="/api/sif-embedding-gate/approval-packet?format=json"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  JSON 보기
                </a>
              </div>
            </div>
            <div className={`ai-connect-sif-operator-gate ${sifGate.operatorGate.status}`}>
              <div>
                <span>운영자 승인 단계</span>
                <strong>{formatSifTextForPresentation(sifGate.operatorGate.title)}</strong>
              </div>
              <p>{formatSifTextForPresentation(sifGate.operatorGate.approvalQuestion)}</p>
              <dl>
                <div>
                  <dt>마이그레이션</dt>
                  <dd>{sifGate.operatorGate.migrationArtifact.exists ? "파일 확인" : "파일 확인 필요"}</dd>
                </div>
                <div>
                  <dt>소규모 검증</dt>
                  <dd>
                    {sifGate.operatorGate.canaryEvidence.embeddedCount.toLocaleString("ko-KR")}건 · 업로드 {sifGate.operatorGate.canaryEvidence.uploadedCount.toLocaleString("ko-KR")}건
                  </dd>
                </div>
                <div>
                  <dt>승인 단계</dt>
                  <dd>{formatSifGateIdForPresentation(sifGate.operatorGate.gateId)}</dd>
                </div>
                <div>
                  <dt>검증 결과</dt>
                  <dd>
                    {formatSifRuntimeStatusForPresentation(sifGate.postMigrationVerification.status)} · {sifGate.postMigrationVerification.uploadedCount.toLocaleString("ko-KR")} / {sifGate.postMigrationVerification.expectedCorpusCount.toLocaleString("ko-KR")}건
                  </dd>
                </div>
              </dl>
              <div className="ai-connect-sif-operator-columns">
                <section>
                  <span>승인 전 가능</span>
                  <ul>
                    {sifGate.operatorGate.allowedBeforeApproval.map((item) => (
                      <li key={item}>{formatSifTextForPresentation(item)}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <span>승인 전 금지</span>
                  <ul>
                    {sifGate.operatorGate.forbiddenBeforeApproval.map((item) => (
                      <li key={item}>{formatSifTextForPresentation(item)}</li>
                    ))}
                  </ul>
                </section>
              </div>
              <ol className="ai-connect-sif-operator-checklist">
                {sifGate.operatorGate.checklist.map((item) => (
                  <li key={item.id} className={item.status}>
                    <span>{formatSifChecklistStatusForPresentation(item.status)}</span>
                    <div>
                      <strong>{formatSifTextForPresentation(item.label)}</strong>
                      <p>{formatSifTextForPresentation(item.evidence)}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <small>{formatSifTextForPresentation(sifGate.operatorGate.nonApprovalFallback)}</small>
            </div>
            <div className="ai-connect-sif-approval-packet">
              <div>
                <strong>승인 패킷</strong>
                <span>{sifGate.approvalPacket.decisionCount}개 결정 · {sifGate.approvalPacket.requiredArtifacts.length}개 산출물</span>
              </div>
              <div className="ai-connect-sif-fingerprint">
                <span>승인 지문</span>
                <code>{sifGate.approvalPacket.approvalFingerprint}</code>
                <p>코퍼스 해시, SIF 전용 마이그레이션 SQL 해시, 모델/차원/수량을 묶어 승인 대상 파일을 고정합니다.</p>
              </div>
              <ol>
                {sifGate.approvalPacket.decisions.map((decision, index) => (
                  <li key={`${decision}-${index}`}>{formatSifApprovalDecisionForPresentation(decision)}</li>
                ))}
              </ol>
              <div className="ai-connect-sif-artifact-grid" aria-label="SIF 승인 산출물">
                {sifGate.approvalPacket.requiredArtifacts.map((artifact) => (
                  <article key={artifact.path}>
                    <strong>{formatSifArtifactLabelForPresentation(artifact.label)}</strong>
                    <code>{artifact.path}</code>
                    <p>{formatSifTextForPresentation(artifact.role)}</p>
                  </article>
                ))}
              </div>
              <div className="ai-connect-sif-artifact-grid" aria-label="SIF 산출물 무결성">
                {sifGate.approvalPacket.artifactIntegrity.map((artifact) => (
                  <article key={`${artifact.label}-${artifact.path}`}>
                    <strong>{formatSifArtifactLabelForPresentation(artifact.label)}</strong>
                    <code>{artifact.sha256 || artifact.contentHash || "해시 미기록"}</code>
                    <p>
                      {artifact.exists ? "파일 확인" : "파일 누락"} · {artifact.byteSize.toLocaleString("ko-KR")}바이트
                      {typeof artifact.recordCount === "number" ? ` · ${artifact.recordCount.toLocaleString("ko-KR")}건` : ""}
                    </p>
                  </article>
                ))}
              </div>
              <div className="ai-connect-sif-lock-grid" aria-label="SIF 승인 안전 잠금">
                {sifGate.approvalPacket.safetyLocks.map((lock) => (
                  <article key={lock.label} className={lock.locked ? "locked" : "open"}>
                    <span>{lock.locked ? "잠금" : "확인 필요"}</span>
                    <strong>{formatSifTextForPresentation(lock.label)}</strong>
                    <p>{formatSifTextForPresentation(lock.detail)}</p>
                  </article>
                ))}
              </div>
            </div>
            <ol className="ai-connect-sif-approval-steps" aria-label="SIF 임베딩 승인 순서">
              {sifGate.approvalSteps.map((step) => (
                <li key={step.id} className={step.status}>
                  <span>{formatSifApprovalStepStatusForPresentation(step.status)}</span>
                  <div>
                    <strong>{formatSifTextForPresentation(step.label)}</strong>
                    <p>{formatSifTextForPresentation(step.detail)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="ai-connect-sif-command">
              <div>
                <strong>승인 후 실행 명령</strong>
                <span>{sifGate.corpus.embeddingModel} · {sifGate.corpus.embeddingDimensions}d</span>
              </div>
              <pre>{sifGate.commandHeldUntilApproval}</pre>
            </div>
            <details className="ai-connect-sif-preflight">
              <summary>사전 자동 점검 {sifGate.failedCheckIds.length ? "확인 필요" : "통과"}</summary>
              <ul>
                {sifGate.preflightChecks.map((check) => (
                  <li key={check.id} className={check.passed ? "passed" : "failed"}>
                    <span>{check.passed ? "통과" : "확인"}</span>
                    <div>
                      <strong>{formatSifPreflightLabelForPresentation(check.id, check.label)}</strong>
                      <p>{check.evidenceSummary}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
            <p className="muted">
              운영 DB 점검: {formatSifRuntimeStatusForPresentation(sifGate.runtimeDbProbe.status)} · 테이블 {sifGate.runtimeDbProbe.tableReady ? "준비됨" : "없음"} · RPC {sifGate.runtimeDbProbe.rpcReady ? "준비됨" : "없음"}
            </p>
            <p className="muted">근거 파일: {sifGate.artifacts.reportPath} · {sifGate.artifacts.manifestPath}</p>
          </>
        ) : null}
      </section>

      <section className="safeclaw-module-panel ai-connect-vision-gate">
        <div className="ai-connect-section-head">
          <div>
            <span>사진 분석/OCR 하네스</span>
            <h2>사진은 후보로 분석하고, 사용자가 채택한 것만 기억합니다.</h2>
          </div>
          <strong className={photoVision?.ok ? "ready" : "hold"}>
            {photoVision ? (photoVision.ok ? "분석 준비" : "키 확인") : "확인 중"}
          </strong>
        </div>
        <p>
          {photoVision ? formatPhotoVisionStatus(photoVision.status) : photoVisionMessage || "현장 사진 분석 설정과 하네스 연결 상태를 확인하고 있습니다."}
        </p>
        {photoVision ? (
          <>
            <dl className="ai-connect-sif-metrics">
              <div>
                <dt>첨부 한도</dt>
                <dd>{formatPhotoInputLimit(photoVision.maxInputPhotos)}</dd>
              </div>
              <div>
                <dt>모델</dt>
                <dd>{photoVision.model}</dd>
              </div>
              <div>
                <dt>OCR</dt>
                <dd>{photoVision.ocrSupported ? "지원" : "미지원"}</dd>
              </div>
              <div>
                <dt>파일 검증</dt>
                <dd>{formatPhotoFileValidationMode(photoVision.fileValidationMode)}</dd>
              </div>
              <div>
                <dt>저장 기준</dt>
                <dd>{photoVision.acceptedOnly ? "채택 후보만" : "전체 후보"}</dd>
              </div>
            </dl>
            <div className="ai-connect-vision-flow" aria-label="사진 분석/OCR 하네스 흐름">
              {photoFlow.map((item) => (
                <article key={item.key}>
                  <span>{item.step}</span>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
            <div className="ai-connect-sif-command">
              <div>
                <strong>사진 분석 API 경로</strong>
                <span>{photoVision.hazardAnalysisMethod}</span>
              </div>
              <pre>{photoVision.hazardAnalysisEndpoint}</pre>
            </div>
            <p className="muted">
              개선 전/개선 후 사진은 {photoVision.improvementEndpointPattern}에서 사진 분석/OCR 데이터로 저장되고,
              {photoVision.exportTargets.length ? photoVision.exportTargets.join(" · ") : "보존 위치 확인 필요"}에 보존됩니다.
            </p>
          </>
        ) : null}
      </section>

      <section className="safeclaw-module-panel ai-connect-token-list">
        <span>발급 이력</span>
        <h2>현재 현장에 연결된 토큰</h2>
        <p className="muted">
          최근 {tokenListLimit}개까지 표시합니다. 오래된 토큰은 API에서 계속 보호되며 필요 시 폐기 정책으로 관리합니다.
        </p>
        <div className="ai-connect-token-items">
          {tokens.length ? tokens.map((token) => (
            <article key={token.id}>
              <div>
                <strong>{formatCustomerFacingLabel(token.label)}</strong>
                <p>{token.siteName} · 최근 사용 {formatDate(token.lastUsedAt)}</p>
              </div>
              <span className={token.disabled ? "off" : "on"}>{token.disabled ? "꺼짐" : "사용 가능"}</span>
              <button
                type="button"
                className="secondary"
                onClick={() => void disableToken(token.id)}
                disabled={token.disabled}
              >
                연결 끄기
              </button>
            </article>
          )) : (
            <p className="muted">아직 발급된 연결 토큰이 없습니다.</p>
          )}
        </div>
        {tokenListHasMore ? <p className="muted">표시되지 않은 이전 토큰이 더 있습니다.</p> : null}
        {tokenListHasMore && nextTokenCursor && session?.access_token ? (
          <button
            type="button"
            className="secondary"
            onClick={() => void loadTokens(session.access_token, nextTokenCursor, true)}
            disabled={isLoading}
          >
            {isLoading ? "불러오는 중" : "이전 토큰 더 보기"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
