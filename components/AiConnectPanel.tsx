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

const tabs: { id: AiConnectTab; label: string; body: string }[] = [
  {
    id: "harness",
    label: "Harness Agent",
    body: "내 OpenAI OAuth로 OpenClaw를 쓰되 SafeClaw DB 근거 패킷만 먼저 호출합니다.",
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

  const commandText = useMemo(() => (
    oneTimeToken ? commandForTab(activeTab, oneTimeToken) : ""
  ), [activeTab, oneTimeToken]);

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
        <span>{activeTab === "harness" ? "Harness Agent" : "연결 토큰"}</span>
        <h2>{activeTab === "harness" ? "내 OAuth + SafeClaw 하네스를 분리해 붙입니다." : "내 AI에 SafeClaw 도구를 붙입니다."}</h2>
        <p>
          {activeTab === "harness"
            ? "OpenClaw의 모델 사용은 내 OpenAI OAuth 프로필이 담당하고, SafeClaw 데이터 접근은 이 MCP 토큰이 담당합니다. 시연 중에는 run_safeclaw_harness_agent 도구가 DB 근거를 먼저 고정합니다."
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
                <strong>{token.label}</strong>
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
