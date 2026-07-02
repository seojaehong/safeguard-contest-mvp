import { describe, expect, test } from "vitest";
import {
  stagePersonaCopy,
  docPersonaCopy,
  nextConsoleLines,
  type AgentConsoleLine
} from "@/lib/agent-console-copy";
import type { AskProgressEvent } from "@/lib/ask-progress";

describe("stagePersonaCopy", () => {
  test("maps a known stage id to its Korean persona copy", () => {
    expect(stagePersonaCopy("weather")).toBe("기상청 실황·특보 확인");
    expect(stagePersonaCopy("kosha")).toBe("KOSHA 공식자료·재해사례 대조");
  });

  test("falls back to the raw stage id for unknown stages (no dropping)", () => {
    expect(stagePersonaCopy("someFutureStage")).toBe("someFutureStage");
  });
});

describe("docPersonaCopy", () => {
  test("maps a known doc name to its Korean persona copy", () => {
    expect(docPersonaCopy("riskAssessment")).toBe("위험성평가표 작성");
  });

  test("falls back to the raw doc name for unknown docs (no dropping)", () => {
    expect(docPersonaCopy("someFutureDoc")).toBe("someFutureDoc");
  });
});

describe("nextConsoleLines", () => {
  test("stage start upserts an active line", () => {
    const event: AskProgressEvent = { kind: "stage", stage: "weather", status: "start" };
    const lines = nextConsoleLines([], event);
    expect(lines).toEqual([
      { id: "stage:weather", label: "기상청 실황·특보 확인", status: "active", detail: undefined }
    ]);
  });

  test("stage ok/fail updates the existing line in place rather than appending", () => {
    const start: AgentConsoleLine[] = nextConsoleLines([], {
      kind: "stage",
      stage: "weather",
      status: "start"
    });
    const updated = nextConsoleLines(start, { kind: "stage", stage: "weather", status: "ok" });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ id: "stage:weather", status: "ok" });
  });

  test("doc events upsert directly to their terminal status", () => {
    const lines = nextConsoleLines([], { kind: "doc", name: "riskAssessment", status: "ok" });
    expect(lines).toEqual([{ id: "doc:riskAssessment", label: "위험성평가표 작성", status: "ok" }]);
  });

  test("error events append a standalone failed line with the message as detail", () => {
    const lines = nextConsoleLines([], { kind: "error", message: "boom" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ status: "fail", detail: "boom" });
  });

  test("final event appends a summary line counting prior failures and echoing status.summary", () => {
    const withFailure: AgentConsoleLine[] = [
      { id: "stage:weather", label: "기상청 실황·특보 확인", status: "fail" }
    ];
    const lines = nextConsoleLines(withFailure, {
      kind: "final",
      payload: { status: { summary: "정상" } }
    });
    expect(lines).toHaveLength(2);
    expect(lines[1].label).toBe("문서팩 준비 완료 — 특이사항 1건 (정상)");
    expect(lines[1].status).toBe("ok");
  });

  test("final event tolerates a payload without a status.summary field", () => {
    const lines = nextConsoleLines([], { kind: "final", payload: {} });
    expect(lines[0].label).toBe("문서팩 준비 완료 — 특이사항 0건");
  });
});
