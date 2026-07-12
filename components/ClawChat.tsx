"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  createClawChatRequestSession,
  type ClawChatRequestSession,
} from "@/lib/claw-chat-session";
import { parseSseChunk } from "@/lib/sse-client";

// 클로(Claw) AI 안전관리자 채팅 v0의 UI.
// SSE 스트림({kind:"text-delta"|"tool"|"final"|"error"})을 lib/sse-client.parseSseChunk로
// 파싱해, 도구 사용은 콘솔 라인(.agent-console*)으로 흘리고 답변은 타이핑 스트리밍한다.

type ToolLine = { id: string; name: string; status: "start" | "ok" | "fail"; label: string };

type ClawTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; tools: ToolLine[]; done: boolean; error?: string };

type ClawChatEvent =
  | { kind: "text-delta"; text: string }
  | { kind: "tool"; name: string; status: "start" | "ok" | "fail"; label: string }
  | { kind: "final" }
  | { kind: "error"; code?: string; message: string };

type HistoryMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "오늘 우리 현장 날씨 위험 요인 알려줘",
  "내일 크레인 반입하는데 뭘 준비해야 해?",
  "지게차 관련 최근 사고사례 찾아줘",
];

function statusIcon(status: ToolLine["status"]): string {
  if (status === "ok") return "✓";
  if (status === "fail") return "!";
  return "▸";
}

export type ClawChatProps = {
  authToken?: string;
  siteOptions: Array<{ id: string; name: string }>;
  selectedSiteId: string | null;
  onSiteChange: (siteId: string) => void;
  contextStatus: "login-required" | "loading" | "ready" | "unavailable";
};

function contextMessage(status: ClawChatProps["contextStatus"]): string {
  if (status === "login-required") return "로그인 후 소유 현장을 연결하면 클로를 사용할 수 있습니다.";
  if (status === "loading") return "소유 현장 정보를 확인하고 있습니다.";
  if (status === "unavailable") return "사용할 수 있는 소유 현장을 찾지 못했습니다.";
  return "";
}

export function ClawChat({ authToken, siteOptions, selectedSiteId, onSiteChange, contextStatus }: ClawChatProps) {
  const [turns, setTurns] = useState<ClawTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestSessionRef = useRef<ClawChatRequestSession | null>(null);
  if (!requestSessionRef.current) {
    requestSessionRef.current = createClawChatRequestSession({
      resetTurns: () => setTurns([]),
      setBusy,
    });
  }
  const requestSession = requestSessionRef.current;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns]);

  useLayoutEffect(() => {
    requestSession.synchronizeContext(authToken, selectedSiteId);
  }, [authToken, requestSession, selectedSiteId]);

  useEffect(() => () => requestSession.dispose(), [requestSession]);

  const canSend = Boolean(authToken && selectedSiteId && contextStatus === "ready");

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim().slice(0, 2000);
      if (!message || busy || !canSend) return;

      const history: HistoryMessage[] = turns
        .map((turn) => ({ role: turn.role, content: turn.text }))
        .filter((entry) => entry.content.trim().length > 0);

      setInput("");
      const requestController = requestSession.beginRequest();
      setTurns((current) => [
        ...current,
        { role: "user", text: message },
        { role: "assistant", text: "", tools: [], done: false },
      ]);

      const updateAssistant = (updater: (turn: Extract<ClawTurn, { role: "assistant" }>) => Extract<ClawTurn, { role: "assistant" }>) => {
        if (!requestSession.isCurrent(requestController)) return;
        setTurns((current) => {
          if (!requestSession.isCurrent(requestController)) return current;
          const next = [...current];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            const turn = next[i];
            if (turn.role === "assistant") {
              next[i] = updater(turn);
              break;
            }
          }
          return next;
        });
      };

      try {
        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ message, history, siteId: selectedSiteId }),
          signal: requestController.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.json().catch(() => ({ error: "" }));
          updateAssistant((turn) => ({
            ...turn,
            done: true,
            error: detail.error || `요청 실패 (${response.status})`,
          }));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const parsed = parseSseChunk(buffer, decoder.decode(value, { stream: true }));
          buffer = parsed.rest;
          for (const rawEvent of parsed.events) {
            const event = rawEvent as unknown as ClawChatEvent;
            if (event.kind === "text-delta") {
              updateAssistant((turn) => ({ ...turn, text: turn.text + event.text }));
            } else if (event.kind === "tool") {
              updateAssistant((turn) => {
                const tools = [...turn.tools];
                if (event.status === "start") {
                  tools.push({ id: `${event.name}-${tools.length}`, name: event.name, status: "start", label: event.label });
                } else {
                  for (let i = tools.length - 1; i >= 0; i -= 1) {
                    if (tools[i].name === event.name && tools[i].status === "start") {
                      tools[i] = { ...tools[i], status: event.status, label: event.label };
                      break;
                    }
                  }
                }
                return { ...turn, tools };
              });
            } else if (event.kind === "final") {
              updateAssistant((turn) => ({ ...turn, done: true }));
            } else if (event.kind === "error") {
              updateAssistant((turn) => ({ ...turn, done: true, error: event.message }));
            }
          }
        }
        updateAssistant((turn) => ({ ...turn, done: true }));
      } catch (error) {
        if (requestController.signal.aborted) return;
        const detail = error instanceof Error ? error.message : String(error);
        updateAssistant((turn) => ({ ...turn, done: true, error: detail }));
      } finally {
        requestSession.completeRequest(requestController);
      }
    },
    [authToken, busy, canSend, requestSession, selectedSiteId, turns]
  );

  return (
    <article className="workspace-panel card claw-chat" aria-label="클로 AI 안전관리자">
      <div className="compact-head">
        <span className="eyebrow">상주 안전관리자</span>
        <strong>클로에게 묻기</strong>
      </div>
      {siteOptions.length > 1 ? (
        <select
          className="input"
          aria-label="클로 현장 선택"
          value={selectedSiteId ?? ""}
          onChange={(event) => onSiteChange(event.target.value)}
          disabled={busy || !authToken || contextStatus !== "ready"}
        >
          {siteOptions.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
        </select>
      ) : null}
      {!canSend ? <p className="muted small">{contextMessage(contextStatus)}</p> : null}

      <div className="claw-chat-scroll" ref={scrollRef}>
        {turns.length === 0 ? (
          <div className="claw-chat-empty">
            <p>안녕하세요, 클로입니다. 오늘 현장에 대해 무엇이든 물어보세요.</p>
            <div className="claw-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="claw-suggestion"
                  onClick={() => send(suggestion)}
                  disabled={busy || !canSend}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <p key={`u-${index}`} className="claw-bubble claw-bubble-user">
              {turn.text}
            </p>
          ) : (
            <div key={`a-${index}`} className="claw-answer">
              {turn.tools.length > 0 ? (
                <div className="agent-console" role="log" aria-live="polite">
                  <div className="agent-console-body">
                    {turn.tools.map((tool) => (
                      <p key={tool.id} className={`agent-console-line agent-console-line-${tool.status === "start" ? "active" : tool.status}`}>
                        <span className="agent-console-icon" aria-hidden="true">
                          {statusIcon(tool.status)}
                        </span>
                        <span className="agent-console-label">{tool.label}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {turn.text ? <p className="claw-bubble claw-bubble-claw">{turn.text}</p> : null}
              {!turn.done && !turn.text ? <p className="claw-thinking">클로가 확인하고 있습니다…</p> : null}
              {turn.error ? <p className="claw-error">문제가 발생했습니다: {turn.error}</p> : null}
            </div>
          )
        )}
      </div>

      <form
        className="claw-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={canSend ? "현장 안전 질문을 입력하세요" : contextMessage(contextStatus)}
          aria-label="클로에게 보낼 메시지"
          maxLength={2000}
          disabled={busy || !canSend}
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !canSend || !input.trim()}>
          {busy ? "확인 중…" : "묻기"}
        </button>
      </form>

      <p className="claw-disclaimer">클로의 답변은 초안입니다. 최종 판단은 현장 확인과 전문가 자문으로.</p>
    </article>
  );
}
