import { describe, expect, it } from "vitest";

import {
  buildSystemPrompt,
  buildToolEvent,
  capHistory,
  CLAW_INPUT_CAP,
  CLAW_TOOLS,
  formatToolResultBlock,
  parseHistory,
  sanitizeUserInput,
  shouldContinueLoop,
  toolLabel,
  type ClawHistoryMessage,
} from "@/lib/agent-loop";

describe("sanitizeUserInput", () => {
  it("trims and returns the string", () => {
    expect(sanitizeUserInput("  안녕 클로  ")).toBe("안녕 클로");
  });

  it("caps at CLAW_INPUT_CAP characters", () => {
    const long = "가".repeat(CLAW_INPUT_CAP + 500);
    expect(sanitizeUserInput(long).length).toBe(CLAW_INPUT_CAP);
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeUserInput(null)).toBe("");
    expect(sanitizeUserInput(42)).toBe("");
    expect(sanitizeUserInput(undefined)).toBe("");
  });
});

describe("parseHistory", () => {
  it("keeps only valid user/assistant string messages", () => {
    const raw = [
      { role: "user", content: "질문1" },
      { role: "assistant", content: "답변1" },
      { role: "system", content: "무시" },
      { role: "user", content: 123 },
      { role: "user", content: "   " },
      "bad",
      null,
    ];
    expect(parseHistory(raw)).toEqual([
      { role: "user", content: "질문1" },
      { role: "assistant", content: "답변1" },
    ]);
  });

  it("caps each content and returns [] for non-array", () => {
    const long = "가".repeat(CLAW_INPUT_CAP + 100);
    const [first] = parseHistory([{ role: "user", content: long }]);
    expect(first.content.length).toBe(CLAW_INPUT_CAP);
    expect(parseHistory("nope")).toEqual([]);
    expect(parseHistory(undefined)).toEqual([]);
  });
});

describe("capHistory", () => {
  it("keeps the last max messages", () => {
    const messages: ClawHistoryMessage[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    }));
    const capped = capHistory(messages, 20);
    expect(capped.length).toBeLessThanOrEqual(20);
    expect(capped[0].role).toBe("user");
    expect(capped[capped.length - 1].content).toBe("m29");
  });

  it("drops leading assistant messages so it starts with user", () => {
    const messages: ClawHistoryMessage[] = [
      { role: "assistant", content: "a" },
      { role: "assistant", content: "b" },
      { role: "user", content: "u" },
      { role: "assistant", content: "c" },
    ];
    const capped = capHistory(messages, 20);
    expect(capped[0].role).toBe("user");
    expect(capped).toEqual([
      { role: "user", content: "u" },
      { role: "assistant", content: "c" },
    ]);
  });

  it("returns empty when no user message present", () => {
    const messages: ClawHistoryMessage[] = [{ role: "assistant", content: "a" }];
    expect(capHistory(messages)).toEqual([]);
  });
});

describe("buildSystemPrompt", () => {
  it("returns base prompt with no profile", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("클로");
    expect(prompt).toContain("validate_safety_citations");
    expect(prompt).not.toContain("[상주 사업장 정보]");
  });

  it("injects site profile when present", () => {
    const prompt = buildSystemPrompt({
      siteName: "성수 복합건물",
      region: "서울",
      briefingQuestion: "외벽 비계 해체",
    });
    expect(prompt).toContain("[상주 사업장 정보]");
    expect(prompt).toContain("성수 복합건물");
    expect(prompt).toContain("서울");
    expect(prompt).toContain("외벽 비계 해체");
  });

  it("falls back to base prompt when profile has only empty fields", () => {
    const prompt = buildSystemPrompt({ siteName: "  ", region: null, briefingQuestion: "" });
    expect(prompt).not.toContain("[상주 사업장 정보]");
  });
});

describe("CLAW_TOOLS", () => {
  it("exposes the reviewed docpack tool with the existing safeclaw tools", () => {
    const names = CLAW_TOOLS.map((tool) => tool.name).sort();
    expect(names).toEqual(
      [
        "generate_reviewed_safety_docpack",
        "generate_safety_docpack",
        "get_evidence_mapping",
        "get_weather_signals",
        "qa_review_docpack",
        "query_safety_knowledge",
        "sanitize_emergency_contacts",
        "search_accident_cases",
        "validate_safety_citations",
      ].sort()
    );
    for (const tool of CLAW_TOOLS) {
      expect(tool.input_schema.type).toBe("object");
    }
    expect(toolLabel("generate_reviewed_safety_docpack", "start")).toBe("검수 포함 안전 문서팩 생성 중");
  });
});

describe("toolLabel / buildToolEvent", () => {
  it("produces Korean labels per status", () => {
    expect(toolLabel("get_weather_signals", "start")).toBe("기상청 실황 확인 중");
    expect(toolLabel("get_weather_signals", "ok")).toBe("기상청 실황 확인 완료");
    expect(toolLabel("search_accident_cases", "fail")).toBe("재해사례 검색 실패");
  });

  it("falls back to the raw name for unknown tools", () => {
    expect(toolLabel("mystery", "start")).toBe("mystery 중");
  });

  it("buildToolEvent packs kind/name/status/label", () => {
    expect(buildToolEvent("validate_safety_citations", "start")).toEqual({
      kind: "tool",
      name: "validate_safety_citations",
      status: "start",
      label: "법령 인용 검증 중",
    });
  });
});

describe("formatToolResultBlock", () => {
  it("stringifies object payloads", () => {
    const block = formatToolResultBlock("toolu_1", { region: "서울", mode: "실황" });
    expect(block).toEqual({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: JSON.stringify({ region: "서울", mode: "실황" }),
      is_error: false,
    });
  });

  it("passes strings through and marks errors", () => {
    const block = formatToolResultBlock("toolu_2", "plain", true);
    expect(block.content).toBe("plain");
    expect(block.is_error).toBe(true);
  });
});

describe("shouldContinueLoop", () => {
  it("continues only on tool_use", () => {
    expect(shouldContinueLoop("tool_use")).toBe(true);
    expect(shouldContinueLoop("end_turn")).toBe(false);
    expect(shouldContinueLoop("max_tokens")).toBe(false);
    expect(shouldContinueLoop("refusal")).toBe(false);
    expect(shouldContinueLoop(null)).toBe(false);
  });
});
