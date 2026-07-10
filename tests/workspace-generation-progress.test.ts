import { describe, expect, it } from "vitest";
import type { AgentConsoleLine } from "@/lib/agent-console-copy";
import { buildGenerationProgressState } from "@/lib/workspace-generation-progress";

describe("buildGenerationProgressState", () => {
  const totalDocumentCount = 12;

  it("uses a calm idle copy before generation starts", () => {
    const state = buildGenerationProgressState({
      hasData: false,
      state: "idle",
      consoleLines: [],
      totalDocumentCount,
      citationCount: 0
    });

    expect(state).toEqual({
      count: 0,
      primary: "0/12",
      secondary: "근거 준비",
      detail: "현장 상황을 입력하면 기상, 법령, SIF/KOSHA DB를 순서대로 확인합니다.",
      indeterminate: false
    });
  });

  it("does not leave enhanced generation looking frozen at the initial 3/12 state", () => {
    const consoleLines: AgentConsoleLine[] = [
      { id: "stage:weather", label: "기상청 실황·특보 확인", status: "ok" },
      { id: "stage:training", label: "고용24 연계 교육과정 조회", status: "ok" },
      { id: "stage:kosha", label: "KOSHA 공식자료·재해사례 대조", status: "ok" },
      { id: "stage:accidentCases", label: "유사 재해사례 검색", status: "ok" },
      { id: "doc:structuredRiskRows", label: "위험요인-조치 row 확정", status: "ok" }
    ];

    const state = buildGenerationProgressState({
      hasData: false,
      state: "generating",
      consoleLines,
      totalDocumentCount,
      citationCount: 0
    });

    expect(state.count).toBeGreaterThan(3);
    expect(state.count).toBeLessThan(totalDocumentCount);
    expect(state.primary).not.toBe("3/12");
    expect(state.secondary).toContain("실시간 검토 5건");
    expect(state.detail).toBe("위험요인-조치 row 확정 확인됨");
  });

  it("moves the visible count when early stream lines are active but not terminal yet", () => {
    const consoleLines: AgentConsoleLine[] = Array.from({ length: 10 }, (_, index) => ({
      id: index < 5 ? `stage:${index}` : `doc:${index}`,
      label: `초기 검토 ${index}`,
      status: "active" as const
    }));

    const state = buildGenerationProgressState({
      hasData: false,
      state: "generating",
      consoleLines,
      totalDocumentCount,
      citationCount: 0
    });

    expect(state.count).toBeGreaterThan(3);
    expect(state.count).toBeLessThan(totalDocumentCount);
    expect(state.primary).toBe("6/12");
    expect(state.secondary).toBe("실시간 검토 10건 · 진행 10건");
    expect(state.detail).toBe("초기 검토 9 진행 중");
  });

  it("caps in-flight progress below completion until a final payload is applied", () => {
    const consoleLines: AgentConsoleLine[] = Array.from({ length: 24 }, (_, index) => ({
      id: index < 12 ? `stage:${index}` : `doc:${index}`,
      label: `작업 ${index}`,
      status: "ok" as const
    }));

    const state = buildGenerationProgressState({
      hasData: false,
      state: "generating",
      consoleLines,
      totalDocumentCount,
      citationCount: 0
    });

    expect(state.count).toBe(11);
    expect(state.primary).toBe("11/12");
  });

  it("shows completion only after the generated payload is applied", () => {
    const state = buildGenerationProgressState({
      hasData: true,
      state: "ready",
      consoleLines: [],
      totalDocumentCount,
      citationCount: 6,
      shareReady: true
    });

    expect(state.count).toBe(12);
    expect(state.primary).toBe("12/12 생성");
    expect(state.secondary).toBe("공유 준비 · 6건 근거");
    expect(state.indeterminate).toBe(false);
  });

  it("keeps generated document count separate from blocked review readiness", () => {
    const state = buildGenerationProgressState({
      hasData: true,
      state: "ready",
      consoleLines: [],
      totalDocumentCount,
      citationCount: 6,
      shareReady: false,
      reviewSummary: "안전조치 검수와 결재란 확인이 필요합니다."
    });

    expect(state.count).toBe(12);
    expect(state.primary).toBe("12/12 생성");
    expect(state.secondary).toBe("검수 필요 · 6건 근거");
    expect(state.detail).toBe("안전조치 검수와 결재란 확인이 필요합니다.");
    expect(state.indeterminate).toBe(false);
  });

  it("uses an honest indeterminate state for non-streaming template generation", () => {
    const state = buildGenerationProgressState({
      hasData: false,
      state: "generating",
      consoleLines: [],
      totalDocumentCount,
      citationCount: 0,
      mode: "template"
    });

    expect(state.count).toBe(0);
    expect(state.primary).toBe("생성 중");
    expect(state.secondary).toBe("근거·문서 일괄 확인");
    expect(state.indeterminate).toBe(true);
  });
});
